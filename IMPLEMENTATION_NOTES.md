# Implementation Notes

## 1. What I changed

- Fixed `computeDiff` so changes to a line item's description, quantity, or unit price are classified as `changed`.
- Completed the list status filter and added a distinct message when loaded requests do not match the selected filter.
- Added an oldest-first timeline without mutating the API's audit array.
- Gated Approve and Reject by pending status and the existing approval-policy helper. Read-only users do not see action controls.
- Implemented the API calls, disabled duplicate submissions while requests are pending, displayed progress and action errors, and retained the loaded detail after a failed action.
- Required a non-whitespace rejection reason and trimmed it before sending it to the API.
- Updated the mock API to persist a status transition only after its simulated request succeeds.
- Improved the preview to include descriptions as well as quantity and unit price, so description-only changes are understandable.
- Added component/DOM and utility tests for filtering, load/error states, diff output, timeline order, permission visibility, validation, successful actions, duplicate prevention, and failed actions.

## 2. Component and state model

The list screen loads the current user's organization-scoped summaries from `CrApiService` and exposes an explicit loading, loaded, empty, or error state. Its status filter is a view over the loaded rows; it does not change or refetch the underlying data. Selecting a row emits its ID to the demo shell, which passes it to the detail screen. The detail screen loads one CR, derives its diff and chronologically sorted timeline, and renders action controls only when status and policy allow them. Action requests keep the loaded CR visible, expose a submitting state, and either replace it with the successful API response or show an error while retaining the previous detail.

## 3. Invariants

| Invariant                                                                   | How / where                                                        |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Only `PENDING_APPROVAL` CRs are action-eligible                             | `canApprove` and `canReject` in the detail component               |
| Read-only users are not offered actions                                     | Policy helper plus action-section condition in the detail template |
| A rejection needs non-whitespace text                                       | Reactive form validators and a guard in `reject()`                 |
| At most one action request runs at a time per detail component              | `submitting` guard and disabled controls                           |
| Failed actions do not replace the displayed CR or persist a mock transition | Component error handling and API transition settlement             |
| Timeline display does not reorder the stored audit array                    | Sorted copy returned by the `timeline` getter                      |
| List filter does not mutate loaded data                                     | `visibleRows` returns a filtered view                              |

## 4. Testing strategy

Jest/TestBed tests assert rendered DOM for list/detail states, filters, diff descriptions and totals, timeline order, and action visibility. Action tests check validation, successful approval/rejection, duplicate-submit prevention during injected latency, and failure handling through `failNext`; list tests cover loading, empty, filtered-no-match, and error states. The diff utility also has focused unit tests. I ran `npm test -- --runInBand`, `npm run typecheck`, `npm run lint`, and `npm run build`; all passed in the working environment. I did not run a fresh `npm ci` in a clean clone or record the requested walkthrough.

## 5. Assumptions and judgment calls

- The supplied `canApprovePolicy` helper treats any `cr_a_*` policy as approval-capable, and that permission gates both Approve and Reject because the README defines no separate rejection policy.
- The UI offers actions only for `PENDING_APPROVAL`; the mock API remains the source of truth for returned status and organization scope.
- A rejection reason is trimmed before submission; whitespace-only input is invalid.
- The model has no workspace identifier or explicit CR-owner field. Consequently, this UI uses the provided policy helper rather than independently enforcing the `u` versus `w` approval scopes; a production authorization contract should supply the data and rules needed for that distinction.
- The exercise does not call for a backend or additional UI dependencies, so the existing mock API and plain Angular templates were retained.

## 6. AI usage

I used AI assistance to review the brief and README, organize the work into the assessment's bug-fix, list, detail/action, test, and documentation steps, and help refactor focused component/API code and expand the tests. I reviewed the resulting changes, ran the project checks, and am responsible for understanding and explaining the implementation.

