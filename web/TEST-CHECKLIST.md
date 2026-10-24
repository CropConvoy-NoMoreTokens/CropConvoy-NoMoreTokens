# Frontend verification and control inventory

Verified locally on 24 October 2026 using Node 24, Vitest/Testing Library, the Codex browser, and Lighthouse against the production build. Repeated instances of the same component (for example per-record copy buttons) share the tested behavior.

## Results

- Production TypeScript/Vite build: passed.
- Automated suite: **35 tests passed across 6 files**.
- Farmer: real browser sample → editable review → explicit publication → generation → acceptance → refresh passed. Acceptance remained pending buyer/transporter confirmations.
- Buyer: real browser login → sample form → pin confirmation → save → success/list state passed.
- Transporter: real browser login → sample trip → pin confirmation → save → route disclosure → refresh passed. No road geometry was fabricated.
- Responsive landing frames: **360, 390, 768 and 1440 CSS pixels, each in light and dark mode**, passed without horizontal document overflow or failed image loads.
- Mobile drawer opens, navigates and closes. Enlarged **200% text at 390px** passed without horizontal overflow; long brand text abbreviates visually while retaining its accessible name.
- Real browser search, no-results state, Escape dismissal/focus restoration, help filtering, privacy preferences, clipboard success, map zoom and back-to-top passed.
- All semantic text/button/status color pairs tested at **4.5:1 or better** (lowest measured semantic pair 5.61:1). Lighthouse automated accessibility: 100.
- Full audit summaries and run timestamps: qa/lighthouse-summary.json. Raw reports are local ignored artifacts.

| Lighthouse category | Mobile | Desktop |
|---|---:|---:|
| Performance | 95 | 100 |
| Accessibility | 100 | 100 |
| Best practices | 100 | 100 |
| SEO | 100 | 100 |
| Largest contentful paint | 2.7s | 0.7s |
| Total blocking time | 20ms | 0ms |
| Cumulative layout shift | 0 | 0 |

These are local lab measurements, not hosted field data or an INP measurement. Mobile LCP remains slightly above the 2.5s target. The production landing starts with a roughly 143KB gzip script; account/workspace/map/dialog code and supporting images load separately.

## Navigation and shared controls

| Control | Expected result | Evidence |
|---|---|---|
| CropConvoy logo / Back to home | Navigate to landing | Browser + router checks |
| Get started (header, hero, footer) | Open demo login | Browser |
| How it works / For everyone / FAQs | Navigate to the correct landing section | Router/search tests + browser |
| Role tabs | Update image, heading, description and demo link; arrow/Home/End keys move selection | Automated + responsive review |
| Explore role demo / Try farmer demo | Open login for the selected role | Router checks |
| Theme toggle | Change the complete page theme; reflect new accessible action label | Automated + all responsive widths |
| Mobile menu | Open focus-managed drawer; Escape/close dismisses; a navigation choice closes it | Automated + phone-frame browser |
| Workspace link | Open the current role workspace | Browser |
| Switch demo role | Open account choices | Browser, all three roles |
| Sign out | Clear the demo identity or revoke the API session, then open login | Automated |
| Search site / Ctrl or Cmd+K | Open local search | Automated shortcut + browser search |
| Search text / result links / Enter | Filter pages/help/loaded records; show no-match feedback; navigate a result | Automated + production browser |
| Close dialog / Escape | Dismiss dialog and restore invoking-control focus | Automated + production browser |
| Skip to content | Focus main content | Automated |
| FAQ summaries | Expand/collapse answers with native keyboard behavior | Automated |
| Floating help / footer Help & contact | Open local searchable help | Automated + production browser |
| Search help / help disclosures | Filter useful answers and expand them; no-match message | Automated + production browser |
| Help Open demo | Open login/current workspace | Production browser |
| Back to top | Return to top and focus main without a focus-induced jump | Browser, observed scrollY=0 |
| Scroll progress | Track page position through Motion values | Browser scroll; implementation inspected |
| Privacy preferences | Reopen the actual storage choice | Automated |
| Essential only | Keep optional theme preference out of persistent storage | Automated + browser |
| Save preferences | Persist consent/theme; close banner | Automated + browser |
| Copy buttons | Copy exact text and announce success; show selectable full text on failure | Automated + production clipboard success |
| Not-found Back to home / recovery Reload page | Provide working navigation/recovery | Route implementation; recovery exercised after a development hot update |

## Accounts and forms

| Control | Expected result | Evidence |
|---|---|---|
| Use farmer/buyer/transporter demo account | Autofill corresponding public credentials | Browser, all three accounts |
| Show / Hide password | Toggle type and accessible state without losing value | Automated + browser |
| Enter demo | Validate fixed credentials; show errors or enter matching workspace | Automated + browser |
| Copy account credentials | Copy username/password as explicit demo text | Automated component + production browser |
| Harvest Try sample | Populate description with explicit date/quantity/minimum | Automated + browser |
| Review details | Extract, preserve missing values and show editable review; never publish | Automated + browser |
| Enter details manually | Open editable form without extraction | Automated fallback coverage |
| Edit description | Return to existing text for editing | Automated state preservation |
| Map click / coordinate fields | Update pin, invalidate prior pin confirmation; validate bounds | Browser map + automated coordinate mapping/form checks |
| Zoom in / Zoom out | Adjust real basemap zoom | Browser |
| Pin/detail confirmation checkboxes | Gate explicit publication/saving | Automated + browser |
| Publish harvest / Confirm publication | Validate then require modal confirmation; save one listing | Automated + browser |
| Discard / New harvest | Ask confirmation, then clear unsaved state; preserve saved records | Automated reset and cancellation |
| Find a proposal / Generate another / Try again | Show pending, sample/real result, or honest empty/incomplete state | Automated + browser happy path |
| Copy listing ID / Copy proposal | Copy authoritative displayed record/snapshot summary | Shared copy tests |
| Accept / Reject proposal | Require modal, save decision; pending confirmations after acceptance | Automated both decisions + browser acceptance |
| Confirm acceptance/rejection / Cancel | Perform only chosen action; cancellation keeps state | Automated |
| Original / Proposed route | Toggle returned geometry only; absent geometry has a pending state | Automated test-only returned geometry |
| Recorded actions disclosure | Expand source trace/rule outcomes | Native disclosure component; rule/trace output inspected |
| Refresh proposal | Reload saved state; handle stale/failed service calls | Automated + browser |
| Buyer/Transporter Try sample | Populate inputs with correct units; require pin confirmation | Automated + browser |
| Partial fulfillment checkbox | Preserve actual allowsPartial input in the order | Schema/service and form checks |
| Save order / Save trip | Validate, convert units, prevent duplicate submit and show saved record | Automated + browser |
| Clear form / confirmation Cancel | Clear only after confirmation; keep saved list records | Automated |
| Refresh orders / Refresh trips | Reload list and support dependency-error retry | Automated + browser |
| View route / Hide route | Expand selected journey; render real returned geometry or endpoints-only notice | Automated + browser |
| Copy saved/order/trip IDs | Use the exact server/demo-generated ID | Shared copy tests |
| Error-summary links | Focus associated invalid inputs | Automated invalid-input focus |

## Failure and integration scenarios

- HTTP adapter preserves 422 fields, 409 conflicts, 503 dependencies, request IDs, network failures, timeouts and unreadable responses; no demo fallback in API mode.
- API-mode order field errors remain visible and preserve entered values.
- Extraction outage permits manual entry without publishing.
- Demo never invents missing prices/dates or road geometry; below-minimum sample proceeds produce no proposal.
- Same decision is idempotent; conflicting decision is 409. Stale/expired acceptance shows an error and keeps regeneration available.
- Empty lists have useful prompts; dependency-failed lists can retry.
- Clipboard failure never claims copied success and exposes the full text for manual copying.
- Tile failure leaves pins/coordinate entry available. GeoJSON [lng,lat] maps correctly to Leaflet [lat,lng].
- Reduced-motion test leaves hero content visible and section navigation instant; CSS also removes nonessential animation.
- Rupee conversion rejects excessive precision/unsafe integers. Date conversion handles UTC day changes and invalid dates independently of host timezone.
- Session refresh retrieves saved demo records/decisions. No stock/demand/capacity reservation is simulated as a real booking.

## Verification boundaries

The browser responsive checks use real same-origin iframe viewports in qa/responsive.html, not physical phones. The in-app browser did not apply a native zoom shortcut; 200% text enlargement and narrow layouts were verified instead. Keyboard paths are covered through Testing Library and real browser Escape/focus checks. Reduced motion and tile failure are exercised through controlled component tests.

Live backend extraction, real routed quotes, PostgreSQL restart persistence, multi-party confirmations, authentication, production map-provider rollout and deployment remain the assigned backend/hosting work. Mocked API failure/geometry tests do not claim those services are complete. The theme and generated media are local deliverables; no site was published.

## Prediction demo regression pass — 24 October 2026

The ML extension was checked separately from the marketplace backend. Final automated results:
64 ML tests, 49 frontend tests, production build passed; 108 live produce/market/horizon requests
passed with verified cuda:0. Both models were retrained once in a visible PowerShell terminal.

| Control / state | Expected result | Observed |
|---|---|---|
| Price forecast / What to plant tabs | Select the correct tool; Arrow keys, Home and End move/select tabs | Automated; both tools walked through in browser |
| GPU ready disclosure | Show actual verified device, cutoff and feature version | Browser + live health + CUDA config tests |
| Check again / service retry | Retry readiness, preserve inputs, never fake results | Automated health failure/retry |
| Six image radio cards | Select correct produce with visible checked/focus state | Automated all six options; browser carrot selection/update |
| Market and forecast month selectors | Use service catalog values and dates | Automated + browser |
| Update forecast | Explicit submission; disabled while pending; announce/focus result | Automated + browser live carrot result |
| Duplicate submissions | One request while pending | Automated |
| Changed selections | Keep prior result and show outdated notice until updated | Automated |
| Late or canceled response | Never overwrite another workflow or newer submitted result | Deferred-response tests |
| 12 months / 3 years / All history | Change chart/table history range | Automated range/table checks |
| View / Hide price table | Toggle accessible historical/forecast table | Automated + browser |
| Chart forecast segment | Use calendar-month positions and one forecast point; no invented intermediate prices | Source review + browser chart |
| Copy forecast | Copy summary including synthetic label; expose fallback on clipboard failure | Shared clipboard success/failure tests |
| Planting month / region / market | Preserve choices and require explicit comparison | Automated + browser default results |
| Area / soil pH | Preserve editing; validate area 0.1–100 and pH 0–14 | HTTP + form tests; NaN rejected |
| Soil / irrigation | Match eligibility and yield inputs; no automatic prediction on edits | Automated API/form tests |
| Assumptions & costs | Expand defaults; validate and send zero/nonnegative overrides | HTTP + interaction tests |
| Compare planting options | Show success, pending, previous/error states without duplicate submissions | Automated |
| Financial breakdown | Expand exact rounded money line items and dates | Automated + browser |
| Positive top crop | Show Recommended under these assumptions only for positive stressed return | Automated + live default comparison |
| Zero / negative return | Show Break-even option / Lowest projected loss; never recommend a loss | Automated |
| No eligible crops | Empty state with individual exclusion reasons | Automated + prior browser clay scenario |
| Bad month / negative area/cost / unknown fields | HTTP 422 with useful fields, never 500 | Automated HTTP + live probes |
| Unsupported harvest horizon | Exclude crop with explanation; never substitute latest price | Automated |
| GPU/model unavailable | HTTP 503; retain history where data remains valid | Automated |
| Missing/corrupt historical rows | Fail readiness for duplicates, gaps, missing series, invalid prices/future data | Automated |
| Failed produce image | Show named fallback instead of broken image | Automated |
| Reduced motion | Keep content visible and remove nonessential motion | Component regression + CSS |
| Responsive layouts | No horizontal overflow or visible broken images | Real browser at 360, 390, 768, 1440 pixels in both themes |
| Native 200% browser zoom | Check native zoom with readable controls and no overlap | Not verified: in-app shortcut had no effect; browser control was then disabled |
| 200% text QA helper | Manual text enlargement remains available in qa/responsive.html for both tools | Helper updated; new prediction-page enlargement pass not completed |

Lighthouse mobile audits measured:
price — performance 88, accessibility 100, best practices 100, SEO 100, CLS 0;
planting — performance 86, accessibility 100, best practices 100, SEO 100, CLS 0.112.
An additional catalog-loading space reservation was added after the planting audit.
That last layout adjustment was build/test verified but could not receive another browser audit,
because local browser use was disabled in Work settings.

Audit JSON/HTML, responsive screenshots/checks and final live API summary are in ignored ml/logs/.
The viewport override could not be reset after browser access was disabled; last test width was 1440px.
No physical-device, live-market accuracy or native-zoom result is claimed.
