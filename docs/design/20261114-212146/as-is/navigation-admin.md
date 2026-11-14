# 주문 관리 Navigation — 관리자(Admin) 대시보드 AS-IS

## 범위·확인 기준

- 대상 UI: Medusa 관리자 대시보드의 `/orders` 라우트 트리 전체. 목록, 내보내기, 상세, 상세 아래 하위 작업 화면 14개, 모두 17개 페이지다. 페이지와 장면 목록의 원본은 [screen-layout.md](screen-layout.md#페이지장면-목록)다.
- 기준선: 커밋 `01de0be27a`(develop)이며 작업 트리에 변경이 없다. 근거는 코드를 직접 읽어 확인했고, 앱을 실행해 관찰하지는 않았다. 확인한 내용과 추론·미확인을 구분한 기록과 근거 파일은 [분석서의 조사 근거](system-design-as-is.md#7-조사-근거검증미확인)에 모았다.
- 하위 작업 화면은 모두 상세 페이지 위에 겹쳐 뜨는 라우트 모달(FocusModal)이나 드로어(Drawer)다.
  - 닫기(X, Esc, Cancel)를 누르면 `/orders/:id`로 `replace` 이동한다. 이때 `useStateAwareTo`가 현재 query를 그대로 붙이므로 `?paymentId=`, `?requires_shipping=` 같은 값이 상세 URL에 남는다. 내보내기 드로어는 `/orders?...`로 돌아간다.
  - 제출에 성공하면 `handleSuccess()`로 상세로 돌아오고, 쿼리를 무효화해 상세 데이터를 다시 불러온다.
- 각 라우트는 `handle.permissions`로 권한을 검사한다. 이 검사는 RBAC 모듈이 설치된 경우에만 적용된다. 권한이 없으면 `/orders` 아래 Outlet 전체가 `AccessDenied` 카드로 바뀐다([N25](#n25)).
- 상세 페이지에서 범위 밖 화면으로 나가는 링크도 있다. 고객 이름은 `/customers/:id`로, Fulfillment 카드의 Shipping from은 `/settings/locations/:id`로 이동한다. 이메일·전화·주소의 Copy 버튼은 클립보드에 복사만 한다.
- 다이어그램의 논리 API 이름과 실제 HTTP 계약의 대응은 [분석서 5.2](system-design-as-is.md#52-화면-논리-api와-http-계약-대응)에 정리했다.
- 범위 밖: 고객·설정(위치, 배송 옵션)·사용자 페이지로 이동한 뒤의 도착 화면, 스토어프런트, 드래프트 주문 화면.

<a id="n01"></a>
## N01. 주문 목록 조회·검색·필터와 상세 진입

```navigation
(route_guard) --> OrderList : order:read 있음
(route_guard) --> OrderList(AccessDenied) : 권한 없음
OrderList --> (/orders)
(/orders) --> OrderList(Loading) : 응답 대기
(/orders) --> OrderList : 결과 있음
(/orders) --> OrderList(Empty) : 주문 0건 및 조건 없음
(/orders) --> OrderList(NoResults) : 검색·필터 결과 없음
(/orders) --> OrderList(Error) : 요청 오류
OrderList --> (/orders) : 검색·필터·정렬·페이지 변경
OrderList --> OrderDetail : 행 클릭
OrderDetail --> OrderList : 브레드크럼 Orders
```

- 목록에 들어오는 경로는 세 가지다. `order:read`가 있을 때 보이는 사이드바 Orders 메뉴, 로그인 후 홈(`/`)에서의 리다이렉트(기본 랜딩 경로 첫 번째가 `/orders`), 전역 검색 단축키 `G` 다음 `O`다.
- 검색어, 필터(Region, Sales Channel, Created, Updated), 정렬, 페이지(20건)는 URL query에 저장된다. 이 값이 바뀌면 이전 데이터를 화면에 둔 채 다시 조회한다(`keepPreviousData`).
- 상세의 브레드크럼으로 목록에 돌아오면 셸이 기억해 둔 query 문자열을 복원하므로 필터가 그대로 남는다.
- 결과에 따른 화면:
  - 주문이 0건이면 `Empty`가 되고 툴바(검색·필터)도 숨는다.
  - 조건에 맞는 결과가 없으면 `NoResults`가 되고, 툴바는 남는다.
  - 요청이 실패하면 `/orders` 라우트의 ErrorBoundary가 화면을 대신한다.
- 결제 상태·이행 상태 필터는 코드에서 주석 처리되어 있어 제공하지 않는다.
- `view_configurations` 기능 플래그를 켜면 설정형 테이블로 바뀐다. 이 변형은 Layout 설명에만 기록했다.

### 화면 확인 링크

| 페이지·장면 | 화면 HTML | Layout |
| --- | --- | --- |
| 주문 목록 · 로딩 · 빈 목록 · 결과 없음 · 오류 · 권한 거부 | [기본](details/screens/order-list.html#default) · [로딩](details/screens/order-list.html#loading) · [빈 목록](details/screens/order-list.html#empty) · [결과 없음](details/screens/order-list.html#no-results) · [오류](details/screens/order-list.html#error) · [권한 거부](details/screens/order-list.html#access-denied) | [주문 목록 배치](screen-layout.md#order-list) |
| 주문 상세 · 기본 | [기본](details/screens/order-detail.html#default) | [주문 상세 배치](screen-layout.md#order-detail) |

<a id="n02"></a>
## N02. 주문 목록 CSV 내보내기

```navigation
OrderList --> OrderExport : Export 클릭
OrderExport --> OrderList : Cancel 또는 닫기
OrderExport --> (/orders/export) : Export
(/orders/export) --> OrderList(ExportStarted) : 202 접수
(/orders/export) --> OrderExport(Failed) : 오류
```

- Export 링크는 현재 목록의 query를 그대로 붙여 `/orders/export?...`를 연다. 드로어 본문에는 적용 중인 필터가 읽기 전용으로 보인다.
- 서버는 202와 `transaction_id`를 돌려주고, CSV는 백그라운드 워크플로가 만든다.
  - 화면은 info 토스트 "Export started"를 띄우고 목록으로 돌아간다. 이 시점은 파일이 완성된 때가 아니라 요청이 접수된 때다.
  - 완료 알림은 알림(feed) 채널로 온다. 알림 드로어에서 파일을 내려받는 경로는 확인하지 못했다.
- Export 버튼에는 처리 중 비활성 상태가 없어 두 번 누를 수 있다(관찰 이슈).

### 화면 확인 링크

| 페이지·장면 | 화면 HTML | Layout |
| --- | --- | --- |
| 주문 목록 · 내보내기 접수 토스트 | [기본](details/screens/order-list.html#default) · [내보내기 접수](details/screens/order-list.html#export-started) | [주문 목록 배치](screen-layout.md#order-list) |
| 주문 내보내기 · 실패 | [기본](details/screens/order-export.html#default) · [실패](details/screens/order-export.html#failed) | [주문 내보내기 배치](screen-layout.md#order-export) |

<a id="n03"></a>
## N03. 주문 상세 진입(직접 URL·새로고침 포함)

```navigation
(detail_loader) --> OrderDetail(AccessDenied) : RBAC 설치 및 order:read 없음
(detail_loader) --> (/orders/id)
(/orders/id) --> OrderDetail(NotFound) : 없는 주문 또는 오류
(/orders/id) --> (/orders/id/preview) : 조회 성공
(/orders/id/preview) --> OrderDetail(Loading) : 미리보기 대기
(/orders/id/preview) --> OrderDetail : 조회 완료
(/orders/id/preview) --> OrderDetail(Canceled) : 취소된 주문
(/orders/id/preview) --> OrderDetail(ActiveChange) : 진행 중 변경 있음
```

- 목록 행, 전역 검색 결과, 고객 상세의 주문 표, 하위 작업 화면에서의 복귀가 모두 `/orders/:id`로 들어온다. 북마크로 열거나 새로고침해도 같은 로더가 먼저 실행된다.
- 로더는 주문을 미리 불러오고, 권한 로더가 그 바깥을 감싼다.
  - RBAC가 설치되어 있는데 `order:read`가 없으면 `PermissionError`가 발생하고, ErrorBoundary가 AccessDenied를 그린다.
  - 401 응답이면 `/login`으로 리다이렉트한다(그림에서는 생략).
- 화면은 주문 상세와 주문 변경 미리보기(`preview`)가 모두 도착해야 그려진다. 미리보기의 `order_change`에 따라 상단에 진행 중인 반품·클레임·교환·편집 배너가 붙는다(`ActiveChange`, [N14](#n14), [N17](#n17), [N18](#n18), [N19](#n19)).
- 섹션 단위 권한(Payments, Fulfillment, Customer 등)이 없으면 대체 표시 없이 그 섹션만 빠진다. 화면 이동은 일어나지 않는다.

### 화면 확인 링크

| 페이지·장면 | 화면 HTML | Layout |
| --- | --- | --- |
| 주문 상세 · 로딩 · 404 · 권한 거부 · 취소된 주문 · 진행 중 반품 | [기본](details/screens/order-detail.html#default) · [로딩](details/screens/order-detail.html#loading) · [404](details/screens/order-detail.html#not-found) · [권한 거부](details/screens/order-detail.html#access-denied) · [취소됨](details/screens/order-detail.html#canceled) · [진행 중 반품](details/screens/order-detail.html#return-active) | [주문 상세 배치](screen-layout.md#order-detail) |

<a id="n04"></a>
## N04. 주문 취소

```navigation
OrderDetail --> OrderDetail(GeneralMenu) : General 메뉴 열기
OrderDetail(GeneralMenu) --> OrderDetail(CancelPrompt) : Cancel
OrderDetail(CancelPrompt) --> OrderDetail : Cancel 버튼
OrderDetail(CancelPrompt) --> (/orders/cancel) : Continue
(/orders/cancel) --> OrderDetail(Canceled) : 성공
(/orders/cancel) --> OrderDetail : 오류 토스트
```

- 메뉴는 `order:update`가 있을 때만 보인다. 이미 취소된 주문에서는 Cancel 항목이 비활성이다.
- 서버의 `cancelValidateOrder`는 완료된 주문과, 취소되지 않은 이행이 남은 주문을 거절한다. 이 오류는 토스트로 표시되고 화면은 그대로 남는다. 이행을 먼저 취소해야 하는 경우는 [N09](#n09)로 이어진다.
- 성공하면 토스트 "Order canceled successfully"가 뜨고 같은 페이지가 다시 그려진다.
  - 빨간 Canceled 배지가 붙는다.
  - Unfulfilled Items 카드가 사라지고 Edit order가 비활성이 된다.
  - 활동에 "Order canceled"가 추가된다.
  - 서버는 매입된 결제를 환불하고, 매입되지 않은 결제는 취소한다.

### 화면 확인 링크

| 페이지·장면 | 화면 HTML | Layout |
| --- | --- | --- |
| 주문 상세 · General 메뉴 · 취소 확인 · 취소됨 | [기본](details/screens/order-detail.html#default) · [General 메뉴](details/screens/order-detail.html#menu-general) · [취소 확인](details/screens/order-detail.html#cancel-prompt) · [취소됨](details/screens/order-detail.html#canceled) | [주문 상세 배치](screen-layout.md#order-detail) |

<a id="n05"></a>
## N05. 품목 출고(Fulfillment 생성)

```navigation
OrderDetail(UnfulfilledMenu) --> OrderCreateFulfillment : Fulfill items
OrderCreateFulfillment --> (/orders/id/fulfillment_prefill)
(/orders/id/fulfillment_prefill) --> OrderCreateFulfillment(Loading) : 주문 대기
(/orders/id/fulfillment_prefill) --> OrderCreateFulfillment : 위치·배송방법 자동 선택
(/orders/id/fulfillment_prefill) --> OrderCreateFulfillment(NoOption) : 고객 배송방법에 옵션 없음
(/orders/id/fulfillment_prefill) --> OrderCreateFulfillment(NoItems) : 출고할 품목 없음
OrderCreateFulfillment --> OrderCreateFulfillment(MethodChanged) : 고객 선택과 다른 배송방법
OrderCreateFulfillment --> OrderCreateFulfillment(ProfileMismatch) : 배송 프로필 불일치 품목
OrderCreateFulfillment --> (validate_fulfillment) : Create Fulfillment
(validate_fulfillment) --> OrderCreateFulfillment(QtyError) : 수량 범위 오류
(validate_fulfillment) --> (/orders/fulfillments) : 통과
(/orders/fulfillments) --> OrderDetail(ToastSuccess) : 성공
(/orders/fulfillments) --> OrderCreateFulfillment(Failed) : 오류
OrderCreateFulfillment --> OrderDetail : Cancel 또는 닫기
OrderCreateFulfillment --> OrderCreateFulfillment(LeavePrompt) : 입력 변경 후 닫기
```

- 상세의 Unfulfilled Items 카드는 배송이 필요한 품목과 필요 없는 품목으로 나뉜다. 카드 메뉴의 Fulfill items는 `?requires_shipping=true|false`를 붙여 이 화면을 연다. 메뉴는 `fulfillment:create`와 `order:update` 권한이 있고 주문이 취소되지 않았을 때만 보인다.
- 고객이 고른 배송 옵션이 있으면 그 값으로 위치와 배송방법을 미리 채운다.
  - 옵션이 없으면 아무것도 채우지 않으며(`NoOption`), 이 상태에서는 제출이 비활성이다.
  - 위치를 고르기 전에는 배송방법을 선택할 수 없다.
- 오류 표시 방식:
  - 수량 오류는 입력란 아래에 인라인으로 표시한다.
  - "No items to fulfill."은 제출 때가 아니라 화면에 들어오자마자 오류 Alert로 표시한다. 출고할 품목이 0개이면 `useEffect`가 root 오류를 설정한다. 이때 제출 버튼은 비활성이 되지 않는다.
  - 제출할 때 하는 검사는 배송방법과 위치가 비었는지와 수량 범위뿐이다.
  - 서버 오류는 토스트로만 알리고 모달은 열린 채 남는다.
- 성공하면 토스트 "Fulfillment created successfully"와 함께 상세로 돌아오고, 상세에 Fulfillment #N 카드(Awaiting shipping)가 생긴다. 재고 조정과 예약 갱신은 서버 워크플로가 맡는다.

### 화면 확인 링크

| 페이지·장면 | 화면 HTML | Layout |
| --- | --- | --- |
| 주문 상세 · 미출고 메뉴 · 성공 토스트 | [기본](details/screens/order-detail.html#default) · [미출고 메뉴](details/screens/order-detail.html#menu-unfulfilled) · [성공 토스트](details/screens/order-detail.html#toast-success) | [주문 상세 배치](screen-layout.md#order-detail) |
| 출고 생성 · 로딩 · 배송방법 미지정 · 배송방법 변경 경고 · 프로필 불일치 · 수량 오류 · 품목 없음 · 실패 · 이탈 확인 | [기본](details/screens/order-create-fulfillment.html#default) · [로딩](details/screens/order-create-fulfillment.html#loading) · [배송방법 미지정](details/screens/order-create-fulfillment.html#no-option) · [배송방법 변경](details/screens/order-create-fulfillment.html#method-changed) · [프로필 불일치](details/screens/order-create-fulfillment.html#profile-mismatch) · [수량 오류](details/screens/order-create-fulfillment.html#qty-error) · [품목 없음](details/screens/order-create-fulfillment.html#no-items) · [실패](details/screens/order-create-fulfillment.html#failed) · [이탈 확인](details/screens/order-create-fulfillment.html#leave-prompt) | [출고 생성 배치](screen-layout.md#order-create-fulfillment) |

<a id="n06"></a>
## N06. 재고 할당(예약 생성)

```navigation
OrderDetail --> OrderAllocateItems : Allocate items
OrderAllocateItems --> OrderAllocateItems(LocationSelected) : 위치 선택
OrderAllocateItems(LocationSelected) --> OrderAllocateItems(OverAllocation) : 가용 수량 초과 입력
OrderAllocateItems(LocationSelected) --> OrderAllocateItems(KitExpanded) : 키트 펼치기
OrderAllocateItems(LocationSelected) --> (validate_allocation) : Allocate items
(validate_allocation) --> OrderAllocateItems(UnallocatedError) : 빈 수량 있음
(validate_allocation) --> (/reservations) : 통과
(/reservations) --> OrderDetail : 모두 성공
(/reservations) --> OrderAllocateItems(PartialFailure) : 일부 실패
OrderAllocateItems --> OrderDetail : Cancel 또는 닫기
```

- Summary 하단 액션바의 Allocate items 버튼으로 들어온다. 버튼은 `reservation_item:create` 권한이 있고, 재고를 관리하면서 아직 출고되지 않았고 예약도 없는 품목이 하나라도 있을 때만 보인다.
- 위치를 고르기 전에는 수량 입력과 제출이 비활성이다. 입력한 수량이 위치의 가용량을 넘으면 그 행에 빨간 표시가 붙고 제출이 막힌다.
- 제출하면 품목×재고 항목마다 `POST /admin/reservations`를 병렬로 보낸다. 이 요청들은 하나의 트랜잭션이 아니다.
- 결과와 관계없이 상세로 이동한다.
  - 성공 토스트는 없다. 번역 키는 있지만 쓰이지 않는다.
  - 일부가 실패하면 이동한 뒤 "Failed to allocate following items: ..." 오류 토스트가 뜬다(HTML `partial-failure` 장면).

### 화면 확인 링크

| 페이지·장면 | 화면 HTML | Layout |
| --- | --- | --- |
| 주문 상세 · 기본 | [기본](details/screens/order-detail.html#default) | [주문 상세 배치](screen-layout.md#order-detail) |
| 재고 할당 · 위치 선택 · 초과 할당 · 키트 펼침 · 미입력 오류 · 일부 실패 · 로딩 | [기본](details/screens/order-allocate-items.html#default) · [위치 선택](details/screens/order-allocate-items.html#location-selected) · [초과 할당](details/screens/order-allocate-items.html#over-allocation) · [키트 펼침](details/screens/order-allocate-items.html#kit-expanded) · [미입력 오류](details/screens/order-allocate-items.html#unallocated-error) · [일부 실패](details/screens/order-allocate-items.html#partial-failure) · [로딩](details/screens/order-allocate-items.html#loading) | [재고 할당 배치](screen-layout.md#order-allocate-items) |

<a id="n07"></a>
## N07. 배송 처리(Mark as shipped)

```navigation
OrderDetail(Fulfilled) --> OrderCreateShipment : Mark as shipped
OrderCreateShipment --> OrderCreateShipment(WithRows) : Add tracking number
OrderCreateShipment --> (/orders/fulfillments/shipments) : Save
OrderCreateShipment(WithRows) --> (/orders/fulfillments/shipments) : Save
(/orders/fulfillments/shipments) --> OrderDetail(Shipped) : 성공
(/orders/fulfillments/shipments) --> OrderCreateShipment(Failed) : 오류
OrderCreateShipment --> OrderDetail(Fulfilled) : Cancel 또는 닫기
```

- Fulfillment 카드 하단의 Mark as shipped 버튼으로 들어온다. 버튼은 다음 조건을 모두 만족할 때 보인다.
  - 이행을 관리할 권한이 있다.
  - 이행이 취소·배송·배달되지 않았다.
  - 배송이 필요한 이행이다.
  - 픽업 이행이 아니다.
- 추적 행을 하나도 추가하지 않아도 저장할 수 있다. 이 경우 기존 라벨만 보낸다. URL 형식은 검사하지 않고, 빈 URL은 `"#"`로 채운다.
- 성공하면 토스트 "Shipment created successfully."와 함께 상세로 돌아온다. 카드 상태가 Shipped가 되고 Tracking 링크가 보인다.
- 없는 `:f_id`로 직접 들어와도 폼은 그려지지만, 제출하면 실패한다(서버 응답은 미확인).

### 화면 확인 링크

| 페이지·장면 | 화면 HTML | Layout |
| --- | --- | --- |
| 주문 상세 · 이행 카드 · 배송됨 | [이행 카드](details/screens/order-detail.html#fulfilled) · [배송됨](details/screens/order-detail.html#shipped) | [주문 상세 배치](screen-layout.md#order-detail) |
| 배송 처리 · 추적 행 · 실패 · 로딩 | [기본](details/screens/order-create-shipment.html#default) · [추적 행](details/screens/order-create-shipment.html#with-rows) · [실패](details/screens/order-create-shipment.html#failed) · [로딩](details/screens/order-create-shipment.html#loading) | [배송 처리 배치](screen-layout.md#order-create-shipment) |

<a id="n08"></a>
## N08. 배달·픽업 완료 처리

이 과업에서는 페이지 이동이 없다.

- Fulfillment 카드 하단의 "Mark as delivered" 버튼을 누르면 확인 프롬프트가 열린다. 픽업 이행에서는 버튼 문구가 "Mark as picked up"이다.
- 이 버튼은 관리 권한이 있고 이행이 취소·배달되지 않았으면 보인다. 아직 배송(shipped) 전이어도 보인다.
- 프롬프트에는 "Send notification" 스위치가 있으며 기본값은 `!order.no_notification`이다.
- Continue를 누르면 `POST /admin/orders/:id/fulfillments/:fid/mark-as-delivered`를 보낸다.
  - 성공하면 토스트 "Fulfillment marked as delivered successfully"(픽업은 "Fulfillment marked as picked up successfully")가 뜨고 카드가 Delivered가 된다.
  - 실패하면 오류 토스트가 뜨고 상태는 바뀌지 않는다.
- Cancel을 누르면 프롬프트만 닫힌다.
- 서버 워크플로는 주문 ID로 잠금을 잡고 처리한다.

### 화면 확인 링크

| 페이지·장면 | 화면 HTML | Layout |
| --- | --- | --- |
| 주문 상세 · 이행 카드 · 배달 확인 프롬프트 | [이행 카드](details/screens/order-detail.html#fulfilled) · [배달 확인](details/screens/order-detail.html#deliver-prompt) | [주문 상세 배치](screen-layout.md#order-detail) |

<a id="n09"></a>
## N09. 출고 취소

이 과업에서는 페이지 이동이 없다.

- Fulfillment 카드의 ⋯ 메뉴에서 Cancel을 고른다. 메뉴는 `fulfillment:update`와 `order:update` 권한이 있을 때 보인다. 이미 취소·배송·배달된 이행에서는 항목이 비활성이다.
- 코드에는 배송된 이행이면 경고 토스트 "Cannot cancel an already shipped fulfillment"를 띄우는 분기가 있다. 하지만 메뉴 항목이 `shipped_at`일 때 이미 비활성이므로 이 분기에 도달하는 경로가 없다(도달 불가 코드).
- 메뉴에서 Cancel을 누르면 위험 프롬프트 "You are about to cancel a fulfillment. This action cannot be undone."를 띄운다.
  - Continue를 누르면 `POST .../fulfillments/:fid/cancel`을 보낸다.
  - 성공하면 토스트 "Fulfillment successfully canceled"가 뜬다. 카드는 Canceled 상태가 되고, 출고하지 않은 수량은 Unfulfilled Items 카드로 돌아간다.
- 서버는 재고를 되돌리고 예약을 다시 만든 뒤 이행 제공자에게 취소를 요청한다.

### 화면 확인 링크

| 페이지·장면 | 화면 HTML | Layout |
| --- | --- | --- |
| 주문 상세 · 이행 메뉴 · 이행 취소 확인 | [이행 카드](details/screens/order-detail.html#fulfilled) · [이행 메뉴](details/screens/order-detail.html#menu-fulfillment) · [이행 취소 확인](details/screens/order-detail.html#cancel-fulfillment-prompt) | [주문 상세 배치](screen-layout.md#order-detail) |

<a id="n10"></a>
## N10. 결제 매입(Capture)

이 과업에서는 페이지 이동이 없다.

- Payments 섹션의 결제 행 아래에 "Payment ... is ready to be captured." 줄과 Capture payment 버튼이 있다. 이 줄은 다음 조건을 모두 만족할 때만 보인다.
  - `capture:create`와 `order:update` 권한이 있다.
  - 결제가 아직 매입되지 않았고 취소되지도 않았다.
- 버튼을 누르면 확인 프롬프트 "Payment of $100.00 will be captured."가 열린다. Confirm을 누르면 `POST /admin/payments/:pid/capture`를 보낸다.
  - 성공하면 토스트 "Payment of ... successfully captured"가 뜨고 결제 배지가 Captured로 바뀐다.
  - 실패하면 오류 토스트가 뜬다.
- 서버의 매입 단계에는 보상(compensation)이 없다. 제공자 쪽에서 이미 일어난 매입을 되돌리지 않도록 의도한 설계다.

### 화면 확인 링크

| 페이지·장면 | 화면 HTML | Layout |
| --- | --- | --- |
| 주문 상세 · 미결 결제 · 매입 확인 | [미결 결제](details/screens/order-detail.html#awaiting-payment) · [매입 확인](details/screens/order-detail.html#capture-prompt) | [주문 상세 배치](screen-layout.md#order-detail) |

<a id="n11"></a>
## N11. 결제 승인 상태 확인(Check status)

이 과업에서는 페이지 이동이 없다.

- 결제 세션이 `pending_authorization` 상태이면 Payments 섹션 위에 "Payment is awaiting authorization from the payment provider." 배너와 Check status 버튼이 나타난다.
- Check status는 확인 프롬프트 없이 `POST /admin/orders/:id/payment-sessions/authorize`를 보낸다. 결과는 토스트로 알린다.
  - 승인되었으면 성공 토스트 "Payment has been authorized successfully."
  - 아직 대기 중이면 info 토스트 "Payment is still pending authorization."
  - 요청이 실패하면 오류 토스트.

### 화면 확인 링크

| 페이지·장면 | 화면 HTML | Layout |
| --- | --- | --- |
| 주문 상세 · 승인 대기 배너 | [승인 대기](details/screens/order-detail.html#awaiting-authorization) | [주문 상세 배치](screen-layout.md#order-detail) |

<a id="n12"></a>
## N12. 미결 금액 수납(결제 링크 복사·결제 완료 표시)

이 과업에서는 페이지 이동이 없다. 다음 조건을 모두 만족하면 Summary 하단 액션바에 "Copy payment link for $X"와 "Mark as paid" 버튼이 나타난다.

- `not_paid` 상태인 결제 컬렉션이 있다.
- 미결 금액(`pending_difference`)이 0보다 크다.
- `payment_collection:update`와 `order:update` 권한이 있다.

두 버튼의 동작은 다음과 같다.

- **Copy payment link**
  - API를 호출하지 않는다. `${MEDUSA_STOREFRONT_URL}/payment-collection/:pcId?order_id=:id`를 클립보드에 복사하고, 툴팁을 2초 동안 "Copied"로 바꾼다.
  - 버튼 문구의 금액은 `pending_difference`가 아니라 결제 컬렉션 금액(`paymentCollection.amount`)이다.
  - 이 링크를 고객에게 전달하는 일은 시스템 밖에서 이루어진다.
- **Mark as paid**
  - 확인 프롬프트를 거친 뒤 `POST /admin/payment-collections/:pcId/mark-as-paid`를 보낸다.
  - 성공하면 토스트 "Payment of ... successfully marked as paid"가 뜬다.
  - 서버는 시스템 결제 제공자로 세션을 만들고, 승인한 다음 바로 매입한다.

### 화면 확인 링크

| 페이지·장면 | 화면 HTML | Layout |
| --- | --- | --- |
| 주문 상세 · 미결 결제 · 결제 완료 확인 | [미결 결제](details/screens/order-detail.html#awaiting-payment) · [결제 완료 확인](details/screens/order-detail.html#mark-paid-prompt) | [주문 상세 배치](screen-layout.md#order-detail) |

<a id="n13"></a>
## N13. 환불(로열티 플러그인 정산 포함)

```navigation
OrderDetail(PaymentMenu) --> OrderCreateRefund(FromPayment) : 결제 행 Refund
OrderDetail(RefundDue) --> OrderCreateRefund : Refund 금액 버튼
OrderCreateRefund --> (/plugins)
(/plugins) --> OrderCreateRefund : 로열티 플러그인 없음
(/plugins) --> OrderCreateRefund(LoyaltyRefund) : 로열티 플러그인 있음
OrderCreateRefund(LoyaltyRefund) --> OrderCreateRefund(LoyaltyCredit) : Store credit 선택
OrderCreateRefund --> (/payments/refund) : Save
OrderCreateRefund(FromPayment) --> (/payments/refund) : Save
OrderCreateRefund(LoyaltyRefund) --> (/payments/refund) : Save
(/payments/refund) --> OrderDetail(ToastSuccess) : 성공
(/payments/refund) --> OrderCreateRefund(ServerError) : 매입액 초과 등 거절
OrderCreateRefund(LoyaltyCredit) --> (/orders/credit_lines) : Save
(/orders/credit_lines) --> OrderDetail(ToastSuccess) : 성공
(/orders/credit_lines) --> OrderCreateRefund(ServerError) : 오류
OrderCreateRefund --> OrderDetail : Cancel 또는 닫기
```

- 입력을 바꾼 뒤 닫으면 공통 이탈 프롬프트가 뜬다. 이 장면은 HTML로 재현하지 않았다.
- 진입 경로는 두 가지다.
  - **결제 행 ⋯ 메뉴의 Refund**: `?paymentId=`를 붙여 열기 때문에 결제 선택 칸 대신 고정된 결제 줄이 보인다. 매입되지 않았거나, 취소되었거나, 이미 전액 환불된 결제에서는 이 항목이 비활성이다.
  - **Summary 하단의 "Refund $X" 버튼**: 미결 차액이 음수일 때만 보이고, 환불할 결제를 직접 고르게 한다.
  - 금액 기본값: 미결 차액이 음수이면 `min(|pending_difference|, payment.amount)`, 아니면 결제 금액이다.
- `GET /admin/plugins` 결과에 `@medusajs/loyalty-plugin`이 있으면 같은 드로어 안의 폼이 잔액 정산(Balance settlement) 폼으로 바뀐다.
  - 플러그인 목록을 불러오는 동안에는 기본 폼이 잠깐 보였다가 바뀔 수 있다(코드를 보고 추론).
  - Store credit 선택지는 `order_credit_line:create` 권한이 없으면 숨는다.
  - 게스트 주문이거나 미결 금액이 없으면 Store credit이 비활성이 되고, 그 이유를 설명 문구로 보여 준다.
- 환불 금액의 상한은 클라이언트에서 검사하지 않는다(resolver가 rules를 무시하기 때문으로 보이며, 미확인).
  - 매입액을 넘는 환불은 서버가 "You are not allowed to refund more than the captured amount"로 거절하고, 화면은 토스트로만 알린다.
- 성공 토스트:
  - 환불: "Refund of amount ... successful"
  - 크레딧 라인: "Credit line created successfully"

### 화면 확인 링크

| 페이지·장면 | 화면 HTML | Layout |
| --- | --- | --- |
| 주문 상세 · 결제 메뉴 · 환불 필요 · 성공 토스트 | [결제 메뉴](details/screens/order-detail.html#menu-payment) · [환불 필요](details/screens/order-detail.html#refund-due) · [성공 토스트](details/screens/order-detail.html#toast-success) | [주문 상세 배치](screen-layout.md#order-detail) |
| 환불 · 결제 지정 진입 · 서버 거절 · 로열티 환불 · 로열티 크레딧 · 크레딧 비활성 · 로딩 | [기본](details/screens/order-create-refund.html#default) · [결제 지정](details/screens/order-create-refund.html#from-payment) · [서버 거절](details/screens/order-create-refund.html#server-error) · [로열티 환불](details/screens/order-create-refund.html#loyalty-refund) · [로열티 크레딧](details/screens/order-create-refund.html#loyalty-credit) · [크레딧 비활성](details/screens/order-create-refund.html#credit-disabled) · [로딩](details/screens/order-create-refund.html#loading) | [환불 배치](screen-layout.md#order-create-refund) |

<a id="n14"></a>
## N14. 반품 요청 생성

```navigation
OrderDetail(SummaryMenu) --> (check_active_change) : Create Return
OrderDetail(ReturnActive) --> (check_active_change) : 배너 Continue
(check_active_change) --> OrderDetail(ToastError) : 다른 유형의 변경 진행 중
(check_active_change) --> (/returns/begin) : 변경 없음
(check_active_change) --> OrderCreateReturn : 기존 반품 요청 재사용
(/returns/begin) --> OrderCreateReturn : 반품 드래프트 생성
(/returns/begin) --> OrderDetail(ToastError) : 생성 실패
OrderCreateReturn --> OrderCreateReturn(AddItems) : Add items
OrderCreateReturn(AddItems) --> (/returns/request_items) : Save
(/returns/request_items) --> OrderCreateReturn(ItemsAdded) : 품목 추가
OrderCreateReturn(ItemsAdded) --> OrderCreateReturn(NoShippingOptions) : 위치에 반품 배송 옵션 없음
OrderCreateReturn(ItemsAdded) --> OrderCreateReturn(InventoryWarning) : 위치 재고 수준 없음
OrderCreateReturn(ItemsAdded) --> OrderCreateReturn(ConfirmPrompt) : Confirm Return
OrderCreateReturn(ConfirmPrompt) --> (/returns/request) : Continue
(/returns/request) --> OrderDetail(ReturnRequested) : 성공
(/returns/request) --> OrderCreateReturn(Failed) : 오류
OrderCreateReturn --> (/returns/request_cancel) : Cancel Return 또는 닫기
(/returns/request_cancel) --> OrderDetail : 드래프트 삭제
```

- Summary ⋯ 메뉴의 Create Return으로 들어온다. 이 항목은 `return:create`와 `return:update`가 모두 있어야 보인다. 다음 중 하나라도 해당하면 메뉴 항목이 비활성이다.
  - 반품할 수 있는 수량이 없다.
  - 편집이 진행 중이다.
  - 교환이나 클레임이 진행 중이다.
- 화면이 열리면 미리보기의 `order_change`를 확인한다.
  - 다른 유형의 변경이 진행 중이면 오류 토스트를 띄우고 상세로 되돌아간다.
  - 반품 요청 드래프트가 이미 있으면 그것을 이어서 쓴다.
  - 아무 변경도 없으면 `POST /admin/returns`로 드래프트를 새로 만든다.
- 품목 수량, 사유, 메모, 위치, 반품 배송 방법, 배송비는 바꿀 때마다 즉시 API에 반영된다. 수량은 키를 누를 때마다 보낸다. 반영에 실패하면 값을 되돌리고 토스트를 띄운다.
- Confirm을 누르면 확인 프롬프트를 거쳐 `POST /admin/returns/:id/request`로 요청을 확정한다.
  - 성공 토스트 없이 상세로 돌아가고, Summary에 Receive items 버튼이 생긴다([N15](#n15)).
  - 서버는 반품 배송 옵션이 있으면 반품 이행을 만들고, 결제 컬렉션을 갱신한다.
  - Confirm Return 버튼은 `order:update`가 없으면 보이지 않는다.
- 성공하지 않은 상태로 닫으면(X, Esc, Cancel 모두) `DELETE /admin/returns/:id/request`로 드래프트를 지운다.
  - 이 API는 `return:delete`를 요구한다. 화면 라우트는 이 권한을 요구하지 않고 `onClose`에는 오류 처리도 없다. 그래서 권한이 없으면 안내 없이 드래프트가 남는다.
  - 입력이 dirty 상태일 때는 이탈 프롬프트가 뜨기 **전에** 삭제가 먼저 실행된다(공통 `RouteModalForm` 동작, [분석서 I01](system-design-as-is.md#6-관찰-이슈)).
- 새로고침 등으로 드래프트가 남아 있으면 상세 상단에 "Return initiated" 배너가 생긴다. 배너에서 Continue로 이어서 하거나 Cancel Return으로 지울 수 있다. 배너의 Cancel Return은 `return:delete`가 있을 때만 보이며, 확인 프롬프트 없이 바로 지운다. 성공 토스트는 "Return canceled successfully"다.

### 화면 확인 링크

| 페이지·장면 | 화면 HTML | Layout |
| --- | --- | --- |
| 주문 상세 · Summary 메뉴 · 진행 중 반품 · 다른 변경 진행 오류 · 반품 요청됨 | [Summary 메뉴](details/screens/order-detail.html#menu-summary) · [진행 중 반품](details/screens/order-detail.html#return-active) · [변경 진행 오류](details/screens/order-detail.html#toast-error) · [반품 요청됨](details/screens/order-detail.html#return-requested) | [주문 상세 배치](screen-layout.md#order-detail) |
| 반품 생성 · 로딩 · 품목 표 · 품목 추가됨 · 품목 메뉴 · 배송 옵션 없음 · 재고 경고 · 확정 확인 · 실패 | [기본](details/screens/order-create-return.html#default) · [로딩](details/screens/order-create-return.html#loading) · [품목 표](details/screens/order-create-return.html#add-items) · [품목 추가됨](details/screens/order-create-return.html#items-added) · [품목 메뉴](details/screens/order-create-return.html#item-menu) · [배송 옵션 없음](details/screens/order-create-return.html#no-shipping-options) · [재고 경고](details/screens/order-create-return.html#inventory-warning) · [확정 확인](details/screens/order-create-return.html#confirm-prompt) · [실패](details/screens/order-create-return.html#failed) | [반품 생성 배치](screen-layout.md#order-create-return) |

<a id="n15"></a>
## N15. 반품 수령

```navigation
OrderDetail(ReturnRequested) --> (check_active_change) : Receive items
(check_active_change) --> OrderDetail(ToastError) : 다른 유형의 변경 진행 중
(check_active_change) --> OrderReceiveReturn : 기존 수령 변경 재사용
(check_active_change) --> (/returns/receive_begin) : 변경 없음
(/returns/receive_begin) --> (/returns/receive_items) : 수령 변경 생성
(/returns/receive_begin) --> OrderReceiveReturn(Failed) : 시작 실패
(/returns/receive_items) --> OrderReceiveReturn(Failed) : 품목 추가 실패
(/returns/receive_items) --> OrderReceiveReturn : 전 품목 전량 수령으로 미리 채움
OrderReceiveReturn --> OrderReceiveReturn(DamagedPopover) : 손상 버튼
OrderReceiveReturn --> (validate_receive_qty) : 수량 입력 후 blur
(validate_receive_qty) --> OrderReceiveReturn(QtyToast) : 음수 또는 요청 수량 초과
(validate_receive_qty) --> OrderReceiveReturn : 수령 항목 갱신
OrderReceiveReturn --> (/returns/receive_confirm) : Save
(/returns/receive_confirm) --> OrderDetail(ToastSuccess) : 성공
(/returns/receive_confirm) --> OrderReceiveReturn(Failed) : 오류
OrderReceiveReturn --> OrderReceiveReturn(LeavePrompt) : Cancel 또는 닫기
OrderReceiveReturn(LeavePrompt) --> (/returns/receive_cancel) : Continue
(/returns/receive_cancel) --> OrderDetail(ReturnRequested) : 수령 변경 삭제
```

- 이 버튼은 `return:update` 권한이 있고 `requested` 상태인 반품이 있을 때 보인다. 수령할 반품이 하나면 바로 이동하고, 여러 개면 메뉴에서 "Return/Exchange/Claim #끝7자리"를 골라 이동한다.
- 수령 시작이나 품목 추가가 실패하면 토스트만 띄우고 드로어에 머문다. 반품·클레임·교환·편집과 달리 상세로 돌아가지 않으며, 폼도 그대로 그린다.
- 화면이 열리면 수령 변경을 만들고, 요청된 품목을 모두 전량 수령한 것으로 미리 채운다. 수량과 손상 수량은 입력란에서 포커스가 빠질 때마다 서버에 반영된다. 검증 실패는 인라인이 아닌 토스트로 알린다.
- 초기값을 `shouldDirty`로 넣기 때문에 닫을 때 대개 이탈 확인 프롬프트가 뜬다.
- 관찰 이슈: 폼 래퍼는 프롬프트에서 사용자가 답하기 전에 이미 `onClose`를 호출해 `DELETE /admin/returns/:id/receive`를 보낸다(코드를 보고 추론했고, 실제로 실행해 확인하지는 않았다). 따라서 프롬프트에서 Cancel을 눌러 화면에 남아도, 서버의 수령 변경은 이미 지워졌을 수 있다.
- `order:update` 권한이 없으면 Save 버튼이 보이지 않아 수령을 확정할 수 없다.
- 수령을 확정하면 서버는 손상되지 않은 품목을 재입고하고, 결제 컬렉션을 갱신한 뒤 `order.return_received`를 발행한다. 화면은 상세로 이동한 다음 토스트(제목 "Success", 설명 "Return received successfully.")를 띄운다.

### 화면 확인 링크

| 페이지·장면 | 화면 HTML | Layout |
| --- | --- | --- |
| 주문 상세 · 반품 요청됨 · 변경 진행 오류 · 성공 토스트 | [반품 요청됨](details/screens/order-detail.html#return-requested) · [변경 진행 오류](details/screens/order-detail.html#toast-error) · [성공 토스트](details/screens/order-detail.html#toast-success) | [주문 상세 배치](screen-layout.md#order-detail) |
| 반품 수령 · 손상 팝오버 · 수량 토스트 · 권한 없음 · 이탈 확인 · 실패 · 로딩 | [기본](details/screens/order-receive-return.html#default) · [손상 팝오버](details/screens/order-receive-return.html#damaged-popover) · [수량 토스트](details/screens/order-receive-return.html#qty-toast) · [권한 없음](details/screens/order-receive-return.html#no-permission) · [이탈 확인](details/screens/order-receive-return.html#leave-prompt) · [실패](details/screens/order-receive-return.html#failed) · [로딩](details/screens/order-receive-return.html#loading) | [반품 수령 배치](screen-layout.md#order-receive-return) |

<a id="n16"></a>
## N16. 요청된 반품 취소(활동 타임라인)

이 과업에서는 페이지 이동이 없다.

- Activity 타임라인의 "Return #… requested" 항목에 인라인 Cancel 버튼이 있다. 반품이 취소되지 않았고 `return:update`와 `order:update` 권한이 있을 때만 보인다.
- 버튼을 누르면 위험 프롬프트 "Are you sure you want to cancel the return request?"가 열린다. Confirm을 누르면 `POST /admin/returns/:rid/cancel`을 보낸다.
- 성공 토스트는 없고, 오류만 토스트로 표시한다.
- 버튼 조건은 `!canceled_at` 하나뿐이다. 그래서 수령까지 끝난 반품의 "requested" 항목에도 Cancel이 보인다.
- 화면은 `return:update`와 `order:update`를 요구하지만, 서버의 `POST /admin/returns/:id/cancel`은 `return:update`만 요구한다.
- 클레임과 교환 항목에도 같은 Cancel 버튼이 있다.
  - 관찰 이슈: 클레임 항목의 Cancel은 조건식이 `isCanceled = !!claim.created_at`으로 되어 있어 실제로는 한 번도 보이지 않는다.
- 진행 중인 드래프트를 지우는 상단 배너의 Cancel은 [N14](#n14), [N17](#n17), [N18](#n18)에서 다룬다.

### 화면 확인 링크

| 페이지·장면 | 화면 HTML | Layout |
| --- | --- | --- |
| 주문 상세 · 반품 요청됨 · 반품 취소 확인 | [반품 요청됨](details/screens/order-detail.html#return-requested) · [반품 취소 확인](details/screens/order-detail.html#return-cancel-prompt) | [주문 상세 배치](screen-layout.md#order-detail) |

<a id="n17"></a>
## N17. 클레임 생성·관리

```navigation
OrderDetail(SummaryMenu) --> (check_active_change) : Create Claim 또는 Manage Claim
OrderDetail(ClaimActive) --> (check_active_change) : 배너 Continue
(check_active_change) --> OrderDetail(ToastError) : 다른 유형의 변경 진행 중
(check_active_change) --> OrderCreateClaim : 기존 클레임 재사용
(check_active_change) --> (/claims/begin) : 변경 없음
(/claims/begin) --> OrderCreateClaim : replace 유형 클레임 생성
(/claims/begin) --> OrderDetail(ToastError) : 생성 실패
OrderCreateClaim --> OrderCreateClaim(AddInbound) : Inbound Add items
OrderCreateClaim --> OrderCreateClaim(AddOutbound) : Outbound Add items
OrderCreateClaim(AddInbound) --> OrderCreateClaim(ItemsAdded) : Save
OrderCreateClaim(AddOutbound) --> OrderCreateClaim(ItemsAdded) : Save
OrderCreateClaim(ItemsAdded) --> OrderCreateClaim(ConfirmPrompt) : Confirm Claim
OrderCreateClaim(ConfirmPrompt) --> (/claims/request) : Continue
(/claims/request) --> OrderDetail(ToastSuccess) : 성공
(/claims/request) --> OrderCreateClaim(Failed) : 오류
OrderCreateClaim --> (/claims/request_cancel) : Cancel Claim
(/claims/request_cancel) --> OrderDetail : 드래프트 삭제
OrderCreateClaim --> OrderDetail(ClaimActive) : X 또는 Esc
```

- 메뉴 항목은 `order_claim:create`와 `update`가 있어야 보인다. 다음 경우 비활성이다: 반품할 수량이 없을 때, 편집이 진행 중일 때, 교환 없이 반품만 진행 중일 때, 교환이 진행 중일 때. 클레임이 진행 중이면 문구가 "Manage Claim"이 된다.
- 클레임은 항상 `type: "replace"`로 만들어진다. 환불형 클레임을 고르는 UI는 없다.
- Confirm Claim 버튼은 `order:update`가 없으면 보이지 않는다.
- 편집 영역은 두 가지이며, 바꿀 때마다 API에 반영된다.
  - Inbound: 돌려받을 품목, 위치, 반품 배송.
  - Outbound: 새로 보낼 변형, 출고 배송.
- 주문에 프로모션이 있으면 Carry over promotions 스위치가 나타나고, 값은 `POST /admin/order-changes/:id`로 저장한다.
- 확정에 성공하면 토스트 "Claim confirmed successfully"와 함께 상세로 돌아온다.
- footer의 Cancel Claim은 드래프트를 지우고 토스트 "Claim was successfully canceled."를 띄운다. 배너의 Cancel Claim은 확인 없이 지우며, 토스트는 "Claim canceled successfully"다.
- 관찰 이슈: footer의 Cancel Claim만 드래프트를 지운다. X나 Esc로 닫으면 드래프트가 남아 상세 상단에 "Claim initiated" 배너가 생긴다. 코드에도 `TODO: add this on ESC press` 주석이 남아 있다.

### 화면 확인 링크

| 페이지·장면 | 화면 HTML | Layout |
| --- | --- | --- |
| 주문 상세 · Summary 메뉴 · 진행 중 클레임 · 변경 진행 오류 · 성공 토스트 | [Summary 메뉴](details/screens/order-detail.html#menu-summary) · [진행 중 클레임](details/screens/order-detail.html#claim-active) · [변경 진행 오류](details/screens/order-detail.html#toast-error) · [성공 토스트](details/screens/order-detail.html#toast-success) | [주문 상세 배치](screen-layout.md#order-detail) |
| 클레임 생성 · 로딩 · 반품 품목 표 · 발송 품목 표 · 품목 추가됨 · 품목 메뉴 · 확정 확인 · 실패 | [기본](details/screens/order-create-claim.html#default) · [로딩](details/screens/order-create-claim.html#loading) · [반품 품목 표](details/screens/order-create-claim.html#add-inbound) · [발송 품목 표](details/screens/order-create-claim.html#add-outbound) · [품목 추가됨](details/screens/order-create-claim.html#items-added) · [품목 메뉴](details/screens/order-create-claim.html#item-menu) · [확정 확인](details/screens/order-create-claim.html#confirm-prompt) · [실패](details/screens/order-create-claim.html#failed) | [클레임 생성 배치](screen-layout.md#order-create-claim) |

<a id="n18"></a>
## N18. 교환 생성·관리

```navigation
OrderDetail(SummaryMenu) --> (check_active_change) : Create Exchange 또는 Manage Exchange
OrderDetail(ExchangeActive) --> (check_active_change) : 배너 Continue
(check_active_change) --> OrderDetail(ToastError) : 다른 유형의 변경 진행 중
(check_active_change) --> OrderCreateExchange : 기존 교환 재사용
(check_active_change) --> (/exchanges/begin) : 변경 없음
(/exchanges/begin) --> OrderCreateExchange : 교환 생성
(/exchanges/begin) --> OrderDetail(ToastError) : 생성 실패
OrderCreateExchange --> OrderCreateExchange(AddInbound) : Inbound Add items
OrderCreateExchange --> OrderCreateExchange(AddOutbound) : Outbound Add items
OrderCreateExchange(AddInbound) --> OrderCreateExchange(ItemsAdded) : Save
OrderCreateExchange(AddOutbound) --> OrderCreateExchange(ItemsAdded) : Save
OrderCreateExchange(ItemsAdded) --> OrderCreateExchange(ConfirmPrompt) : Confirm Exchange
OrderCreateExchange(ConfirmPrompt) --> (/exchanges/request) : Continue
(/exchanges/request) --> OrderDetail : 성공
(/exchanges/request) --> OrderCreateExchange(Failed) : 오류
OrderCreateExchange --> (/exchanges/request_cancel) : Cancel Exchange
(/exchanges/request_cancel) --> OrderDetail : 드래프트 삭제
OrderCreateExchange --> OrderDetail(ExchangeActive) : X 또는 Esc
```

- 메뉴 노출과 비활성 조건은 클레임과 대칭이다(`order_exchange:*` 권한, 클레임 진행 중이면 비활성). Confirm Exchange 버튼은 `order:update`가 있어야 보인다.
- footer Cancel의 토스트는 "Exchange was successfully canceled.", 배너 Cancel의 토스트는 "Exchange canceled successfully"다.
- 화면 구성과 드래프트 처리는 클레임과 같다. 다른 점은 두 가지다.
  - 확정에 성공해도 토스트가 뜨지 않는다.
  - Inbound 품목 표의 필터와 정렬 항목이 더 적다.
- X나 Esc로 닫으면 드래프트가 남고 "Exchange initiated" 배너가 생긴다. 클레임과 같은 관찰 이슈다. 배너의 Cancel Exchange는 확인 프롬프트 없이 바로 지운다.

### 화면 확인 링크

| 페이지·장면 | 화면 HTML | Layout |
| --- | --- | --- |
| 주문 상세 · Summary 메뉴 · 진행 중 교환 · 변경 진행 오류 | [기본](details/screens/order-detail.html#default) · [Summary 메뉴](details/screens/order-detail.html#menu-summary) · [진행 중 교환](details/screens/order-detail.html#exchange-active) · [변경 진행 오류](details/screens/order-detail.html#toast-error) | [주문 상세 배치](screen-layout.md#order-detail) |
| 교환 생성 · 로딩 · 반품 품목 표 · 발송 품목 표 · 품목 추가됨 · 품목 메뉴 · 확정 확인 · 실패 | [기본](details/screens/order-create-exchange.html#default) · [로딩](details/screens/order-create-exchange.html#loading) · [반품 품목 표](details/screens/order-create-exchange.html#add-inbound) · [발송 품목 표](details/screens/order-create-exchange.html#add-outbound) · [품목 추가됨](details/screens/order-create-exchange.html#items-added) · [품목 메뉴](details/screens/order-create-exchange.html#item-menu) · [확정 확인](details/screens/order-create-exchange.html#confirm-prompt) · [실패](details/screens/order-create-exchange.html#failed) | [교환 생성 배치](screen-layout.md#order-create-exchange) |

<a id="n19"></a>
## N19. 주문 편집 요청·확정·취소

```navigation
OrderDetail(SummaryMenu) --> (check_active_change) : Edit order 또는 Continue order edit
OrderDetail(EditPending) --> (check_active_change) : 배너 Continue edit
(check_active_change) --> OrderDetail(ToastError) : 다른 유형의 변경 진행 중
(check_active_change) --> OrderCreateEdit : 기존 편집 재사용
(check_active_change) --> (/order_edits/begin) : 변경 없음
(/order_edits/begin) --> OrderCreateEdit : 편집 변경 생성
(/order_edits/begin) --> OrderDetail(ToastError) : 생성 실패
OrderCreateEdit --> OrderCreateEdit(AddItems) : Add items
OrderCreateEdit(AddItems) --> OrderCreateEdit(ItemStates) : Save
OrderCreateEdit --> OrderCreateEdit(QtyError) : 출고 수량 이하로 변경
OrderCreateEdit --> OrderCreateEdit(ConfirmPrompt) : Confirm Edit
OrderCreateEdit(ConfirmPrompt) --> (/order_edits/request) : Continue
(/order_edits/request) --> OrderDetail(EditRequested) : 성공
(/order_edits/request) --> OrderCreateEdit(Failed) : 오류
OrderCreateEdit --> (/order_edits/cancel) : Cancel Edit 또는 닫기
(/order_edits/cancel) --> OrderDetail : 편집 삭제
OrderDetail(EditRequested) --> (/order_edits/confirm) : Force confirm
(/order_edits/confirm) --> OrderDetail : 확정 성공
OrderDetail(EditRequested) --> (/order_edits/cancel) : 배너 Cancel
```

- 다음 중 하나라도 해당하면 Edit order 항목이 비활성이다.
  - 주문이 취소되었다.
  - 다른 유형의 변경이 진행 중이다.
  - 편집이 이미 `requested` 상태다.
- 편집이 `pending` 상태이면 메뉴 문구가 "Continue order edit"로 바뀐다.
- **직접 URL 진입 예외**: 편집이 `requested` 상태여도 `/orders/:id/edits`를 직접 열면 폼이 열린다. 진입 검사는 변경 유형만 보기 때문이다. 이 상태에서 닫기만 해도 `DELETE /admin/order-edits/:id`가 나가고, 서버는 requested 상태의 편집도 취소한다. 결국 요청된 편집이 "Order edit canceled" 토스트와 함께 사라진다(관찰 이슈 I15).
- 편집 화면의 Confirm은 편집을 확정하지 않고 **요청**(`requested`)만 한다.
  - 메모가 있으면 먼저 `POST /admin/order-changes/:id`로 저장한 뒤 `POST /admin/order-edits/:id/request`를 보낸다.
  - 성공하면 토스트 "Order edit request created"가 뜨고, 상세에 "Order edit requested" 배너가 생긴다.
- 최종 확정은 상세 배너의 Force confirm으로 한다.
  - 확인 프롬프트 없이 `POST /admin/order-edits/:id/confirm`을 보낸다. 성공 토스트는 "Order edit confirmed"다.
  - 서버는 예약을 다시 잡고 결제 컬렉션을 갱신한 뒤 `order-edit.confirmed`를 발행한다.
  - 고객이 스토어에서 편집 요청을 수락하는 경로가 있는지는 이번 범위(관리자 UI)에서 확인하지 않았다.
- 성공하지 않은 상태로 편집 화면을 닫으면 `DELETE /admin/order-edits/:id`로 편집을 지우고 토스트 "Order edit canceled"를 띄운다. 배너의 Cancel도 확인 프롬프트 없이 지우며, 토스트는 "Order edit cancelled"다(철자가 다른 별도 키).
- 메모만 입력해도 폼이 dirty 상태가 된다. 이 상태에서 닫으면 이탈 프롬프트가 뜨기 전에 편집이 이미 삭제된다(I01).
- 수량을 출고 수량 이하로 바꾸려 하면 토스트 "Cannot set quantity to be less then or equal to fulfilled quantity"를 띄우고 변경을 보내지 않는다.

### 화면 확인 링크

| 페이지·장면 | 화면 HTML | Layout |
| --- | --- | --- |
| 주문 상세 · Summary 메뉴 · 편집 대기 · 편집 요청됨 · 변경 진행 오류 | [기본](details/screens/order-detail.html#default) · [Summary 메뉴](details/screens/order-detail.html#menu-summary) · [편집 대기](details/screens/order-detail.html#edit-pending) · [편집 요청됨](details/screens/order-detail.html#edit-requested) · [변경 진행 오류](details/screens/order-detail.html#toast-error) | [주문 상세 배치](screen-layout.md#order-detail) |
| 주문 편집 · 로딩 · 품목 추가 표 · 품목 상태 배지 · 품목 메뉴 · 수량 오류 · 검색 결과 없음 · 확정 확인 · 실패 | [기본](details/screens/order-create-edit.html#default) · [로딩](details/screens/order-create-edit.html#loading) · [품목 추가 표](details/screens/order-create-edit.html#add-items) · [품목 상태](details/screens/order-create-edit.html#item-states) · [품목 메뉴](details/screens/order-create-edit.html#item-menu) · [수량 오류](details/screens/order-create-edit.html#qty-error) · [검색 결과 없음](details/screens/order-create-edit.html#empty-search) · [확정 확인](details/screens/order-create-edit.html#confirm-prompt) · [실패](details/screens/order-create-edit.html#failed) | [주문 편집 배치](screen-layout.md#order-create-edit) |

<a id="n20"></a>
## N20. 주문 소유권 이전과 요청 취소

```navigation
OrderDetail(CustomerMenu) --> OrderRequestTransfer : Transfer ownership
OrderRequestTransfer --> OrderRequestTransfer(Guest) : Guest 선택
OrderRequestTransfer --> (validate_transfer) : Save
OrderRequestTransfer(Guest) --> (validate_transfer) : Save
(validate_transfer) --> OrderRequestTransfer(ValidationError) : 고객 미선택 또는 이메일 오류
(validate_transfer) --> (/orders/transfer) : Registered
(validate_transfer) --> (/orders/transfer/guest) : Guest
(/orders/transfer) --> OrderDetail(TransferRequested) : 요청 생성
(/orders/transfer/guest) --> OrderDetail(ToastSuccess) : 즉시 이전
(/orders/transfer) --> OrderRequestTransfer(Failed) : 오류
(/orders/transfer/guest) --> OrderRequestTransfer(Failed) : 오류
OrderRequestTransfer --> OrderDetail : Cancel 또는 닫기
OrderDetail(TransferRequested) --> OrderDetail(TransferCancelPrompt) : 활동 Cancel
OrderDetail(TransferCancelPrompt) --> (/orders/transfer/cancel) : Delete
(/orders/transfer/cancel) --> OrderDetail : 요청 삭제
```

- Customer 섹션 ⋯ 메뉴의 Transfer ownership으로 들어온다. 메뉴는 `customer:update`와 `order:update` 권한이 있을 때 보인다. 같은 폼을 고객 상세의 주문 표에서도 쓰지만, 그 경로는 범위 밖이다.
- **Registered(등록 고객)**
  - 계정이 있는 고객을 고른다.
  - 이전 요청(`transfer` 유형의 주문 변경)만 생성되며, 고객이 스토어에서 수락해야 소유권이 바뀐다.
  - 토스트는 "Order transfer request sent to: ..."이고, 활동에 "Order transfer #… requested"(From/To)가 추가된다. 토스트의 이메일 자리에는 새 소유자가 아니라 현재 주문 이메일(`order.email`)이 들어간다(관찰 이슈 I16).
- **Guest(게스트)**
  - 입력한 이메일로 게스트 고객을 찾거나 새로 만든 뒤 바로 이전을 확정한다.
  - 토스트는 "Order transferred to guest customer: ..."이다.
- 서버가 거절하는 경우는 토스트로 알린다. 예를 들어 이미 그 고객 소유인 주문, 진행 중인 다른 변경, 등록 고객 주문을 게스트로 이전하려는 경우다. 이전 요청이 이미 있을 때 서버가 어떤 문구로 막는지는 확인하지 못했다.
- 입력을 바꾼 뒤 닫으면 공통 이탈 프롬프트가 뜬다(HTML 미재현).
- 활동의 Cancel은 `order:update` 권한이 있고 이전이 확정되지 않았을 때 보인다. 거절(declined) 여부는 검사하지 않으므로 거절된 요청에도 버튼이 보일 수 있다. 누르면 위험 프롬프트가 열린다. 버튼 문구는 "Delete"이며, 누르면 `POST /admin/orders/:id/transfer/cancel`로 요청을 지운다. 성공 토스트는 없다.

### 화면 확인 링크

| 페이지·장면 | 화면 HTML | Layout |
| --- | --- | --- |
| 주문 상세 · Customer 메뉴 · 이전 요청됨 · 요청 취소 확인 · 성공 토스트 | [Customer 메뉴](details/screens/order-detail.html#menu-customer) · [이전 요청됨](details/screens/order-detail.html#transfer-requested) · [요청 취소 확인](details/screens/order-detail.html#transfer-cancel-prompt) · [성공 토스트](details/screens/order-detail.html#toast-success) | [주문 상세 배치](screen-layout.md#order-detail) |
| 소유권 이전 · 게스트 · 검증 오류 · 실패 | [기본](details/screens/order-request-transfer.html#default) · [게스트](details/screens/order-request-transfer.html#guest) · [검증 오류](details/screens/order-request-transfer.html#validation-error) · [실패](details/screens/order-request-transfer.html#failed) | [소유권 이전 배치](screen-layout.md#order-request-transfer) |

<a id="n21"></a>
## N21. 주문 이메일 수정

```navigation
OrderDetail(CustomerMenu) --> OrderEditEmail : Email
OrderEditEmail --> (validate_email) : Save
(validate_email) --> OrderEditEmail(Invalid) : 형식 오류
(validate_email) --> (/orders/update) : 통과
(/orders/update) --> OrderDetail(ToastSuccess) : 성공
(/orders/update) --> OrderEditEmail(Failed) : 오류
OrderEditEmail --> OrderDetail : Cancel 또는 닫기
OrderEditEmail --> OrderEditEmail(LeavePrompt) : 변경 후 닫기
```

- 이메일 형식 오류는 zod 기본 메시지로 표시한다(정확한 문구는 미확인). 오류가 있어도 Save 버튼은 비활성이 되지 않는다.
- 성공 토스트는 "Order email updated to ..."다. 서버가 `update_order` 유형의 변경 이력을 남기므로, 활동에 "Email updated"와 From/To가 추가된다.

### 화면 확인 링크

| 페이지·장면 | 화면 HTML | Layout |
| --- | --- | --- |
| 주문 상세 · Customer 메뉴 · 성공 토스트 | [Customer 메뉴](details/screens/order-detail.html#menu-customer) · [성공 토스트](details/screens/order-detail.html#toast-success) | [주문 상세 배치](screen-layout.md#order-detail) |
| 이메일 수정 · 형식 오류 · 실패 · 이탈 확인 | [기본](details/screens/order-edit-email.html#default) · [형식 오류](details/screens/order-edit-email.html#invalid) · [실패](details/screens/order-edit-email.html#failed) · [이탈 확인](details/screens/order-edit-email.html#leave-prompt) | [이메일 수정 배치](screen-layout.md#order-edit-email) |

<a id="n22"></a>
## N22. 배송지·청구지 수정

```navigation
OrderDetail(CustomerMenu) --> OrderEditShippingAddress : Shipping address
OrderDetail(CustomerMenu) --> OrderEditBillingAddress : Billing address
OrderEditShippingAddress --> (validate_address) : Save
OrderEditBillingAddress --> (validate_address) : Save
(validate_address) --> OrderEditShippingAddress(RequiredError) : 배송지 Address 비어 있음
(validate_address) --> OrderEditBillingAddress(RequiredError) : 청구지 Address 비어 있음
(validate_address) --> (/orders/update) : 통과
(/orders/update) --> OrderDetail(ToastSuccess) : 성공
(/orders/update) --> OrderEditShippingAddress(Failed) : 배송지 오류
(/orders/update) --> OrderEditBillingAddress(Failed) : 청구지 오류
OrderEditShippingAddress --> OrderDetail : Cancel 또는 닫기
OrderEditBillingAddress --> OrderDetail : Cancel 또는 닫기
```

- 두 메뉴 모두 `order_address:update`와 `order:update` 권한이 필요하다. Country는 비활성이라 바꿀 수 없다.
- 두 화면은 다음 세 가지가 다르다.
  - 청구지는 검증 오류가 있으면 Save가 비활성이 된다. 배송지는 비활성이 되지 않는다.
  - 청구지에는 First/Last Name 오류 영역이 있다. 다만 두 필드 모두 선택 입력이라 실제로 오류가 나지는 않는다.
  - 주문을 불러오지 못했을 때 배송지는 "Order not found"를 던지고, 청구지는 원래 오류를 그대로 던진다.
- 서버는 기존 주소를 고치지 않고 새 주소 행을 만들어 연결한다. 활동에는 "Shipping/Billing address updated"가 추가된다.

### 화면 확인 링크

| 페이지·장면 | 화면 HTML | Layout |
| --- | --- | --- |
| 주문 상세 · Customer 메뉴 · 성공 토스트 | [Customer 메뉴](details/screens/order-detail.html#menu-customer) · [성공 토스트](details/screens/order-detail.html#toast-success) | [주문 상세 배치](screen-layout.md#order-detail) |
| 배송지 수정 · 필수값 오류 · 실패 · 이탈 확인 | [기본](details/screens/order-edit-shipping-address.html#default) · [필수값 오류](details/screens/order-edit-shipping-address.html#required-error) · [실패](details/screens/order-edit-shipping-address.html#failed) · [이탈 확인](details/screens/order-edit-shipping-address.html#leave-prompt) | [배송지 수정 배치](screen-layout.md#order-edit-shipping-address) |
| 청구지 수정 · 필수값 오류 · 실패 · 이탈 확인 | [기본](details/screens/order-edit-billing-address.html#default) · [필수값 오류](details/screens/order-edit-billing-address.html#required-error) · [실패](details/screens/order-edit-billing-address.html#failed) · [이탈 확인](details/screens/order-edit-billing-address.html#leave-prompt) | [청구지 수정 배치](screen-layout.md#order-edit-billing-address) |

<a id="n23"></a>
## N23. 주문 메타데이터 수정

```navigation
OrderDetail --> OrderMetadata : Metadata 카드 아이콘
OrderMetadata --> OrderMetadata(Loading) : 조회 대기
OrderMetadata --> OrderMetadata(RowMenu) : 행 메뉴
OrderMetadata --> OrderMetadata(NonPrimitive) : 객체·배열 값 존재
OrderMetadata --> (/orders/update) : Save
(/orders/update) --> OrderDetail(ToastSuccess) : 성공
(/orders/update) --> OrderMetadata(Failed) : 오류
OrderMetadata --> OrderDetail : Cancel 또는 닫기
OrderMetadata --> OrderMetadata(LeavePrompt) : 변경 후 닫기
```

- 상세 조회 필드에 `metadata`가 들어 있으므로 Metadata 카드는 키가 0개여도("0 keys") 항상 보인다.
- 카드 아이콘에는 UI 권한 검사가 없지만 라우트는 `order:update`를 요구한다. 그래서 권한이 없으면 들어간 뒤에야 AccessDenied를 본다([N25](#n25)).
- 저장할 때 값은 다음과 같이 다룬다.
  - 키가 빈 행은 버린다.
  - `"true"`/`"false"`는 불리언으로, 숫자 문자열은 숫자로 바꾼다.
  - 삭제한 키는 `""`로 보낸다.
  - 객체나 배열 값을 가진 행은 비활성이라 이 화면에서 편집할 수 없다.

### 화면 확인 링크

| 페이지·장면 | 화면 HTML | Layout |
| --- | --- | --- |
| 주문 상세 · 기본 · 성공 토스트 | [기본](details/screens/order-detail.html#default) · [성공 토스트](details/screens/order-detail.html#toast-success) | [주문 상세 배치](screen-layout.md#order-detail) |
| 메타데이터 수정 · 로딩 · 행 메뉴 · 비원시값 · 실패 · 이탈 확인 | [기본](details/screens/order-metadata.html#default) · [로딩](details/screens/order-metadata.html#loading) · [행 메뉴](details/screens/order-metadata.html#row-menu) · [비원시값](details/screens/order-metadata.html#non-primitive) · [실패](details/screens/order-metadata.html#failed) · [이탈 확인](details/screens/order-metadata.html#leave-prompt) | [메타데이터 수정 배치](screen-layout.md#order-metadata) |

<a id="n24"></a>
## N24. 주문 JSON 보기

이 과업에서는 라우트 이동이 없다. JSON 카드의 아이콘 버튼을 누르면 같은 페이지 안에 드로어가 열리고, 주문 객체 전체를 JSON 트리로 보여 준다. 드로어를 닫으면 상세 화면이 그대로 남는다. API 호출 없이 이미 불러온 주문 데이터를 쓴다.

### 화면 확인 링크

| 페이지·장면 | 화면 HTML | Layout |
| --- | --- | --- |
| 주문 상세 · JSON 드로어 | [기본](details/screens/order-detail.html#default) · [JSON 드로어](details/screens/order-detail.html#json-drawer) | [주문 상세 배치](screen-layout.md#order-detail) |

<a id="n25"></a>
## N25. 하위 작업 화면 직접 진입과 권한 거부

```navigation
(child_route_guard) --> OrderDetail(AccessDenied) : 하위 라우트 권한 없음 시 Outlet 대체
(child_route_guard) --> (check_active_change) : 반품·클레임·교환·편집·수령 화면
(child_route_guard) --> OrderCreateFulfillment : 그 밖의 화면 권한 있음
(check_active_change) --> OrderDetail(ToastError) : 다른 유형의 변경 진행 중
(check_active_change) --> OrderCreateReturn : 진행 가능
```

- 하위 화면 주소(예: `/orders/:id/refund`)를 북마크로 열거나 새로고침했을 때의 공통 흐름이다.
- `RoutePermissionGuard`는 가장 깊은 라우트의 `handle.permissions`를 적용한다.
  - 이 가드는 `/orders` 라우트의 element다. 권한이 없으면 `/orders` 아래 Outlet 전체를 AccessDenied 카드로 바꾸므로, 상세 페이지 자체도 보이지 않는다. 카드에는 필요한 권한 이름이 표시된다. 그림의 `OrderDetail(AccessDenied)`는 이 장면을 상세 HTML에 재현했기 때문에 붙은 표기다.
  - 가장 깊은 라우트의 권한만 검사하므로, `order:read`는 이 가드가 아니라 상세 로더 래퍼가 검사한다.
  - 권한 목록을 아직 불러오는 중이면 막지 않고 먼저 그린다.
- 반품·클레임·교환·편집·반품 수령 화면은 직접 열어도 [N14](#n14)와 같은 진행 중 변경 검사를 거친다. 그림의 `OrderCreateReturn`은 이 화면들을 대표한다.
- 나머지 화면(출고, 할당, 배송, 환불, 이전, 이메일, 주소, 메타데이터)은 주문을 불러온 뒤 바로 폼을 그린다. 진입할 때 서버 상태는 검사하지 않는다. 그림의 `OrderCreateFulfillment`가 이 그룹을 대표하며, 로딩 중에는 빈 모달이나 드로어가 보인다.
- 메뉴에서는 비활성인 작업도 URL로 직접 들어가면 폼이 열린다. 예를 들어 이미 취소된 주문의 출고 화면도 열린다. 대부분은 제출할 때 서버가 거절한다(코드를 보고 추론).
- 예외로 `requested` 상태 편집의 편집 화면은 닫기만 해도 편집이 삭제된다([N19](#n19), I15).

### 화면 확인 링크

| 페이지·장면 | 화면 HTML | Layout |
| --- | --- | --- |
| 주문 상세 · 권한 거부 · 변경 진행 오류 | [권한 거부](details/screens/order-detail.html#access-denied) · [변경 진행 오류](details/screens/order-detail.html#toast-error) | [주문 상세 배치](screen-layout.md#order-detail) |
| 출고 생성 · 로딩 | [기본](details/screens/order-create-fulfillment.html#default) · [로딩](details/screens/order-create-fulfillment.html#loading) | [출고 생성 배치](screen-layout.md#order-create-fulfillment) |
| 반품 생성 · 로딩 | [기본](details/screens/order-create-return.html#default) · [로딩](details/screens/order-create-return.html#loading) | [반품 생성 배치](screen-layout.md#order-create-return) |
