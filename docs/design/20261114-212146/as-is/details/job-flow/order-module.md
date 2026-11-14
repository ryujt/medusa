# 주문 모듈(order) 내부 Job Flow — AS-IS

`packages/modules/order`의 `OrderModuleService`(`Modules.ORDER`)를 모듈 깊이에서 그린다. 근거는 `src/services/order-module-service.ts`, `src/utils/apply-order-changes.ts`, `src/utils/calculate-order-change.ts`, `src/utils/base-repository-find.ts`, 그리고 이 패키지의 `AGENTS.md`다.

| 그림 이름 | 구현 | 책임 |
| --- | --- | --- |
| OrderService | `OrderModuleService` (공개 메서드, `@InjectManager`·`@InjectTransactionManager`) | 공개 계약의 진입점이자 트랜잭션 경계 |
| ChangeStore | `orderChangeService_`, `orderChangeActionService_` | 주문 변경과 그 액션을 저장 |
| Calculator | `calculateOrderChange` | 대기 중인 액션을 메모리에서 적용해 미리보기와 합계를 계산 |
| Applier | `applyChangesToOrder` | 버전이 붙은 행(`OrderItem`, `OrderShipping`, `OrderSummary`, 거래, 크레딧 라인 등)을 upsert하고 `Order.version`을 1 올림 |
| VersionedRepo | `base-repository-find.ts` | 읽을 때 기본으로 현재 버전 행만 골라 냄 |

## O1. 주문 변경 수명주기

```jobflow
orchestrator: OrderService
Object: OrderService, ChangeStore, Calculator, Applier, VersionedRepo
OrderService.CreateOrderChange --> ChangeStore.FindActiveChange
ChangeStore.FindActiveChange.exists --> OrderService.RejectActiveChange
ChangeStore.FindActiveChange.none --> ChangeStore.CreateChange
OrderService.AddOrderAction --> ChangeStore.CreateAction
OrderService.PreviewOrderChange --> VersionedRepo.LoadCurrentVersion
VersionedRepo.LoadCurrentVersion --> Calculator.ApplyPendingActions
OrderService.ConfirmOrderChange --> ChangeStore.MarkConfirmed
ChangeStore.MarkConfirmed --> Applier.ApplyChangesToOrder
OrderService.UndoLastChange --> Applier.RevertLastVersion
```

- 변경을 만들 때 OrderService는 먼저 같은 주문에 `pending`이나 `requested` 상태의 변경이 있는지 ChangeStore에 물어본다.
- 진행 중인 변경이 이미 있으면 `Order (...) already has an existing active order change`로 거절한다. 반품, 클레임, 교환, 편집, 이전이 한 주문에서 동시에 진행되지 못하는 것은 이 규칙 때문이다.
- 진행 중인 변경이 없으면 현재 주문 버전에 1을 더한 `version`으로 변경을 저장한다.
- 액션(품목 추가, 반품 품목, 배송 추가 등)이 들어오면 ChangeStore에 액션 행으로 쌓는다. 대시보드의 반품, 클레임, 교환, 편집 화면에서 값을 하나 바꿀 때마다 이 단계가 한 번씩 실행된다.
- 미리보기를 요청하면 VersionedRepo가 현재 버전의 주문을 읽는다.
- Calculator가 아직 적용되지 않은 액션을 메모리에서 적용해 미리보기와 합계(`pending_difference` 등)를 만든다. 이 결과는 저장하지 않는다.
- 확정을 요청하면 OrderService가 변경 상태를 `confirmed`로 바꾼다.
- 이어서 Applier가 새 버전의 행을 upsert하고 새 `OrderSummary`를 만든 뒤 `Order.version`을 1 올린다. 이전 버전 행은 지우지 않고 남겨 두므로 이력이 된다.
- 되돌리기를 요청하면 마지막 버전을 롤백한다. 워크플로가 `confirmOrderChanges` 단계를 보상할 때 이 경로를 쓰며, 버전이 2 이상일 때만 가능하다.
- `declineOrderChange`와 `cancelOrderChange`는 상태만 바꾼다. 다만 관리자 화면의 취소 경로(반품·클레임·교환·편집 드래프트 취소, 이전 요청 취소)는 워크플로가 변경 자체를 **삭제**하는 방식으로 구현되어 있다.

## O2. 바로 확정되는 단축 메서드

`registerFulfillment`, `registerShipment`, `registerDelivery`, `cancelFulfillment`, `createReturn`, `receiveReturn`, `createClaim`, `createExchange`, `cancel`, `completeOrder`, `archive`는 변경과 액션(`FULFILL_ITEM`, `SHIP_ITEM`, `DELIVER_ITEM` 등)을 만든 직후 바로 확정한다(`src/services/actions/`). 따라서 출고·배송·배달·취소 같은 작업에도 주문 버전과 이력이 남는다. 반면 이메일과 주소 수정은 `registerOrderChange`로 이미 적용된 `update_order` 변경을 기록하는 방식이다.

## 소유 데이터와 규칙

- `OrderLineItem`은 상품 스냅샷과 가격을 담으며 바뀌지 않는다. `OrderItem`은 버전마다 따로 저장되며 수량 필드(`fulfilled/shipped/delivered/return_requested/return_received/...`)를 가진다.
- 수량이나 버전을 직접 수정하지 않는다. 반드시 액션을 추가하고 변경을 확정해야 합계와 이력이 맞는다(AGENTS.md Gotchas).
- 결제 상태와 이행 상태는 주문 모듈이 저장하지 않는다. 읽을 때 core-flows의 `getLastPaymentStatus`/`getLastFulfillmentStatus`가 계산한다([order-workflows.md](order-workflows.md#w4-조회-시-상태-계산)).
- 변경 유형은 `OrderChangeType` 열거형(return_request, return_receive, exchange, claim, edit, credit_line)에 정의되어 있다. 그런데 워크플로는 열거형에 없는 문자열 `"transfer"`와 `"update_order"`도 쓴다(관찰 이슈).
