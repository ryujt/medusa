# 결제 모듈(payment) 내부 Job Flow — AS-IS

`packages/modules/payment`의 `PaymentModuleService`(`Modules.PAYMENT`)와 결제 제공자를 모듈 깊이에서 그린다. 근거는 `src/services/payment-module.ts`(capturePayment 714·893, refundPayment 930·1198, authorizePayment 574, cancelPayment 1229)와 core-flows `payment/workflows/*`다.

| 그림 이름 | 구현 | 책임 |
| --- | --- | --- |
| PaymentService | `PaymentModuleService` | 결제 컬렉션, 세션, 결제, 매입(capture), 환불(refund)의 공개 계약 |
| PaymentStore | 모델 `payment-collection`, `payment-session`, `payment`, `capture`, `refund`, `refund-reason` | 결제 데이터 저장 |
| ProviderService | `paymentProviderService_` | 등록된 제공자(`pp_system_default`, Stripe, Adyen 등)를 골라 호출 |
| Provider | 결제 제공자 구현 | 외부 결제대행사 API 호출 |

## P1. 매입과 환불

```jobflow
orchestrator: PaymentService
Object: PaymentService, PaymentStore, ProviderService, Provider
PaymentService.CapturePayment --> PaymentStore.LoadPayment
PaymentStore.LoadPayment --> PaymentService.CheckCapturable
PaymentService.CheckCapturable.capturable --> ProviderService.CapturePayment
ProviderService.CapturePayment --> Provider.CapturePayment
Provider.CapturePayment --> PaymentStore.SaveCapture
PaymentService.RefundPayment --> PaymentStore.LoadPaymentWithRefunds
PaymentStore.LoadPaymentWithRefunds --> ProviderService.RefundPayment
ProviderService.RefundPayment --> Provider.RefundPayment
Provider.RefundPayment --> PaymentStore.SaveRefund
```

- 매입 요청이 오면 결제와 기존 매입 내역을 읽는다.
- 읽은 내역으로 매입이 가능한지 확인한다. 이미 매입되었거나 취소된 결제는 제외한다.
- 매입이 가능하면 제공자 서비스가 결제의 제공자 ID에 맞는 제공자를 고른다.
- 고른 제공자가 외부 대행사에 매입을 요청한다.
- 제공자의 응답으로 매입 행을 저장하고 `captured_at`을 기록한다.
- 환불 요청이 오면 결제와 기존 환불 내역을 읽는다. 한도 검사는 이보다 앞서 워크플로 단계(`validateRefundPaymentExceedsCapturedAmountStep`)에서 끝난다.
- 제공자 서비스가 환불할 제공자를 고른다.
- 제공자가 외부 대행사에 환불을 요청한다.
- 응답으로 환불 행을 저장한다. 사유와 메모도 함께 저장한다.

## P2. 결제 완료 표시와 승인 확인

- **결제 완료 표시(`markPaymentCollectionAsPaid`)**: 미결제 결제 컬렉션에 `pp_system_default`(또는 지정한 제공자)로 세션을 만든다. 이어서 `authorizePaymentSessionStep`으로 승인하고 `capturePaymentWorkflow`로 바로 매입한다. 외부 대행사는 거치지 않는다.
- **승인 확인(`authorizePaymentSessionForOrderWorkflow`)**: `pending_authorization` 상태인 세션을 다시 승인 시도한다. 승인되면 주문 거래를 기록한다. 대시보드는 응답에 담긴 세션 상태를 보고 토스트 문구를 고른다.
- **결제 컬렉션 갱신(`createOrUpdateOrderPaymentCollectionWorkflow`)**: 반품, 클레임, 교환, 편집을 확정한 뒤 미결 금액(`pending_difference`)에 따라 컬렉션을 갱신하거나, 새로 만들거나, 취소한다(분기 조건 일부는 미확인).
- **웹훅**: 외부 대행사가 보내는 비동기 결과는 `payment-webhook` 구독자가 `processPaymentWorkflow`를 실행해 처리한다. 이 경로는 주로 장바구니 완료(주문 생성)와 연결되며, 관리자 화면 흐름 밖에 있다.

## 표시 이름

대시보드는 `lib/format-provider.ts`로 제공자 ID를 화면용 이름으로 바꾼다. 예를 들어 `pp_system_default`는 "System (DEFAULT)"로 표시한다.
