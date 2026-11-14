# 관리화면(admin-dashboard) 내부 Job Flow — AS-IS

관리화면은 `packages/admin/dashboard` React SPA다. 데이터는 React Query로 가져오고, 화면은 react-router의 라우트 모달로 연다. 이 문서는 주문 영역 화면들이 공통으로 쓰는 내부 협력 구조를 모듈 깊이에서 그린다. 화면별 이동과 장면은 [navigation-admin.md](../../navigation-admin.md)를 따른다.

| 그림 이름 | 구현 | 책임 |
| --- | --- | --- |
| RouteModal | `components/modals/route-focus-modal`, `route-drawer`, `route-modal-provider` | 열 때 애니메이션, 닫으면 `..`로 `replace` 이동, `handleSuccess`로 성공 상태와 함께 복귀 |
| ModalForm | `components/modals/route-modal-form` | `useBlocker`로 이탈을 감지해 확인 프롬프트를 띄우고, `onClose(isSubmitSuccessful)`를 호출 |
| FormPage | `routes/orders/*` 각 폼 컴포넌트 | zod 스키마 검증, 입력, 제출 |
| ApiHook | `hooks/api/{orders,returns,claims,exchanges,order-edits,payments,payment-collections,reservations}.tsx` | `useMutation`/`useQuery`, 성공 후 쿼리 무효화 |
| Sdk | `@medusajs/js-sdk` admin 클래스 | HTTP 요청(`/admin/...`), 세션 인증 |
| Toast | `@medusajs/ui` toast | 성공·오류 안내 |

## D1. 하위 작업 폼의 제출과 복귀

```jobflow
orchestrator: FormPage
Object: FormPage, ApiHook, Sdk, RouteModal, Toast
FormPage.OnSubmit --> FormPage.Validate
FormPage.Validate.invalid --> FormPage.ShowFieldError
FormPage.Validate.valid --> ApiHook.MutateAsync
ApiHook.MutateAsync --> Sdk.Request
Sdk.Request.success --> ApiHook.InvalidateQueries
ApiHook.InvalidateQueries --> Toast.Success
Toast.Success --> RouteModal.HandleSuccess
Sdk.Request.error --> Toast.Error
```

- 사용자가 제출(Cmd/Ctrl+Enter 또는 Save)하면 폼이 zod 스키마로 입력을 검사한다.
- 검사에 실패하면 해당 필드 아래에 오류를 표시하고 끝난다. 로직이 있는 폼도 있지만, 많은 폼은 스키마가 느슨해서 이 분기가 실제로 거의 쓰이지 않는다.
- 검사를 통과하면 API 훅의 `mutateAsync`를 호출한다.
- API 훅은 SDK를 통해 `/admin/...`에 HTTP 요청을 보낸다.
- 요청이 성공하면 API 훅이 주문 상세, 미리보기, 관련 목록 쿼리를 무효화한다. 그러면 상세 화면이 다시 조회된다.
- 무효화가 끝나면 성공 토스트를 띄운다. 할당, 반품 확정, 교환 확정처럼 성공 토스트가 없는 화면도 있다.
- 토스트 다음에 `handleSuccess()`가 `isSubmitSuccessful` 상태를 붙여 상세로 `replace` 이동한다. 반품 수령은 이동한 뒤에 토스트를 띄워서 순서가 반대다.
- 요청이 실패하면 서버 메시지를 오류 토스트로 보여 주고 모달은 그대로 둔다. 서버 검증 오류를 필드 오류로 바꿔 주는 처리는 없다.

## D2. 모달 이탈과 드래프트 정리

```jobflow
orchestrator: ModalForm
Object: ModalForm, FormPage, RouteModal, Sdk
ModalForm.OnNavigate --> ModalForm.CheckBlock
ModalForm.CheckBlock.submitted --> RouteModal.Close
ModalForm.CheckBlock.clean --> FormPage.OnClose
FormPage.OnClose --> Sdk.CancelDraft
ModalForm.CheckBlock.dirty --> FormPage.OnClose
ModalForm.CheckBlock.dirty --> ModalForm.ShowLeavePrompt
ModalForm.ShowLeavePrompt.continue --> RouteModal.Close
```

- 경로가 바뀌려 하면 ModalForm이 막을지 판단한다. 이 판단은 blocker 함수 안에서 이루어진다.
- 제출에 성공한 이동이면 막지 않고 모달을 닫는다.
- 폼에 변경이 없으면 막지 않고, 폼의 `onClose(false)`를 호출한다.
- 반품 생성, 편집, 반품 수령 화면의 `onClose`는 서버의 드래프트를 지운다. 각각 `DELETE /admin/returns/:id/request`, `DELETE /admin/order-edits/:id`, `DELETE /admin/returns/:id/receive`를 보낸다.
  - 클레임과 교환 화면에는 `onClose`가 없다. 이 두 화면은 footer의 Cancel 버튼만 언마운트 시점에 드래프트를 지운다. 그래서 X나 Esc로 닫으면 드래프트가 남는다.
- 폼에 변경이 있으면 blocker 함수가 **먼저** `onClose(false)`를 호출한다. 드래프트 삭제가 프롬프트보다 앞서 일어나는 것이다.
- 그다음에 이탈 확인 프롬프트를 띄운다. 사용자가 Cancel을 눌러 화면에 남아도 서버 쪽 정리는 이미 끝났을 수 있다(관찰 이슈).
- 사용자가 Continue를 누르면 모달을 닫는다. 이때 `onClose`가 한 번 더 호출될 수 있다.

## D3. 진행 중 변경 검사(반품·클레임·교환·편집·수령 진입)

```jobflow
orchestrator: FormPage
Object: FormPage, ApiHook, RouteModal, Toast
FormPage.OnMount --> ApiHook.LoadPreview
ApiHook.LoadPreview.otherChangeActive --> Toast.Error
Toast.Error --> RouteModal.NavigateBack
ApiHook.LoadPreview.sameTypeActive --> FormPage.ReuseChange
ApiHook.LoadPreview.noChange --> ApiHook.BeginChange
ApiHook.BeginChange.error --> RouteModal.NavigateBack
ApiHook.BeginChange.created --> FormPage.RenderForm
FormPage.ReuseChange --> FormPage.RenderForm
```

- 화면이 열리면 주문 미리보기(`GET /admin/orders/:id/preview`)를 불러온다.
- 다른 유형의 주문 변경이 진행 중이면 오류 토스트를 띄운다.
- 토스트를 띄운 뒤 상세로 `replace` 이동한다.
- 같은 유형의 변경이 이미 있으면 그 ID를 재사용한다. 편집 화면은 상태(pending/requested)와 관계없이 재사용한다.
- 진행 중인 변경이 없으면 시작 API를 호출한다(`POST /admin/returns|claims|exchanges|order-edits`, 수령은 `POST /admin/returns/:id/receive`). 같은 호출이 중복되지 않도록 모듈 수준 플래그 `IS_REQUEST_RUNNING`으로 막는다.
- 시작 API가 실패하면 토스트를 띄우고 상세로 돌아간다.
- 변경이 만들어지면 폼을 그린다. 그 전까지는 내용 없는 모달만 보인다.
- 기존 변경을 재사용하는 경우에도 폼을 그린다.
