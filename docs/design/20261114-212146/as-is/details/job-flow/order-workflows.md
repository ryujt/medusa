# 주문워크플로(API 라우트 + core-flows) 내부 Job Flow — AS-IS

관리자 API 라우트(`packages/medusa/src/api/admin/{orders,returns,claims,exchanges,order-edits,order-changes,payments,payment-collections,reservations}`)와 `packages/core/core-flows`의 주문 관련 워크플로를 모듈 깊이에서 그린다. 라우트는 얇은 진입점이다. 미들웨어로 검증과 RBAC를 처리하고, 워크플로를 실행한 뒤, 결과를 다시 조회해 돌려준다. 라우트와 워크플로의 전체 대응은 [분석서 5.2](../../system-design-as-is.md#52-화면-논리-api와-http-계약-대응)에 있다.

| 그림 이름 | 구현 | 책임 |
| --- | --- | --- |
| Route | `route.ts` + `middlewares.ts` | 본문·쿼리 검증, `authorize([{resource, operation}])`(RBAC 모듈이 있을 때만 동작), 워크플로 실행, 결과 재조회 |
| Workflow | `createWorkflow`로 만든 각 워크플로 | 단계 순서, `when` 분기, `parallelize`, 훅, 이벤트 그룹 |
| Step | `createStep` 단계 | 모듈 메서드 호출과 보상 함수 |
| Engine | workflow-engine-inmemory 또는 workflow-engine-redis | 실행 상태를 저장하고, 실패하면 이미 끝난 단계의 보상을 역순으로 실행 |
| Lock | locking 모듈(`acquireLockStep`/`releaseLockStep`) | 주문 ID 단위 잠금 |
| EventGroup | `emitEventStep` + 이벤트버스 | 그룹 ID로 이벤트를 모아 두었다가 성공하면 내보내고, 실패하면 지움 |

## W1. 공통 실행·보상 구조

```jobflow
orchestrator: Route
Object: Route, Engine, Step, EventGroup
Route.HandleRequest --> Route.ValidateAndAuthorize
Route.ValidateAndAuthorize.denied --> Route.RespondError
Route.ValidateAndAuthorize.allowed --> Engine.RunWorkflow
Engine.RunWorkflow --> Step.Invoke
Step.Invoke --> EventGroup.Stage
Engine.RunWorkflow.succeeded --> EventGroup.Release
EventGroup.Release --> Route.RefetchAndRespond
Engine.RunWorkflow.failed --> Step.CompensateInReverse
Step.CompensateInReverse --> EventGroup.Clear
EventGroup.Clear --> Route.RespondError
```

- 요청이 들어오면 Route가 Zod 검증을 하고 RBAC 정책을 확인한다. `/admin/<자원>/*`의 와일드카드 정책은 `read` 권한을 요구한다. 쓰기 라우트는 여기에 자기 정책을 더하는 경우가 많다(예: `order:update`).
- 검증이나 권한에서 거절되면 400 또는 403 오류로 응답한다.
- 통과하면 Engine이 워크플로를 실행한다.
- Engine은 단계를 순서대로, 또는 병렬로 실행한다.
- 단계에서 발행한 이벤트는 바로 나가지 않고 `eventGroupId`로 모아 둔다.
- 워크플로가 성공하면 모아 둔 이벤트를 이벤트버스로 내보낸다(`releaseGroupedEvents`).
- 그다음 Route가 결과를 다시 조회해 응답한다. 대부분의 쓰기 라우트는 주문이나 변경 미리보기를 돌려준다.
- 실패하면 Engine이 끝난 단계들의 보상을 역순으로 실행한다.
- 보상이 끝나면 모아 둔 이벤트를 지운다.
- 마지막으로 MedusaError 유형에 따라 HTTP 오류로 응답한다(`NOT_ALLOWED`, `INVALID_DATA`는 400, `NOT_FOUND`는 404).

## W2. 출고 생성 워크플로(createOrderFulfillmentWorkflow)

```jobflow
orchestrator: Workflow
Object: Workflow, Step, Engine
Workflow.Run --> Step.QueryOrder
Step.QueryOrder --> Step.CreateFulfillmentValidateOrder
Step.CreateFulfillmentValidateOrder.invalid --> Engine.FailWorkflow
Step.CreateFulfillmentValidateOrder.valid --> Step.QueryShippingOptionAndReservations
Step.QueryShippingOptionAndReservations --> Step.CreateFulfillmentInFulfillmentModule
Step.CreateFulfillmentInFulfillmentModule --> Step.AdjustInventoryLevels
Step.AdjustInventoryLevels --> Step.RegisterOrderFulfillmentAndLinkAndReservations
Step.RegisterOrderFulfillmentAndLinkAndReservations --> Step.EmitFulfillmentCreated
Step.EmitFulfillmentCreated --> Workflow.Run.result
```

- 워크플로가 시작되면 주문, 품목, 배송 방법을 조회한다.
- 조회한 데이터로 주문을 검증한다. 취소 여부, 수량 범위, 배송 필요 여부 등을 본다.
- 검증에 실패하면 워크플로가 실패하고, 화면은 오류 토스트를 받는다.
- 통과하면 배송 옵션과 기존 예약을 조회한다.
- 이행 모듈에 이행 생성을 맡긴다. 이 단계는 하위 워크플로 `createFulfillmentWorkflow`로 실행되며, 제공자 호출도 여기서 일어난다.
- 재고 수준을 조정한다.
- 이어서 주문 이행 등록(보상 가능), `order_fulfillment` 링크, 예약 갱신·삭제를 병렬로 처리한다.
- 마지막으로 `order.fulfillment_created`와 재고·예약 이벤트를 발행하고 결과를 돌려준다. 확장 지점으로 `fulfillmentCreated` 훅이 있다. 이 워크플로는 잠금을 쓰지 않는다.

## W3. 잠금을 쓰는 워크플로

| 워크플로 | 잠금 키 | 근거 |
| --- | --- | --- |
| beginOrderEditOrderWorkflow / requestOrderEditRequestWorkflow / confirmOrderEditRequestWorkflow / cancelBeginOrderEditWorkflow | `order_id` | `order-edit/*.ts` |
| markOrderFulfillmentAsDeliveredWorkflow | `order_id` (timeout 2, ttl 10) | `mark-order-fulfillment-as-delivered.ts` |
| completeCartWorkflow, convertDraftOrderWorkflow (주문 생성 경계) | 장바구니 또는 드래프트 ID | `complete-cart.ts`, `convert-draft-order.ts` |

출고, 배송, 출고 취소, 주문 취소, 반품, 클레임, 교환, 매입, 환불 워크플로는 잠금을 쓰지 않는다. 동시에 들어온 요청은 주문 모듈의 진행 중 변경 검사와 각 검증 단계에 기대어 처리된다.

## W4. 조회 시 상태 계산

- `getOrderDetailWorkflow`와 `getOrdersListWorkflow`는 주문을 조회한 뒤 `getLastPaymentStatus`와 `getLastFulfillmentStatus`(`core-flows/src/order/utils/aggregate-status.ts`)로 `payment_status`와 `fulfillment_status`를 계산해 응답에 넣는다.
- 결제 상태는 다음 우선순위로 정한다: requires_action, (partially_)refunded, (partially_)captured, (partially_)authorized, canceled, awaiting, not_paid.
- 이행 상태는 이행의 `canceled_at`, `delivered_at`, `shipped_at`, `packed_at` 값에서 (partially_)delivered, shipped, fulfilled, canceled, not_fulfilled 중 하나로 정한다.
- 대시보드의 상태 배지는 이 계산 결과를 그대로 쓴다.

## W5. 보상이 없는 단계와 재생 처리

- `capturePaymentStep`과 `refundPaymentStep`에는 보상이 없다. 제공자 쪽에서 돈이 이미 움직였을 수 있어서다. 그래서 뒤 단계(거래 기록 등)가 실패하면 결제와 주문 거래 기록이 서로 어긋날 수 있다(관찰 위험).
- 환불 워크플로는 같은 환불이 이미 있는지 확인해 재생 여부를 판단한다. 재생이면 제공자 호출과 이벤트 발행을 건너뛴다.
- 내보내기 워크플로는 `async: true, backgroundExecution: true`로 실행한다. 업로드 단계의 보상은 업로드한 파일을 지운다.
