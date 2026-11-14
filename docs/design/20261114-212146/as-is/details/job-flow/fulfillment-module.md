# 이행 모듈(fulfillment) 내부 Job Flow — AS-IS

`packages/modules/fulfillment`의 `FulfillmentModuleService`(`Modules.FULFILLMENT`)와 이행 제공자를 모듈 깊이에서 정리한다. 근거는 `src/services/fulfillment-module-service.ts`(createFulfillment 601-633, cancelFulfillment 1889-1907)와 core-flows의 `fulfillment/workflows/*`다.

| 그림 이름 | 구현 | 책임 |
| --- | --- | --- |
| FulfillmentService | `FulfillmentModuleService` | 이행·반품 이행 생성, 취소, 갱신의 공개 계약 |
| FulfillmentStore | 모델 `fulfillment`, `fulfillment-item`, `fulfillment-label`, `shipping-option`, `shipping-profile`, `service-zone`, `fulfillment-set` | 이행과 배송 설정 저장 |
| ProviderService | 이행 제공자 서비스 | 배송 옵션의 `provider_id`로 제공자를 골라 호출 |
| Provider | 이행 제공자 구현(기본은 fulfillment-manual) | 외부 배송사 연동(구현에 따라 다름) |

## F1. 이행 생성과 취소

```jobflow
orchestrator: FulfillmentService
Object: FulfillmentService, FulfillmentStore, ProviderService, Provider
FulfillmentService.CreateFulfillment --> FulfillmentStore.CreateFulfillmentRows
FulfillmentStore.CreateFulfillmentRows --> ProviderService.CreateFulfillment
ProviderService.CreateFulfillment --> Provider.CreateFulfillment
Provider.CreateFulfillment --> FulfillmentStore.UpdateProviderDataAndLabels
FulfillmentService.CancelFulfillment --> FulfillmentStore.LoadFulfillment
FulfillmentStore.LoadFulfillment --> FulfillmentService.CheckCancelable
FulfillmentService.CheckCancelable.cancelable --> ProviderService.CancelFulfillment
ProviderService.CancelFulfillment --> Provider.CancelFulfillment
Provider.CancelFulfillment --> FulfillmentStore.MarkCanceled
```

- 이행 생성 요청이 오면 이행, 이행 품목, 배송지 행을 먼저 저장한다.
- 그다음 제공자 서비스가 배송 옵션의 제공자에게 이행 생성을 요청한다.
- 제공자가 외부 배송사 연동을 수행한다. manual 제공자는 실질적인 외부 호출이 없다.
- 제공자가 돌려준 데이터와 라벨로 이행 행을 갱신한다. 제공자 호출이 실패하면 모듈은 생성한 행을 지운다(코드 근거: 601-633 부근, 세부 보상 방식은 미확인).
- 취소 요청이 오면 이행 행을 읽는다.
- 읽은 이행이 이미 배송되었거나 취소되었는지 확인한다.
- 취소할 수 있으면 제공자 서비스가 제공자에게 취소를 요청한다.
- 제공자가 외부 배송사에 취소를 요청한다.
- 취소가 끝나면 `canceled_at`을 기록한다.

## F2. 배송·배달 기록

- **배송(`createShipmentWorkflow`)**: `validateShipment`로 검증한 뒤 `updateFulfillmentWorkflow`가 `shipped_at`과 라벨을 저장한다. 제공자는 호출하지 않는다.
- **배달(`markFulfillmentAsDeliveredWorkflow`)**: 자체 잠금을 잡은 상태에서 `delivered_at`을 기록한다.
- **주문 쪽 기록**: 주문 모듈의 `registerShipment`와 `registerDelivery`가 주문 이력에 남긴다([order-module.md](order-module.md#o2-바로-확정되는-단축-메서드)).
- **반품 이행**: 반품, 클레임, 교환을 확정할 때 반품 배송 옵션이 있으면 `createReturnFulfillmentWorkflow`가 제공자의 `createReturnFulfillment`를 호출한다. 결과는 `return_fulfillment` 링크로 반품에 연결한다.

## 화면과의 관계

- 출고 생성 화면은 배송 옵션 목록(`GET /admin/shipping-options?stock_location_id=`)을 조회한다. 품목의 배송 프로필이 옵션의 `shipping_profile_id`와 맞는지는 화면에서 걸러 낸다.
- 반품 배송 옵션은 `is_return` 규칙이 있는 옵션만 쓴다. 대시보드는 이 필터링을 클라이언트에서 한다(서버 필터 `is_return:false`가 500 오류를 일으켜 주석 처리되어 있다).
