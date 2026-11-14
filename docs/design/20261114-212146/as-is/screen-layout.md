# 주문 관리(Admin) 화면 배치 — AS-IS

이 문서는 화면 배치와 장면의 원본이다. 화면 이동 흐름은 [navigation.md](navigation.md), 조사 근거와 미확인 사항은 [system-design-as-is.md](system-design-as-is.md#7-조사-근거검증미확인)에 있다.

- 각 HTML은 `details/screens/`에 있다. HTML 상단의 노란 "검토용 장면 선택" 바는 제품 UI가 아니다.
- 장면 링크는 `파일.html#장면id` 형식이다.
- `layout` 블록의 가로 배분 숫자는 대부분 그림을 읽기 쉽게 하려고 붙인 상대 가중치이며, 실제 픽셀 비율이 아니다. 코드로 확인한 크기는 각 절 설명에 적었다(예: 사이드바 220px, 상세 사이드 열 440px, 드로어 최대 560px, 모달 본문 열 720~736px).

## 페이지·장면 목록

| 화면 ID | 페이지 이름·Navigation 표기 | 실제 경로·진입점·접근 조건 | 관련 시나리오 | Layout 절·HTML | 근거·확인 상태 |
| --- | --- | --- | --- | --- | --- |
| order-list | 주문 목록 · `OrderList` | `/orders` · 사이드바 Orders, 홈 리다이렉트, 브레드크럼 · `order:read` | [N01](navigation.md#n01), [N02](navigation.md#n02) | [절](#order-list) · [HTML](details/screens/order-list.html) | 코드 확인 · `routes/orders/order-list` |
| order-export | 주문 내보내기 · `OrderExport` | `/orders/export` (목록 위 드로어) · 목록 Export · `order:read` | [N02](navigation.md#n02) | [절](#order-export) · [HTML](details/screens/order-export.html) | 코드 확인 · `routes/orders/order-export` |
| order-detail | 주문 상세 · `OrderDetail` | `/orders/:id` · 목록 행, 검색, 고객 상세, 하위 화면 복귀 · `order:read`(로더 권한 검사) | N01, [N03](navigation.md#n03)~N25 | [절](#order-detail) · [HTML](details/screens/order-detail.html) | 코드 확인 · `routes/orders/order-detail` |
| order-create-fulfillment | 출고 생성 · `OrderCreateFulfillment` | `/orders/:id/fulfillment?requires_shipping=` · Unfulfilled ⋯ Fulfill items · `order:update`+`fulfillment:create` | [N05](navigation.md#n05), N25 | [절](#order-create-fulfillment) · [HTML](details/screens/order-create-fulfillment.html) | 코드 확인 |
| order-allocate-items | 재고 할당 · `OrderAllocateItems` | `/orders/:id/allocate-items` · Summary Allocate items · `reservation_item:create` | [N06](navigation.md#n06) | [절](#order-allocate-items) · [HTML](details/screens/order-allocate-items.html) | 코드 확인 |
| order-create-shipment | 배송 처리 · `OrderCreateShipment` | `/orders/:id/:f_id/create-shipment` · Fulfillment 카드 Mark as shipped · `order:update`+`fulfillment:update` | [N07](navigation.md#n07) | [절](#order-create-shipment) · [HTML](details/screens/order-create-shipment.html) | 코드 확인 |
| order-receive-return | 반품 수령 · `OrderReceiveReturn` | `/orders/:id/returns/:return_id/receive` · Summary Receive items · `return:update` | [N15](navigation.md#n15) | [절](#order-receive-return) · [HTML](details/screens/order-receive-return.html) | 코드 확인 |
| order-create-return | 반품 생성 · `OrderCreateReturn` | `/orders/:id/returns` · Summary ⋯ Create Return, Return 배너 Continue · `return:create`+`return:update` | [N14](navigation.md#n14), N25 | [절](#order-create-return) · [HTML](details/screens/order-create-return.html) | 코드 확인 |
| order-create-claim | 클레임 생성 · `OrderCreateClaim` | `/orders/:id/claims` · Summary ⋯ Create/Manage Claim, 배너 Continue · `order_claim:create`+`update` | [N17](navigation.md#n17) | [절](#order-create-claim) · [HTML](details/screens/order-create-claim.html) | 코드 확인 |
| order-create-exchange | 교환 생성 · `OrderCreateExchange` | `/orders/:id/exchanges` · Summary ⋯ Create/Manage Exchange, 배너 Continue · `order_exchange:create`+`update` | [N18](navigation.md#n18) | [절](#order-create-exchange) · [HTML](details/screens/order-create-exchange.html) | 코드 확인 |
| order-create-edit | 주문 편집 · `OrderCreateEdit` | `/orders/:id/edits` · Summary ⋯ Edit order, 배너 Continue edit · `order_change:create`+`update` | [N19](navigation.md#n19) | [절](#order-create-edit) · [HTML](details/screens/order-create-edit.html) | 코드 확인 |
| order-create-refund | 환불(잔액 정산 변형 포함) · `OrderCreateRefund` | `/orders/:id/refund[?paymentId=]` · 결제 행 ⋯ Refund, Summary Refund $ · `order:update`+`refund:create` | [N13](navigation.md#n13) | [절](#order-create-refund) · [HTML](details/screens/order-create-refund.html) | 코드 확인 · `order-balance-settlement`는 별도 라우트가 아니라 이 페이지의 장면 |
| order-request-transfer | 소유권 이전 · `OrderRequestTransfer` | `/orders/:id/transfer` · Customer ⋯ Transfer ownership · `customer:update`+`order:update` | [N20](navigation.md#n20) | [절](#order-request-transfer) · [HTML](details/screens/order-request-transfer.html) | 코드 확인 |
| order-edit-email | 이메일 수정 · `OrderEditEmail` | `/orders/:id/email` · Customer ⋯ Email · `order:update` | [N21](navigation.md#n21) | [절](#order-edit-email) · [HTML](details/screens/order-edit-email.html) | 코드 확인 |
| order-edit-shipping-address | 배송지 수정 · `OrderEditShippingAddress` | `/orders/:id/shipping-address` · Customer ⋯ Shipping address · `order_address:update`+`order:update` | [N22](navigation.md#n22) | [절](#order-edit-shipping-address) · [HTML](details/screens/order-edit-shipping-address.html) | 코드 확인 |
| order-edit-billing-address | 청구지 수정 · `OrderEditBillingAddress` | `/orders/:id/billing-address` · Customer ⋯ Billing address · 위와 같음 | [N22](navigation.md#n22) | [절](#order-edit-billing-address) · [HTML](details/screens/order-edit-billing-address.html) | 코드 확인 |
| order-metadata | 메타데이터 수정 · `OrderMetadata` | `/orders/:id/metadata/edit` · Metadata 카드 아이콘 · `order:update` | [N23](navigation.md#n23) | [절](#order-metadata) · [HTML](details/screens/order-metadata.html) | 코드 확인 |

- 대상 페이지는 17개이고 HTML도 17개로 1:1 대응한다. 동적 경로(`:id`, `:f_id`, `:return_id`)는 하나의 페이지로 묶었다.
- 페이지가 아닌 것으로 분류한 대상:
  - `/orders` 라우트 그룹: UI가 없는 권한 가드 래퍼다.
  - `order-balance-settlement` 폴더: 라우트에 등록되어 있지 않고 환불 페이지의 장면으로만 쓰인다.
  - JSON 드로어: 라우트가 없으며 상세 페이지의 장면이다.
  - AccessDenied와 ErrorBoundary 404: 각 페이지의 장면으로 기록했다.
- 범위 밖으로 둔 대상:
  - 상세에서 링크로 이어지는 고객 상세 `/customers/:id`, 위치 설정 `/settings/locations/:id`, 사용자 상세, 고객 상세 안의 주문 이전 라우트 `/customers/:id/:order_id/transfer`.
  - 설정형 목록 테이블(`view_configurations` 플래그 변형). [주문 목록](#order-list) 설명에만 기록했고 HTML로 재현하지 않았다.

## 공통 셸

```layout
Screen > Sidebar : 15, Main : 85
Sidebar V Store Switcher, Nav Menu, User Menu
Main V Topbar, Content
Topbar > Sidebar Toggle, Breadcrumbs, Topbar Actions
Topbar Actions > Layout Customizer, Notifications
```

- **Sidebar**: 데스크톱에서는 220px 고정이고 오른쪽에 테두리가 있다. Nav Menu의 Orders 항목은 `order:read` 권한이 있을 때만 보인다.
- **Breadcrumbs**: 마지막 항목을 뺀 나머지는 링크이며, 누르면 그 경로에서 기억해 둔 query를 복원한다.
- **Content**: 최대 1600px, 안쪽 여백 `p-3`, 섹션 간격 `gap-y-2`다. 화면을 이동하는 동안에는 상단에 진행 막대가 나타나고(200ms 지연), 본문이 흐려진다.
- 작은 화면에서는 Sidebar가 숨고 Sidebar Toggle로 연다.
- 하위 작업 화면은 이 셸과 상세 페이지 위에 겹쳐 뜬다. 형태는 두 가지다.
  - **FocusModal**: 전체 화면에서 사방 8px 안쪽에 뜬다. 헤더 왼쪽에 X와 `esc`가 있고, 아래쪽 버튼은 오른쪽으로 정렬된다.
  - **Drawer**: 오른쪽에서 열리며 최대 560px이다. 헤더 왼쪽에 제목, 오른쪽에 `esc`와 X가 있다.
- 두 형태 모두 Cmd/Ctrl+Enter로 제출한다. Enter만 눌러서는 제출되지 않는다.
- 폼을 고친 상태에서 경로가 바뀌면 이탈 확인 프롬프트가 뜬다.

<a id="order-list"></a>
## 주문 목록 (order-list)

[HTML](details/screens/order-list.html) · Navigation [N01](navigation.md#n01), [N02](navigation.md#n02)

```layout
Screen V Widgets Before, Orders Card, Widgets After
Orders Card V Card Header, Toolbar, Order Table, Pagination
Card Header > Title Orders, Export Button
Toolbar > Filter Bar : 60, Search : 25, Order By : 15
```

- **Card Header**: 제목 "Orders"와 Export(secondary) 버튼이 있다. Export는 현재 query를 붙여 내보내기 드로어를 연다.
- **Toolbar**: 필터(Region, Sales Channel, Created, Updated), 검색(placeholder "Search"), 정렬(Display ID, Created, Updated)이 있다.
- **Order Table**
  - 열: Order, Date, Customer, Sales Channel, Payment, Fulfillment, Order Total, 국기.
  - Customer 열은 `customer:read`, Sales Channel 열은 `sales_channel:read` 권한이 있을 때만 보인다.
  - Payment와 Fulfillment는 색 점과 문구로 상태를 표시한다(색 대응은 [분석서 용어](system-design-as-is.md#3-핵심-용어) 참고).
  - 행 전체가 상세 화면으로 가는 링크다.
- **Pagination**: 20건 단위이며 "of / results / pages / Prev / Next"를 표시한다.
- **Widgets Before/After**: 확장 위젯이 들어가는 영역(`order.list` 존)이다. 기본 화면에서는 비어 있다.
- **상태별 표시**
  - 로딩: 스켈레톤 20행.
  - 주문 0건: 툴바 없이 "No records".
  - 검색·필터 결과 없음: 툴바는 남고 "No results".
  - 조회 실패: ErrorBoundary.
  - 권한 없음: AccessDenied.
- **반응형**: 표는 가로로 스크롤하고, 작은 화면에서는 사이드바가 숨는다.
- **설정형 목록 변형**(`view_configurations` 플래그, HTML 미재현)
  - 열 보이기·숨기기, 뷰 선택, 뷰 저장이 추가된다.
  - Total이 `$` 기호와 `/100` 계산으로 하드코딩되어 있다.
  - 빈 목록 제목 "No orders found"가 번역되지 않는다.

| 장면 ID·이름 | 관련 시나리오·진입 동작/조건 | 보이는 내용·다음 동작/결과 | HTML의 장면 링크·전환 방법 | 근거·확인/재현 상태 |
| --- | --- | --- | --- | --- |
| default · 목록 | N01 · 메뉴 진입 | 8열 표, 행 클릭 시 상세 | [#default](details/screens/order-list.html#default) | 코드 확인 · 재현 |
| loading · 로딩 | N01 · 첫 조회 | 스켈레톤 | [#loading](details/screens/order-list.html#loading) | 코드 확인 · 재현 |
| empty · 빈 목록 | N01 · 주문 0건 | "No records / Your orders will show up here.", 툴바 없음 | [#empty](details/screens/order-list.html#empty) | 코드 확인 · 재현 |
| no-results · 결과 없음 | N01 · 조건 결과 0건 | "No results / Try changing the filters or search query" | [#no-results](details/screens/order-list.html#no-results) | 코드 확인 · 재현 |
| error · 오류 | N01 · 조회 실패 | ErrorBoundary | [#error](details/screens/order-list.html#error) | 코드 확인 · 재현 |
| access-denied · 권한 거부 | N01 · `order:read` 없음 | AccessDenied "Required permission: order:read" | [#access-denied](details/screens/order-list.html#access-denied) | 코드 확인 · 재현 |
| export-started · 내보내기 접수 | N02 · Export 성공 | 목록 + info 토스트 "Export started" | [#export-started](details/screens/order-list.html#export-started) | 코드 확인 · 재현 |

<a id="order-export"></a>
## 주문 내보내기 (order-export)

[HTML](details/screens/order-export.html) · Navigation [N02](navigation.md#n02)

```layout
Screen V Drawer Header, Drawer Body, Drawer Footer
Drawer Header > Title Export Order List, Close Controls
Drawer Body V Filters Heading, Filters Description, Read Only Filter Chips
Drawer Footer > Cancel Button, Export Button
```

- 목록 위에 드로어로 뜬다. 본문에는 현재 목록에 적용된 필터가 읽기 전용 칩으로 보인다. 필터가 없으면 이 영역은 비어 있다.
- Export 버튼에는 처리 중 표시가 없다. 실패하면 오류 토스트가 뜨고 드로어는 그대로 남는다. 이탈 확인 프롬프트는 없다.

| 장면 ID·이름 | 관련 시나리오·진입 동작/조건 | 보이는 내용·다음 동작/결과 | HTML의 장면 링크·전환 방법 | 근거·확인/재현 상태 |
| --- | --- | --- | --- | --- |
| default · 기본 | N02 · Export 클릭 | 필터 요약, Cancel/Export | [#default](details/screens/order-export.html#default) | 코드 확인 · 재현 |
| failed · 실패 | N02 · 요청 오류 | 오류 토스트, 드로어 유지 | [#failed](details/screens/order-export.html#failed) | 코드 확인 · 재현 |

<a id="order-detail"></a>
## 주문 상세 (order-detail)

[HTML](details/screens/order-detail.html) · Navigation [N03](navigation.md#n03)~[N25](navigation.md#n25)

```layout
Screen > Main Column : 70, Side Column : 30
Main Column V Active Change Banner, General Section, Summary Section, Payment Section, Fulfillment Section, Metadata Section, JSON Section
Side Column V Customer Section, Activity Section
General Section > Order Identity, Status Badges, General Menu
Summary Section V Summary Header, Item Rows, Cost Breakdown, Discount Block, Paid And Outstanding, Summary Action Bar
Payment Section V Payment Header, Pending Authorization Banner, Payment Rows, Payment Totals
Fulfillment Section V Unfulfilled Items Card, Fulfillment Cards
```

- **열 배치**: `xl`(1280px) 이상에서는 `minmax(0,1fr) 440px` 2열이고, 그보다 좁으면 세로로 쌓인다. 그림의 70:30은 상대 가중치일 뿐이며 사이드 열은 440px로 고정이다.
- **Active Change Banner**: 미리보기에 `order_change`가 있을 때만 줄무늬 배경 위에 흰 카드로 뜬다.
  - 반품: "Return initiated", 버튼 Cancel Return / Continue.
  - 클레임: "Claim initiated", 버튼 Cancel Claim / Continue.
  - 교환: "Exchange initiated", 버튼 Cancel Exchange / Continue.
  - 편집 대기: "Order edit pending", 버튼 Continue edit / Cancel.
  - 편집 요청됨: "Order edit requested", 버튼 Force confirm / Cancel. 편집 배너에는 추가·삭제된 품목도 함께 나온다.
- **General Section**: `#display_id`와 복사 버튼, "날짜 from 판매채널", 배지(취소된 주문만 Canceled, 결제 상태, 이행 상태)가 있다. ⋯ 메뉴에는 Cancel 하나뿐이다.
- **Summary Section**
  - 품목 행: 썸네일, 제목, SKU, 옵션, 단가, 수량, 예약 배지(Allocated / Not allocated), 소계. 행 아래에 반품·손상·클레임·교환 내역이 붙는다.
  - 금액 블록: Item Subtotal, Shipping, Tax, Order Total, Discount, Credit lines, Paid Total, Outstanding amount.
  - 하단 회색 액션바(조건부): Receive items, Allocate items, Copy payment link, Mark as paid, Refund $.
  - 헤더 ⋯ 메뉴: Edit order, Create Return, Create Exchange, Create Claim. 출고된 품목이 없으면 반품·교환·클레임 항목이 비활성이다.
- **Payment Section**
  - 결제 행: ID, 날짜, provider(기본 시스템 제공자는 "System (DEFAULT)"), 상태 배지, 금액, ⋯ Refund.
  - 아직 매입하지 않은 결제에는 "ready to be captured" 줄과 Capture payment 버튼이 붙는다.
  - 환불 행은 회색 배경으로 표시한다.
  - 하단에 Total paid by customer와 Total pending을 보여 준다.
- **Fulfillment Section**
  - Unfulfilled Items 카드: 배송이 필요한 품목과 필요 없는 품목으로 나뉘어 최대 2장이다. ⋯ 메뉴에 Fulfill items가 있다.
  - Fulfillment #N 카드: 상태 배지, Items, Shipping from, Provider, Tracking을 보여 준다. ⋯ 메뉴에 Cancel이 있고, 하단에 Mark as delivered(또는 picked up)와 Mark as shipped 버튼이 이 순서로 놓인다.
- **Customer Section**: ID(고객 링크), Contact, Company, Shipping address, Billing address를 보여 준다. ⋯ 메뉴에는 Transfer ownership, Shipping address, Billing address, Email이 있다.
- **Activity Section**
  - 최신순으로 정렬하고 "Order placed"는 항상 맨 아래에 둔다.
  - 항목이 4개 이상이면 최신 2개, "Show n more activities"로 접은 부분, 마지막 1개만 보인다.
  - 반품, 클레임, 교환, 이전 요청 항목에는 인라인 Cancel이 붙는다.
- **Metadata / JSON**: 둘 다 키 개수 배지와 아이콘 버튼이 있다. Metadata 아이콘은 편집 라우트로 이동하고, JSON 아이콘은 같은 페이지 안에서 드로어를 연다.
- **위젯 존과 권한**: 위젯 존은 `order.details`와 `order.details.side`다. 섹션 권한이 없으면 그 섹션은 아무 표시 없이 빠진다.
- **상태별 표시**: 로딩은 TwoColumnPageSkeleton, 404와 오류는 ErrorBoundary, 권한 없음은 AccessDenied다.

| 장면 ID·이름 | 관련 시나리오·진입 동작/조건 | 보이는 내용·다음 동작/결과 | HTML의 장면 링크·전환 방법 | 근거·확인/재현 상태 |
| --- | --- | --- | --- | --- |
| default · 기본 | N03 · 조회 완료 | 전체 섹션, Unfulfilled Items 카드 | [#default](details/screens/order-detail.html#default) | 코드 확인 · 재현 |
| loading · 로딩 | N03 · 주문·미리보기 대기 | 2열 스켈레톤 | [#loading](details/screens/order-detail.html#loading) | 코드 확인 · 재현 |
| not-found · 404 | N03 · 없는 주문 | "404 - There is no page at this address" | [#not-found](details/screens/order-detail.html#not-found) | 코드 확인 · 재현 |
| access-denied · 권한 거부 | N03, N25 · 권한 없음 | AccessDenied 카드 | [#access-denied](details/screens/order-detail.html#access-denied) | 코드 확인 · 재현 |
| menu-general · General 메뉴 | N04 | ⋯ Cancel | [#menu-general](details/screens/order-detail.html#menu-general) | 재현 |
| cancel-prompt · 취소 확인 | N04 | 위험 프롬프트 Continue/Cancel | [#cancel-prompt](details/screens/order-detail.html#cancel-prompt) | 코드 확인 · 재현 |
| canceled · 취소됨 | N04 · 취소 성공 | Canceled 배지, 미출고 카드 숨김 | [#canceled](details/screens/order-detail.html#canceled) | 코드 확인 · 재현 |
| menu-summary · Summary 메뉴 | N14, N17~N19 | Edit order / Create Return / Exchange / Claim | [#menu-summary](details/screens/order-detail.html#menu-summary) | 재현 |
| menu-unfulfilled · 미출고 메뉴 | N05 | Fulfill items | [#menu-unfulfilled](details/screens/order-detail.html#menu-unfulfilled) | 재현 |
| fulfilled · 이행 카드 | N07~N09 · 출고 후 | Fulfillment #1 Awaiting shipping, Mark as delivered/shipped | [#fulfilled](details/screens/order-detail.html#fulfilled) | 재현 |
| menu-fulfillment · 이행 메뉴 | N09 | ⋯ Cancel | [#menu-fulfillment](details/screens/order-detail.html#menu-fulfillment) | 재현 |
| cancel-fulfillment-prompt · 이행 취소 확인 | N09 | 위험 프롬프트 | [#cancel-fulfillment-prompt](details/screens/order-detail.html#cancel-fulfillment-prompt) | 재현 |
| deliver-prompt · 배달 확인 | N08 | Send notification 스위치 포함 프롬프트 | [#deliver-prompt](details/screens/order-detail.html#deliver-prompt) | 재현 |
| shipped · 배송됨 | N07 · 배송 처리 성공 | Shipped 배지, Tracking 링크 | [#shipped](details/screens/order-detail.html#shipped) | 재현 |
| awaiting-payment · 미결 결제 | N10, N12 | Copy payment link / Mark as paid, Capture payment 줄 | [#awaiting-payment](details/screens/order-detail.html#awaiting-payment) | 재현 · 두 데이터 상태를 한 장면에 합침 |
| mark-paid-prompt · 결제 완료 확인 | N12 | 확인 프롬프트 | [#mark-paid-prompt](details/screens/order-detail.html#mark-paid-prompt) | 재현 |
| capture-prompt · 매입 확인 | N10 | 확인 프롬프트 | [#capture-prompt](details/screens/order-detail.html#capture-prompt) | 재현 |
| awaiting-authorization · 승인 대기 | N11 | 대기 배너, Check status | [#awaiting-authorization](details/screens/order-detail.html#awaiting-authorization) | 재현 |
| menu-payment · 결제 메뉴 | N13 | ⋯ Refund | [#menu-payment](details/screens/order-detail.html#menu-payment) | 재현 |
| refund-due · 환불 필요 | N13 · 미결 차액 음수 | Refund $ 버튼 | [#refund-due](details/screens/order-detail.html#refund-due) | 재현 |
| return-active · 진행 중 반품 | N14 | Return initiated 배너 | [#return-active](details/screens/order-detail.html#return-active) | 재현 |
| claim-active · 진행 중 클레임 | N17 | Claim initiated 배너 | [#claim-active](details/screens/order-detail.html#claim-active) | 재현 |
| exchange-active · 진행 중 교환 | N18 | Exchange initiated 배너 | [#exchange-active](details/screens/order-detail.html#exchange-active) | 재현 |
| edit-pending · 편집 대기 | N19 | Order edit pending 배너 | [#edit-pending](details/screens/order-detail.html#edit-pending) | 재현 |
| edit-requested · 편집 요청됨 | N19 · 편집 요청 성공 | Force confirm / Cancel | [#edit-requested](details/screens/order-detail.html#edit-requested) | 재현 |
| return-requested · 반품 요청됨 | N14~N16 | Receive items 버튼, 활동 반품 요청과 Cancel | [#return-requested](details/screens/order-detail.html#return-requested) | 재현 |
| return-cancel-prompt · 반품 취소 확인 | N16 | 위험 프롬프트 | [#return-cancel-prompt](details/screens/order-detail.html#return-cancel-prompt) | 재현 |
| transfer-requested · 이전 요청됨 | N20 | 활동 From/To와 Cancel | [#transfer-requested](details/screens/order-detail.html#transfer-requested) | 재현 |
| transfer-cancel-prompt · 이전 취소 확인 | N20 | Delete 버튼 프롬프트 | [#transfer-cancel-prompt](details/screens/order-detail.html#transfer-cancel-prompt) | 재현 |
| menu-customer · Customer 메뉴 | N20~N22 | 4개 항목 | [#menu-customer](details/screens/order-detail.html#menu-customer) | 재현 |
| json-drawer · JSON 드로어 | N24 | 주문 JSON | [#json-drawer](details/screens/order-detail.html#json-drawer) | 재현 |
| toast-success · 성공 토스트 | 하위 작업 성공 후 복귀 | 상세 + 성공 토스트(문구는 작업마다 다름, navigation 참고) | [#toast-success](details/screens/order-detail.html#toast-success) | 대표 문구로 재현 |
| toast-error · 변경 진행 오류 | N14, N15, N17~N19, N25 | 상세 + 오류 토스트 | [#toast-error](details/screens/order-detail.html#toast-error) | 재현 |

<a id="order-create-fulfillment"></a>
## 출고 생성 (order-create-fulfillment)

[HTML](details/screens/order-create-fulfillment.html) · Navigation [N05](navigation.md#n05)

```layout
Screen V Modal Header, Modal Body, Modal Footer
Modal Header > Close Button, Esc Hint
Modal Body V Location Field, Shipping Method Field, Method Changed Alert, Items Field, Notification Field
Location Field > Location Label And Hint : 50, Location Combobox : 50
Shipping Method Field > Method Label And Hint : 50, Method Combobox : 50
Items Field V Items Label And Hint, Fulfillment Item Cards, No Items Alert
Modal Footer > Cancel Button, Create Fulfillment Button
```

- 헤더에는 제목이 없다. 본문은 `p-16` 안쪽에 가운데 정렬된 최대 736px 열이며, 구역 사이는 점선으로 나뉜다. 라벨과 컨트롤은 `xl` 이상에서 좌우 2열이고, 그보다 좁으면 세로로 쌓인다.
- 품목 카드에는 썸네일, 제목(SKU), 변형, Available, In stock, 수량 입력("/ N qty.")이 있다. 재고를 관리하지 않거나 해당 위치에 재고 수준이 없으면 Available과 In stock은 "N/A"로 표시된다.
- 위치를 고르기 전에는 Shipping method를 선택할 수 없다. 배송방법이 없으면 Create Fulfillment도 비활성이다.

| 장면 ID·이름 | 관련 시나리오·진입 동작/조건 | 보이는 내용·다음 동작/결과 | HTML의 장면 링크·전환 방법 | 근거·확인/재현 상태 |
| --- | --- | --- | --- | --- |
| default · 기본 | N05 | 위치·배송방법 미리 채움 | [#default](details/screens/order-create-fulfillment.html#default) | 재현 |
| loading · 로딩 | N05, N25 | 빈 모달 | [#loading](details/screens/order-create-fulfillment.html#loading) | 재현 |
| no-option · 배송방법 미지정 | N05 · 고객 배송방법에 옵션 ID 없음 | 미리 채움 없음, 품목 회색·N/A, 제출 비활성 | [#no-option](details/screens/order-create-fulfillment.html#no-option) | 재현 |
| method-changed · 배송방법 변경 | N05 | "Be aware" 경고 | [#method-changed](details/screens/order-create-fulfillment.html#method-changed) | 재현 |
| profile-mismatch · 프로필 불일치 | N05 | 회색 카드 + 툴팁 | [#profile-mismatch](details/screens/order-create-fulfillment.html#profile-mismatch) | 재현 |
| qty-error · 수량 오류 | N05 | 인라인 오류 | [#qty-error](details/screens/order-create-fulfillment.html#qty-error) | 재현 |
| no-items · 품목 없음 | N05 | "No items to fulfill." | [#no-items](details/screens/order-create-fulfillment.html#no-items) | 재현 |
| failed · 실패 | N05 | 오류 토스트 | [#failed](details/screens/order-create-fulfillment.html#failed) | 재현 |
| leave-prompt · 이탈 확인 | N05 | 이탈 프롬프트 | [#leave-prompt](details/screens/order-create-fulfillment.html#leave-prompt) | 재현 |

<a id="order-allocate-items"></a>
## 재고 할당 (order-allocate-items)

[HTML](details/screens/order-allocate-items.html) · Navigation [N06](navigation.md#n06)

```layout
Screen V Modal Header, Modal Body, Modal Footer
Modal Body V Heading Allocate Order Items, Location Field, Items Field
Location Field > Location Label And Hint : 50, Location Select : 50
Items Field V Items Header, Unallocated Alert, Allocation Item Cards
Items Header > Items Label And Hint, Item Search
Modal Footer > Cancel Button, Allocate Items Button
```

- 품목 카드는 최소 너비가 720px이라 좁은 화면에서는 가로로 스크롤된다. 입력한 수량이 가용량을 넘으면 빨간 아이콘과 `-qty`가 표시된다.
- 키트 품목은 "Consists of Nx inventory items" 토글로 하위 재고 항목 행을 펼친다. 키트에는 Available과 In stock을 표시하지 않는다.
- 빈 상태 UI는 없다(코드에 TODO로 남아 있다). 할당할 품목이 없으면 목록이 그냥 비어 보인다.

| 장면 ID·이름 | 관련 시나리오·진입 동작/조건 | 보이는 내용·다음 동작/결과 | HTML의 장면 링크·전환 방법 | 근거·확인/재현 상태 |
| --- | --- | --- | --- | --- |
| default · 위치 미선택 | N06 | 입력·제출 비활성 | [#default](details/screens/order-allocate-items.html#default) | 재현 |
| location-selected · 위치 선택 | N06 | 가용량 표시, 입력 가능 | [#location-selected](details/screens/order-allocate-items.html#location-selected) | 재현 |
| over-allocation · 초과 할당 | N06 | 빨간 표시, 제출 비활성 | [#over-allocation](details/screens/order-allocate-items.html#over-allocation) | 재현 |
| kit-expanded · 키트 펼침 | N06 | 하위 재고 항목 행 | [#kit-expanded](details/screens/order-allocate-items.html#kit-expanded) | 재현 |
| unallocated-error · 미입력 오류 | N06 | "There are unallocated items." | [#unallocated-error](details/screens/order-allocate-items.html#unallocated-error) | 재현 |
| partial-failure · 일부 실패 | N06 | 상세 배경 + 오류 토스트 | [#partial-failure](details/screens/order-allocate-items.html#partial-failure) | 재현 |
| loading · 로딩 | N06 | 빈 모달 | [#loading](details/screens/order-allocate-items.html#loading) | 재현 |

<a id="order-create-shipment"></a>
## 배송 처리 (order-create-shipment)

[HTML](details/screens/order-create-shipment.html) · Navigation [N07](navigation.md#n07)

```layout
Screen V Modal Header, Modal Body, Modal Footer
Modal Body V Heading Mark Fulfillment Shipped, Tracking Rows, Add Tracking Button, Notification Field
Tracking Rows > Tracking Number : 30, Tracking URL : 30, Label URL : 30, Remove Row : 10
Modal Footer > Cancel Button, Save Button
```

- 처음에는 추적 행이 없다.
- `md` 이상에서는 첫 행에만 라벨이 붙어 표 머리글처럼 보인다. 모바일에서는 행마다 입력란이 세로로 쌓인다.
- 행을 추가해 폼이 바뀐 뒤 닫으면 이탈 프롬프트가 뜬다. 이 장면은 HTML로 재현하지 않았다.

| 장면 ID·이름 | 관련 시나리오·진입 동작/조건 | 보이는 내용·다음 동작/결과 | HTML의 장면 링크·전환 방법 | 근거·확인/재현 상태 |
| --- | --- | --- | --- | --- |
| default · 기본 | N07 | 행 없음, Add tracking number | [#default](details/screens/order-create-shipment.html#default) | 재현 |
| with-rows · 추적 행 | N07 | 행 2개 | [#with-rows](details/screens/order-create-shipment.html#with-rows) | 재현 |
| failed · 실패 | N07 | 오류 토스트 | [#failed](details/screens/order-create-shipment.html#failed) | 재현 |
| loading · 로딩 | N07 | 빈 모달 | [#loading](details/screens/order-create-shipment.html#loading) | 재현 |

<a id="order-receive-return"></a>
## 반품 수령 (order-receive-return)

[HTML](details/screens/order-receive-return.html) · Navigation [N15](navigation.md#n15)

```layout
Screen V Drawer Header, Drawer Body, Drawer Footer
Drawer Header > Title Receive Items, Close Controls
Drawer Body V Location Row, Receive Item Cards, Totals, Inventory Warning, Notification Card
Receive Item Cards > Item Info : 60, Damaged Button : 15, Received Quantity : 25
Totals V Order Total, Outstanding Amount
Drawer Footer > Cancel Button, Save Button
```

- 품목 카드는 `md` 이상에서 가로로 배치된다. 손상 버튼을 누르면 손상 수량을 입력하는 팝오버가 열린다.
- 알림 스위치는 카드 왼쪽에 있고 기본값이 off다. 다른 화면은 대부분 on이 기본이다.
- `order:update` 권한이 없으면 Save 버튼이 나오지 않는다. Save에는 로딩 표시가 없다(`isLoading=false`).

| 장면 ID·이름 | 관련 시나리오·진입 동작/조건 | 보이는 내용·다음 동작/결과 | HTML의 장면 링크·전환 방법 | 근거·확인/재현 상태 |
| --- | --- | --- | --- | --- |
| default · 기본 | N15 | 전량 수령 미리 채움 | [#default](details/screens/order-receive-return.html#default) | 재현 |
| damaged-popover · 손상 팝오버 | N15 | 손상 수량 입력 | [#damaged-popover](details/screens/order-receive-return.html#damaged-popover) | 재현 |
| qty-toast · 수량 토스트 | N15 | 요청 수량 초과 토스트 | [#qty-toast](details/screens/order-receive-return.html#qty-toast) | 재현 |
| no-permission · 권한 없음 | N15 | Save 없음 | [#no-permission](details/screens/order-receive-return.html#no-permission) | 재현 |
| leave-prompt · 이탈 확인 | N15 | 이탈 프롬프트 | [#leave-prompt](details/screens/order-receive-return.html#leave-prompt) | 재현 · 서버 취소 시점 미확인 |
| failed · 실패 | N15 | 오류 토스트 | [#failed](details/screens/order-receive-return.html#failed) | 재현 |
| loading · 로딩 | N15 | 제목만 | [#loading](details/screens/order-receive-return.html#loading) | 재현 |

<a id="order-create-return"></a>
## 반품 생성 (order-create-return)

[HTML](details/screens/order-create-return.html) · Navigation [N14](navigation.md#n14)

```layout
Screen V Modal Header, Modal Body, Modal Footer
Modal Body V Heading Create Return, Inbound Header, Return Item Cards, Location Field, Return Shipping Field, Inventory Alert, Totals, Notification Card
Inbound Header > Inbound Title, Add Items Link
Location Field > Location Label And Hint : 50, Location Combobox : 50
Return Shipping Field > Shipping Label And Hint : 50, Shipping Combobox : 50
Totals V Return Total, Return Shipping Cost, Estimated Difference
Modal Footer > Cancel Return Button, Confirm Return Button
```

- 본문은 가운데 720px 열이고, 필드 행은 `md` 이상에서 2열이다.
- 품목이 하나도 없으면 줄무늬 자리표시가 나오고, Location과 Return shipping은 숨는다.
- Add items를 누르면 겹친 FocusModal 안에 품목 표가 열린다.
  - 열: 체크박스, Product, SKU, Variant, Quantity, Price.
  - 검색, 필터, 정렬, 페이지네이션(50건 단위)을 지원한다.
  - 표가 열려 있는 동안 부모 모달은 줄어들고 회색으로 바뀐다.
- Confirm Return 버튼은 `order:update` 권한이 있을 때만 보인다.

| 장면 ID·이름 | 관련 시나리오·진입 동작/조건 | 보이는 내용·다음 동작/결과 | HTML의 장면 링크·전환 방법 | 근거·확인/재현 상태 |
| --- | --- | --- | --- | --- |
| loading · 로딩 | N14 | 빈 모달 | [#loading](details/screens/order-create-return.html#loading) | 재현 |
| default · 빈 반품 | N14 | 자리표시, 합계 | [#default](details/screens/order-create-return.html#default) | 재현 |
| add-items · 품목 표 | N14 | 겹친 모달 품목 표 | [#add-items](details/screens/order-create-return.html#add-items) | 재현 |
| items-added · 품목 추가됨 | N14 | 카드, 위치, 배송, 합계 | [#items-added](details/screens/order-create-return.html#items-added) | 재현 |
| item-menu · 품목 메뉴 | N14 | 품목 ⋯ 메뉴(Add Reason, Add Note, Remove) | [#item-menu](details/screens/order-create-return.html#item-menu) | 재현 |
| no-shipping-options · 배송 옵션 없음 | N14 | 안내 + 설정 링크 | [#no-shipping-options](details/screens/order-create-return.html#no-shipping-options) | 재현 |
| inventory-warning · 재고 경고 | N14 | "No inventory level" | [#inventory-warning](details/screens/order-create-return.html#inventory-warning) | 재현 |
| confirm-prompt · 확정 확인 | N14 | 확인 프롬프트 | [#confirm-prompt](details/screens/order-create-return.html#confirm-prompt) | 재현 |
| failed · 실패 | N14 | 오류 토스트 | [#failed](details/screens/order-create-return.html#failed) | 재현 |

<a id="order-create-claim"></a>
## 클레임 생성 (order-create-claim)

[HTML](details/screens/order-create-claim.html) · Navigation [N17](navigation.md#n17)

```layout
Screen V Modal Header, Modal Body, Modal Footer
Modal Body V Heading Create Claim, Inbound Block, Outbound Block, Totals, Carry Over Promotions Card, Notification Card
Inbound Block V Inbound Header, Inbound Item Cards, Location Field, Return Shipping Field, Inbound Inventory Alert
Outbound Block V Outbound Header, Outbound Item Cards, Outbound Shipping Field, Outbound Inventory Alert
Totals V Inbound Total, Outbound Total, Return Shipping Cost, Outbound Shipping Cost, Estimated Difference
Modal Footer > Cancel Claim Button, Confirm Claim Button
```

- Inbound 품목 표는 반품과 같다. 다만 이미 추가한 품목도 표에서 선택을 다시 바꿀 수 있다.
- Outbound 품목 표는 상품 변형 목록이다(Product, SKU, Title, Inventory). Outbound 품목 메뉴에는 Remove만 있다.
- Carry over promotions 카드는 주문에 프로모션이 있을 때만 보인다.
- 클레임 유형(환불형인지 교체형인지)을 고르는 UI는 없다.

| 장면 ID·이름 | 관련 시나리오·진입 동작/조건 | 보이는 내용·다음 동작/결과 | HTML의 장면 링크·전환 방법 | 근거·확인/재현 상태 |
| --- | --- | --- | --- | --- |
| loading · 로딩 | N17 | 빈 모달 | [#loading](details/screens/order-create-claim.html#loading) | 재현 |
| default · 빈 클레임 | N17 | Inbound/Outbound 자리표시 | [#default](details/screens/order-create-claim.html#default) | 재현 |
| add-inbound · 반품 품목 표 | N17 | 겹친 표 | [#add-inbound](details/screens/order-create-claim.html#add-inbound) | 재현 |
| add-outbound · 발송 품목 표 | N17 | 변형 표 | [#add-outbound](details/screens/order-create-claim.html#add-outbound) | 재현 |
| items-added · 품목 추가됨 | N17 | 양방향 카드와 합계 | [#items-added](details/screens/order-create-claim.html#items-added) | 재현 |
| item-menu · 품목 메뉴 | N17 | 품목 ⋯ 메뉴 | [#item-menu](details/screens/order-create-claim.html#item-menu) | 재현 |
| confirm-prompt · 확정 확인 | N17 | 확인 프롬프트 | [#confirm-prompt](details/screens/order-create-claim.html#confirm-prompt) | 재현 |
| failed · 실패 | N17 | 오류 토스트(제목 없이 서버 메시지) | [#failed](details/screens/order-create-claim.html#failed) | 재현 |

<a id="order-create-exchange"></a>
## 교환 생성 (order-create-exchange)

[HTML](details/screens/order-create-exchange.html) · Navigation [N18](navigation.md#n18)

```layout
Screen V Modal Header, Modal Body, Modal Footer
Modal Body V Heading Create Exchange, Inbound Block, Outbound Block, Totals, Carry Over Promotions Card, Notification Card
Inbound Block V Inbound Header, Inbound Item Cards, Location Field, Return Shipping Field
Outbound Block V Outbound Header, Outbound Item Cards, Outbound Shipping Field
Totals V Inbound Total, Outbound Total, Return Shipping Cost, Outbound Shipping Cost, Estimated Difference
Modal Footer > Cancel Exchange Button, Confirm Exchange Button
```

- 구성은 클레임 생성과 같다. 다른 점은 세 가지다.
  - 프로모션 조정이 있는 품목에는 아이콘이 붙는다.
  - Inbound 표의 필터와 정렬 항목이 더 적다.
  - 교환을 확정해도 성공 토스트가 나오지 않는다.

| 장면 ID·이름 | 관련 시나리오·진입 동작/조건 | 보이는 내용·다음 동작/결과 | HTML의 장면 링크·전환 방법 | 근거·확인/재현 상태 |
| --- | --- | --- | --- | --- |
| loading · 로딩 | N18 | 빈 모달 | [#loading](details/screens/order-create-exchange.html#loading) | 재현 |
| default · 빈 교환 | N18 | 자리표시 | [#default](details/screens/order-create-exchange.html#default) | 재현 |
| add-inbound · 반품 품목 표 | N18 | 겹친 표 | [#add-inbound](details/screens/order-create-exchange.html#add-inbound) | 재현 |
| add-outbound · 발송 품목 표 | N18 | 변형 표 | [#add-outbound](details/screens/order-create-exchange.html#add-outbound) | 재현 |
| items-added · 품목 추가됨 | N18 | 양방향 카드와 합계 | [#items-added](details/screens/order-create-exchange.html#items-added) | 재현 |
| item-menu · 품목 메뉴 | N18 | 품목 ⋯ 메뉴 | [#item-menu](details/screens/order-create-exchange.html#item-menu) | 재현 |
| confirm-prompt · 확정 확인 | N18 | 확인 프롬프트 | [#confirm-prompt](details/screens/order-create-exchange.html#confirm-prompt) | 재현 |
| failed · 실패 | N18 | 오류 토스트 | [#failed](details/screens/order-create-exchange.html#failed) | 재현 |

<a id="order-create-edit"></a>
## 주문 편집 (order-create-edit)

[HTML](details/screens/order-create-edit.html) · Navigation [N19](navigation.md#n19)

```layout
Screen V Modal Header, Modal Body, Modal Footer
Modal Body V Heading Edit Order, Items Header, Edit Item Cards, Totals, Note Field, Notification Card
Items Header > Items Title, Item Search, Add Items Button
Totals V Current Total, New Total, Estimated Difference
Note Field > Note Label And Hint : 50, Note Input : 50
Modal Footer > Cancel Edit Button, Confirm Edit Button
```

- 기존 품목을 모두 카드로 보여 준다. 카드 배지는 New(파랑), Modified(주황), Removed(빨강)다.
- ⋯ 메뉴에는 Duplicate와 Remove가 있다. 제거된 품목에서는 Remove 대신 Undo가 나온다.
- 수량은 출고된 수량 밑으로 줄일 수 없다. 전량 출고된 품목은 수량 입력과 Remove가 비활성이다.
- Note 행은 화면 너비와 관계없이 좌우 배치를 유지한다.

| 장면 ID·이름 | 관련 시나리오·진입 동작/조건 | 보이는 내용·다음 동작/결과 | HTML의 장면 링크·전환 방법 | 근거·확인/재현 상태 |
| --- | --- | --- | --- | --- |
| loading · 로딩 | N19 | 빈 모달 | [#loading](details/screens/order-create-edit.html#loading) | 재현 |
| default · 기본 | N19 | 품목 카드, 합계, 메모 | [#default](details/screens/order-create-edit.html#default) | 재현 |
| add-items · 품목 추가 표 | N19 | 변형 표 | [#add-items](details/screens/order-create-edit.html#add-items) | 재현 |
| item-states · 품목 상태 | N19 | New / Modified / Removed 배지 | [#item-states](details/screens/order-create-edit.html#item-states) | 재현 |
| item-menu · 품목 메뉴 | N19 | Duplicate / Remove | [#item-menu](details/screens/order-create-edit.html#item-menu) | 재현 |
| qty-error · 수량 오류 | N19 | 오류 토스트 | [#qty-error](details/screens/order-create-edit.html#qty-error) | 재현 |
| empty-search · 검색 결과 없음 | N19 | 자리표시 | [#empty-search](details/screens/order-create-edit.html#empty-search) | 재현 |
| confirm-prompt · 확정 확인 | N19 | 확인 프롬프트 | [#confirm-prompt](details/screens/order-create-edit.html#confirm-prompt) | 재현 |
| failed · 실패 | N19 | 오류 토스트 | [#failed](details/screens/order-create-edit.html#failed) | 재현 |

<a id="order-create-refund"></a>
## 환불 (order-create-refund)

[HTML](details/screens/order-create-refund.html) · Navigation [N13](navigation.md#n13)

```layout
Screen V Drawer Header, Drawer Body, Drawer Footer
Drawer Header > Title Create Refund, Close Controls
Drawer Body V Settlement Type Choice, Payment Select Or Static Payment, Amount Input, Refund Reason Select, Note Textarea
Drawer Footer > Cancel Button, Save Button
```

- **Settlement Type Choice**는 로열티 플러그인이 있을 때만 나온다. Payment method와 Store credit 선택 상자가 세로로 쌓이며, Store credit을 고르면 아래 필드가 Amount 하나로 줄어든다.
- **결제 표시**: 기본 폼은 `?paymentId`가 있으면 Select 대신 고정된 결제 줄을 보여 준다. 로열티 폼은 이 값이 있어도 Select를 쓴다.
- 결제 옵션은 "금액 - 제공자명 - (#ID 일부)" 형식이다.
- 금액 오류는 입력란에 표시되지 않고 서버 오류 토스트로만 알린다.

| 장면 ID·이름 | 관련 시나리오·진입 동작/조건 | 보이는 내용·다음 동작/결과 | HTML의 장면 링크·전환 방법 | 근거·확인/재현 상태 |
| --- | --- | --- | --- | --- |
| default · 기본 | N13 · Refund $ 버튼 | 결제 Select | [#default](details/screens/order-create-refund.html#default) | 재현 |
| from-payment · 결제 지정 | N13 · 결제 행 Refund | 고정 결제 줄 | [#from-payment](details/screens/order-create-refund.html#from-payment) | 재현 |
| server-error · 서버 거절 | N13 | 매입액 초과 토스트 | [#server-error](details/screens/order-create-refund.html#server-error) | 재현 |
| loyalty-refund · 로열티 환불 | N13 · 플러그인 있음 | Payment method 선택 | [#loyalty-refund](details/screens/order-create-refund.html#loyalty-refund) | 재현 |
| loyalty-credit · 로열티 크레딧 | N13 | Store credit, Amount만 | [#loyalty-credit](details/screens/order-create-refund.html#loyalty-credit) | 재현 |
| credit-disabled · 크레딧 비활성 | N13 · 게스트 주문 | 비활성 사유 문구 | [#credit-disabled](details/screens/order-create-refund.html#credit-disabled) | 재현 |
| loading · 로딩 | N13 | 헤더만 | [#loading](details/screens/order-create-refund.html#loading) | 재현 |

<a id="order-request-transfer"></a>
## 소유권 이전 (order-request-transfer)

[HTML](details/screens/order-request-transfer.html) · Navigation [N20](navigation.md#n20)

```layout
Screen V Drawer Header, Drawer Body, Drawer Footer
Drawer Body V Transfer Illustration, Account Type Radio, Current Owner Input, New Owner Field
Account Type Radio > Registered Choice : 50, Guest Choice : 50
Drawer Footer > Cancel Button, Save Button
```

- New Owner Field는 계정 유형에 따라 바뀐다.
  - Registered: 고객 콤보박스. 계정이 있는 고객만 나오고 검색과 페이지 넘김을 지원한다.
  - Guest: 이메일 입력란.
- 유형을 바꾸면 입력값이 초기화된다. 검증 오류("Required", "Invalid email")가 있으면 Save가 비활성이다.

| 장면 ID·이름 | 관련 시나리오·진입 동작/조건 | 보이는 내용·다음 동작/결과 | HTML의 장면 링크·전환 방법 | 근거·확인/재현 상태 |
| --- | --- | --- | --- | --- |
| default · 등록 고객 | N20 | 콤보박스 | [#default](details/screens/order-request-transfer.html#default) | 재현 |
| guest · 게스트 | N20 | 이메일 입력 | [#guest](details/screens/order-request-transfer.html#guest) | 재현 |
| validation-error · 검증 오류 | N20 | "Required" | [#validation-error](details/screens/order-request-transfer.html#validation-error) | 재현 |
| failed · 실패 | N20 | 오류 토스트 | [#failed](details/screens/order-request-transfer.html#failed) | 재현 |

<a id="order-edit-email"></a>
## 이메일 수정 (order-edit-email)

[HTML](details/screens/order-edit-email.html) · Navigation [N21](navigation.md#n21)

```layout
Screen V Drawer Header, Drawer Body, Drawer Footer
Drawer Body V Email Field
Drawer Footer > Cancel Button, Save Button
```

- 입력란은 Email 하나다. 형식 오류는 입력란 아래에 표시되며, 오류가 있어도 Save는 활성이다.

| 장면 ID·이름 | 관련 시나리오·진입 동작/조건 | 보이는 내용·다음 동작/결과 | HTML의 장면 링크·전환 방법 | 근거·확인/재현 상태 |
| --- | --- | --- | --- | --- |
| default · 기본 | N21 | 현재 이메일 | [#default](details/screens/order-edit-email.html#default) | 재현 |
| invalid · 형식 오류 | N21 | 인라인 오류 | [#invalid](details/screens/order-edit-email.html#invalid) | 재현 · 문구는 zod 기본값 추정 |
| failed · 실패 | N21 | 오류 토스트 | [#failed](details/screens/order-edit-email.html#failed) | 재현 |
| leave-prompt · 이탈 확인 | N21 | 이탈 프롬프트 | [#leave-prompt](details/screens/order-edit-email.html#leave-prompt) | 재현 |

<a id="order-edit-shipping-address"></a>
## 배송지 수정 (order-edit-shipping-address)

[HTML](details/screens/order-edit-shipping-address.html) · Navigation [N22](navigation.md#n22)

```layout
Screen V Drawer Header, Drawer Body, Drawer Footer
Drawer Body V Address, Apartment, Postal Code, City, Country Disabled, State, First Name, Last Name, Company, Phone
Drawer Footer > Cancel Button, Save Button
```

- 10개 필드가 세로로 놓인다. Address만 필수이고 Country는 비활성이다. 오류가 있어도 Save는 활성이다.

| 장면 ID·이름 | 관련 시나리오·진입 동작/조건 | 보이는 내용·다음 동작/결과 | HTML의 장면 링크·전환 방법 | 근거·확인/재현 상태 |
| --- | --- | --- | --- | --- |
| default · 기본 | N22 | 현재 주소 | [#default](details/screens/order-edit-shipping-address.html#default) | 재현 |
| required-error · 필수값 오류 | N22 | Address 오류, Save 활성 | [#required-error](details/screens/order-edit-shipping-address.html#required-error) | 재현 · 문구 추정 |
| failed · 실패 | N22 | 오류 토스트 | [#failed](details/screens/order-edit-shipping-address.html#failed) | 재현 |
| leave-prompt · 이탈 확인 | N22 | 이탈 프롬프트 | [#leave-prompt](details/screens/order-edit-shipping-address.html#leave-prompt) | 재현 |

<a id="order-edit-billing-address"></a>
## 청구지 수정 (order-edit-billing-address)

[HTML](details/screens/order-edit-billing-address.html) · Navigation [N22](navigation.md#n22)

```layout
Screen V Drawer Header, Drawer Body, Drawer Footer
Drawer Body V Address, Apartment, Postal Code, City, Country Disabled, State, First Name, Last Name, Company, Phone
Drawer Footer > Cancel Button, Save Button
```

- 배치는 배송지 수정과 같다. 다른 점은 오류가 있으면 Save가 비활성이 된다는 것이다.
- First/Last Name에도 오류 메시지 영역이 있다. 하지만 두 필드는 스키마에서 선택값이어서 실제로 오류가 나타나지 않는다.

| 장면 ID·이름 | 관련 시나리오·진입 동작/조건 | 보이는 내용·다음 동작/결과 | HTML의 장면 링크·전환 방법 | 근거·확인/재현 상태 |
| --- | --- | --- | --- | --- |
| default · 기본 | N22 | 현재 청구지 | [#default](details/screens/order-edit-billing-address.html#default) | 재현 |
| required-error · 필수값 오류 | N22 | Address 오류, Save 비활성 | [#required-error](details/screens/order-edit-billing-address.html#required-error) | 재현 · 문구 추정 |
| failed · 실패 | N22 | 오류 토스트 | [#failed](details/screens/order-edit-billing-address.html#failed) | 재현 |
| leave-prompt · 이탈 확인 | N22 | 이탈 프롬프트 | [#leave-prompt](details/screens/order-edit-billing-address.html#leave-prompt) | 재현 |

<a id="order-metadata"></a>
## 메타데이터 수정 (order-metadata)

[HTML](details/screens/order-metadata.html) · Navigation [N23](navigation.md#n23)

```layout
Screen V Drawer Header, Drawer Body, Drawer Footer
Drawer Body V Non Primitive Tip, Metadata Grid
Metadata Grid V Grid Header, Metadata Rows
Grid Header > Key Column : 50, Value Column : 50
Drawer Footer > Add Row Button : 50, Footer Actions : 50
Footer Actions > Cancel Button, Save Button
```

- 행에 마우스를 올리면 오른쪽 끝에 ⋯ 메뉴가 나타난다(Insert row above, Insert row below, Delete row). 마지막 행을 지우면 빈 행 하나가 다시 생긴다.
- 값이 객체나 배열인 행은 비활성이며 `{ ... }` 또는 `[ ... ]`로 표시된다. 이런 행이 있으면 경고 팁이 나온다.
- 로딩 중에는 본문과 footer 버튼이 모두 스켈레톤으로 보인다.

| 장면 ID·이름 | 관련 시나리오·진입 동작/조건 | 보이는 내용·다음 동작/결과 | HTML의 장면 링크·전환 방법 | 근거·확인/재현 상태 |
| --- | --- | --- | --- | --- |
| default · 기본 | N23 | Key/Value 행 | [#default](details/screens/order-metadata.html#default) | 재현 |
| loading · 로딩 | N23 | 스켈레톤 | [#loading](details/screens/order-metadata.html#loading) | 재현 |
| row-menu · 행 메뉴 | N23 | 행 ⋯ 메뉴 | [#row-menu](details/screens/order-metadata.html#row-menu) | 재현 |
| non-primitive · 비원시값 | N23 | 비활성 행 + 팁 | [#non-primitive](details/screens/order-metadata.html#non-primitive) | 재현 |
| failed · 실패 | N23 | 오류 토스트 | [#failed](details/screens/order-metadata.html#failed) | 재현 |
| leave-prompt · 이탈 확인 | N23 | 이탈 프롬프트 | [#leave-prompt](details/screens/order-metadata.html#leave-prompt) | 재현 |
