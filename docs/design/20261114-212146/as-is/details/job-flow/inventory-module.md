# 재고 모듈(inventory) 내부 Job Flow — AS-IS

`packages/modules/inventory`(`Modules.INVENTORY`)와 위치 정보(`stock-location`)를 주문 영역에서 쓰는 범위에 한해 모듈 깊이에서 정리한다. 근거는 core-flows의 `adjustInventoryLevelsStep`, `reserveInventoryStep`, `deleteReservationsByLineItemsStep`, `createReservationsWorkflow`와 관리자 `/admin/reservations` 라우트다.

| 그림 이름 | 구현 | 책임 |
| --- | --- | --- |
| InventoryService | `InventoryModuleService` | 재고 항목, 위치별 재고 수준, 예약 관리 |
| LevelStore | 모델 `inventory-level` | 위치별 `stocked_quantity`, `reserved_quantity`, `available_quantity` |
| ReservationStore | 모델 `reservation-item` | 품목·재고 항목·위치 단위의 예약 |

## I1. 예약과 재고 조정

```jobflow
orchestrator: InventoryService
Object: InventoryService, ReservationStore, LevelStore
InventoryService.CreateReservationItems --> LevelStore.CheckAvailability
LevelStore.CheckAvailability.sufficient --> ReservationStore.InsertReservations
LevelStore.CheckAvailability.insufficient --> InventoryService.RejectReservation
ReservationStore.InsertReservations --> LevelStore.IncreaseReservedQuantity
InventoryService.AdjustInventory --> LevelStore.UpdateStockedQuantity
InventoryService.DeleteReservationsByLineItem --> ReservationStore.DeleteReservations
ReservationStore.DeleteReservations --> LevelStore.DecreaseReservedQuantity
```

- 예약 생성 요청이 오면 먼저 해당 위치에 재고가 충분한지 확인한다. 이 요청은 재고 할당 화면(`POST /admin/reservations`), 클레임·교환·편집 확정, 장바구니 완료에서 들어온다.
- 재고가 충분하면 예약 행을 저장한다.
- 재고가 부족하면 거절한다. 재고 할당 화면에서는 이 거절이 그 품목의 실패 목록에 들어가 토스트로 나타난다.
- 예약을 저장하면 같은 위치의 예약 수량이 늘어난다.
- 출고를 생성하거나 수령을 확정하면 위치의 보유 재고 수량을 줄이거나 늘린다. 반품 수령에서 재입고되는 것은 손상되지 않은 수량뿐이다.
- 주문을 취소하거나 편집을 확정하면 품목 단위로 예약을 지운다.
- 예약을 지우면 예약 수량이 줄어든다.

## 화면과의 관계

- 주문 상세의 Allocated/Not allocated 배지와 Allocate items 버튼은 `GET /admin/reservations?line_item_id=...` 결과로 결정한다.
- 출고 생성과 재고 할당 화면의 Available/In stock 값은 변형의 `inventory.location_levels`를 화면에서 계산한 것이다. 재고 키트는 `required_quantity`로 나눠서 계산한다.
- 재고 할당 화면은 예약 요청을 품목마다 따로, 병렬로 보낸다. 하나의 트랜잭션으로 묶이지 않으므로 일부만 성공할 수 있다(코드에 일괄 엔드포인트 TODO가 있다).
