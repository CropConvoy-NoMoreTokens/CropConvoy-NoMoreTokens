# CropConvoy manual test plan

Target: integration/dev-logistics, commit 38c89b8. Prepared 24 October 2026.

Purpose: check that a buyer order, transporter trip and farmer harvest connect through the real API, produce a correct estimate, and preserve the farmer's decision.

This is a plan to execute. The blank results below do not mean the manual tests have passed. Prior automated and browser checks are recorded in LOCAL-INTEGRATION.md.

## 1. Before you start — 5 minutes

1. Follow LOCAL-INTEGRATION.md to start PostgreSQL, API and frontend. Use a dedicated, disposable test database, with migrations 001 and 002 applied. Do not reset a shared or production database.
2. Open http://127.0.0.1:5173. Confirm the workspace says **API mode**. Demo mode cannot prove backend integration.
3. Open http://localhost:3001/health and http://localhost:3001/ready. Both should return successful responses; readiness requires the database migrations.
4. Open browser Developer Tools → Network. Enable **Preserve log**, then filter requests by `/api/`. Record failed requests and response bodies when a test fails. Do not record credentials.
5. Pick **D**, a future date, normally tomorrow. Use that same date in every baseline record. Every date/time entered in the UI is Sri Lanka time (Asia/Colombo).
6. Record the branch/commit, browser, database name, D, API URL and frontend URL in the results sheet at the end.

The login screen selects a public demo role. It is not secure authentication. Switching between roles is expected for this test.

## 2. Baseline data

Enter these values manually; “Try sample” does not guarantee matching locations. Location fields allow exact latitude/longitude entry. After changing coordinates, check the relevant pin-confirmation checkbox again.

### Buyer order

| Field | Value |
| --- | --- |
| Crop | Tomato |
| Quantity needed | 100 kg |
| Offered price per kg | LKR 220 |
| Delivery deadline | D, 8:00 PM |
| Allow smaller, whole-listing deliveries | Checked |
| Delivery latitude | 6.990920 |
| Delivery longitude | 79.938911 |
| Delivery pin confirmation | Checked |

### Transporter trip

| Field | Value |
| --- | --- |
| Available capacity | 120 kg |
| Departure | D, 9:00 AM |
| Start latitude / longitude | 7.486300 / 80.364700 |
| Destination latitude / longitude | 6.927100 / 79.861200 |
| Base charge | LKR 350 |
| Carrying rate | LKR 0.20 per kg per km |
| Extra-distance rate | LKR 100 per km |
| Handling charge | LKR 0 |
| Search corridor | 3000 meters |
| Maximum extra distance | 10 km |
| Maximum extra time | 60 minutes |
| Route pin and detail confirmation | Checked |

### Farmer harvest

| Field | Value |
| --- | --- |
| Crop | Tomato |
| Quantity | 80 kg |
| Minimum net proceeds | LKR 14,000 total |
| Ready date/time | D, 8:00 AM |
| Pickup latitude | 7.187781 |
| Pickup longitude | 80.111660 |
| Pickup pin confirmation | Checked |
| Harvest detail confirmation | Checked |

The trip runs from Kurunegala toward Colombo, with pickup and delivery along the route. This is a reproducible baseline; road-provider results may change.

## 3. Main journey — 15–20 minutes

### M01 — Save the buyer order

1. Enter the Buyer workspace and fill the baseline order.
2. Click **Save order**. Copy the saved order ID.
3. Refresh the orders list, then reload the page.

**Pass:** A successful save response is visible in Network; the same ID appears in Registered orders after reload, with 100 kg, LKR 220/kg and the correct local deadline. One click creates one order.

### M02 — Save a real road-backed trip

1. Switch to Transporter and enter the baseline trip.
2. Click **Save trip** and copy the trip ID.
3. Open **View route**. Reload and open the same trip again.

**Pass:** The trip is saved with returned road geometry, a visible road route and positive route distance. The UI says Route stored. Capacity and tariff remain correct after reload. A straight line connecting two pins alone is not proof of road routing.

### M03 — Publish a harvest manually

1. Switch to Farmer → **Enter details manually**.
2. Enter the baseline harvest. Check both confirmations.
3. Click **Publish harvest**. Check the confirmation summary, then cancel once.
4. Confirm no listing was created by cancelling. Publish again and click **Confirm publication**.
5. Copy the listing ID and save the listing URL.

**Pass:** No publication occurs before confirmation. After confirming, Harvest saved appears with 80 kg, minimum LKR 14,000, the correct pickup pin and D at 8:00 AM. Reloading its saved URL restores the harvest.

**Pay attention:** Manually verify the native date/time field. Earlier browser automation did not complete this field reliably; this manual test closes that coverage gap.

### M04 — Generate and inspect a proposal

1. Click **Find a proposal** once. Observe the loading state and generate request.
2. Check that the proposal uses the order and trip IDs you just created.
3. Inspect sale amount, all fare components, net proceeds, pickup/delivery times and the original/proposed route toggles.
4. Expand recorded actions/constraints. Record whether the result is live or fallback and whether search is complete.

**Pass:** The proposal is based on the saved records. Sale amount is LKR 17,600. Net is at least LKR 14,000. Pickup is after readiness; delivery and unloading fit before the deadline. Route layers show returned geometry. Fallback or incomplete-search notices are visible when applicable. There is no claim of a confirmed booking.

**Reference only:** The previous real-road run returned about 33.0525 km carried, zero added distance, LKR 528.84 carrying, LKR 878.84 transport and LKR 16,721.16 net. Do not fail a new run solely for a changed road distance. Verify the formula using its actual response.

### M05 — Check the money yourself

Inspect the selected quote in the generation response; monetary fields are integer LKR minor units. Divide by 100 to display rupees. Use the full returned distance, not the rounded map label.

```text
carryingMinor = round(quantityKg × routeCarryDistanceM / 1000 × ratePerKgKmMinor)
detourMinor   = round(extraDistanceM / 1000 × perKmMinor)
transportMinor = baseMinor + carryingMinor + detourMinor + handlingMinor
saleMinor = quantityKg × pricePerKgMinor
netMinor = saleMinor − transportMinor
```

**Pass:** All response components and the UI agree to the cent. LKR 0.20 becomes 20 minor units; LKR 100 becomes 10,000. Carrying uses only the pickup-to-delivery portion projected along the original road route, not the full driver's journey. Added distance is max(0, modified route distance − original route distance).

### M06 — Accept, refresh and restart

1. Click **Accept proposal**, cancel the confirmation, and verify it remains undecided.
2. Accept again and click **Confirm acceptance**. Save the full listing/plan URL.
3. Refresh the page. Then stop and restart only the API using the same database and configuration. Reload the saved URL.
4. Revisit buyer and transporter lists and compare remaining demand/capacity with their original values.

**Pass:** The saved status is `farmer_accepted_pending_confirmations`. The UI says buyer and transporter confirmations are pending. The same plan, amounts and decision survive reload and API restart. Demand remains 100 kg and trip capacity remains 120 kg: this prototype does not reserve them on farmer acceptance.

### M07 — Reject a separate proposal

Create a new baseline harvest, generate another proposal, reject it and confirm. Reload its saved URL.

**Pass:** Rejection persists. The previously accepted plan remains accepted. A rejection is not shown as a booking or reservation.

## 4. Validation checks — 10 minutes

For each row, start with an unsaved valid baseline form, change only the stated value, and try saving. Restore the baseline afterward.

| ID | Action | Expected result |
| --- | --- | --- |
| V01 | Leave a required crop, quantity or date blank | Clear field error; no record created. |
| V02 | Enter quantity 0, -1, or 1.5 kg | Rejected; only positive whole kg accepted. |
| V03 | Enter a negative charge or more than two decimal places, e.g. 0.001 | Rejected; amounts are valid nonnegative money values. |
| V04 | Set latitude to 100 or longitude to 200 | Rejected; invalid coordinates cannot be published. |
| V05 | Clear a pin/details confirmation | Saving/publication blocked with an explanation. |
| V06 | Confirm a pin, then change its coordinates | Pin confirmation resets and must be checked again. |
| V07 | Enter an obviously past transporter departure | Cannot produce a usable match; API rejects trip creation or logistics excludes it. |
| V08 | Use Clear form/Discard, cancel, then confirm | Cancel retains unsaved entries; confirmation clears them; already saved records remain. |
| V09 | Click save/generate repeatedly during loading | Buttons prevent repeat clicks; no accidental duplicate records/decisions from a single action. |
| V10 | Reload around a midnight local date | Times retain the intended Sri Lanka date/time; API timestamps use UTC with Z. |

## 5. Matching rejection checks — 15–20 minutes

**Isolation is essential:** Use a separate fresh test database for each scenario, with only the relevant baseline records. Change the API database setting, apply migrations and restart the API. Keep the original test database for persistence checks. Do not delete a teammate's records. Multiple valid old orders/trips can legitimately produce a different proposal and make these tests misleading.

Create a fresh harvest/proposal for each row. Inspect the rejection list, trace and API response. Exact human-facing wording may differ; some market filters remove candidates before logistics, so an empty candidate result can be correct without a logistics rejection code.

| ID | Change from baseline | Expected result |
| --- | --- | --- |
| R01 | Buyer crop = Carrot; harvest stays Tomato | No proposal using that order. |
| R02 | Buyer demand = 79 kg for 80 kg harvest | No proposal; insufficient demand. No splitting the harvest. |
| R03 | Trip capacity = 79 kg | No proposal; insufficient capacity. |
| R04 | Buyer disables smaller whole-listing deliveries | Order excluded by current matching policy, even though this is a prototype restriction. |
| R05 | Farmer minimum = LKR 20,000 | No proposal meeting the minimum: sale itself is only LKR 17,600. |
| R06 | Pickup = 8.3114, 80.4037, far from this trip | No feasible route match within the 3000 m corridor. |
| R07 | Swap baseline pickup and delivery points | No proposal on that trip: pickup would come after delivery along the original route. |
| R08 | Harvest ready = D, 6:00 PM, departure remains 9:00 AM | No proposal: produce not ready when the driver reaches pickup. The driver does not silently wait all day. |
| R09 | Buyer deadline = D, 9:01 AM | No proposal: delivery cannot complete by the deadline. |
| R10 | Set maximum extra time to 0 minutes | No proposal: loading/unloading service time also counts toward extra time. |

### R11 — Verify a positive detour and its limit

Use a fresh database. Set search corridor to 10,000 m, generous extra distance/time limits, and choose a nearby pickup off the main road using the map. Generate a quote. First verify the response actually has `extraDistanceM > 0`; if not, select another nearby road location. Record the returned coordinates and distances so you can repeat the scenario.

**Pass A:** Positive detour charge equals the returned extra distance × extra-distance rate, with cent rounding. The carrying charge is still calculated separately.

Create a new otherwise identical trip in a separate scenario database with maximum extra distance set below that observed detour. Repeat with the same pickup/order.

**Pass B:** The restrictive trip cannot generate an accepted quote; detour-too-large rejection is recorded. A changed provider route may require recalibrating the chosen limit.

## 6. Pricing comparison checks — 10 minutes

Use isolated baseline scenarios and the actual route distances returned in each run. Keep the same geometry, tariff and locations unless specified.

| ID | Change | Expected result |
| --- | --- | --- |
| P01 | Harvest 40 kg instead of 80 kg | Carrying component halves if carrying distance is identical. Base/handling and same-route detour component do not halve. Sale becomes LKR 8,800; lower minimum to LKR 5,000 for this scenario. |
| P02 | Carrying rate LKR 0.40 instead of 0.20 | Carrying component doubles; other unchanged components stay the same. Compare using full distances and cent rounding. |
| P03 | Handling LKR 100 instead of 0 | Total transport rises by LKR 100 and net falls by LKR 100. |
| P04 | Move pickup closer to delivery while keeping it before delivery on the route | Carrying component follows the shorter returned carried distance; the full trip distance is not charged as carrying. Account separately for any changed detour. |
| P05 | Add a second feasible order with a different price/location | Manually compare evaluated quotes. Selected proposal has the highest feasible net among evaluated options, not necessarily the highest price/kg. An incomplete search must not claim a global optimum. |

## 7. AI, failures and saved decisions — 10–15 minutes

Run outage tests only against your own local test API. Restore settings and restart it after each scenario. Never stop a shared deployed service for a test.

| ID | Steps | Expected result |
| --- | --- | --- |
| F01 | Without LLM credentials, describe “80 kg tomatoes, ready tomorrow at 8 AM, minimum LKR 14,000,” then Review details | Manual completion/fallback is explicit. No fabricated successful AI extraction. Nothing publishes before review and confirmation. |
| F02 | With approved real LLM credentials, repeat extraction and generation | Extracted fields match the text; missing/ambiguous fields need review. Network/API metadata supports live-model behavior. If credentials are absent, mark BLOCKED, not PASS. |
| F03 | Remove routing configuration, restart API, then try saving a new trip | Visible failure; no successful route-backed trip or fabricated geometry. Existing stored routes may still display. |
| F04 | Stop the local API; attempt save/generate | Clear error/retry state; no fake success or silent switch to demo. Restart it and verify recovery. |
| F05 | Start API against an unavailable dedicated test database; check /ready and try reading/saving | Readiness is unsuccessful; failures are explicit. No in-memory substitute is presented as persisted success. |
| F06 | Generate a proposal and leave it undecided past its returned expiresAt; then attempt acceptance | Acceptance fails as stale/expired. Regenerate to get a fresh proposal. Refreshing must not extend the original expiry. |
| F07 | Open the same undecided proposal in two tabs; accept in one, reject in the other | First decision persists; conflicting second decision fails with conflict (409), and refresh shows the saved result. |
| F08 | Inspect Network, frontend files/config and error messages | No database or model secret is exposed to the browser. VITE_ values contain only public frontend settings. |

If time is limited, run F01, F03, F04 and F07 first. F06 may require up to 15 minutes; generate its proposal before starting the other tests.

## 8. Hosted verification — after deployment

These are pending until Railway/Vercel are deployed. Local success does not count as a hosted pass.

1. Confirm Railway has the database/routing/model server settings and all migrations; verify its `/ready` response.
2. Confirm Vercel was built with API mode and the public Railway HTTPS API URL. Rebuild after changing VITE_ variables.
3. Confirm Railway CORS allows the exact Vercel origin. Open the Vercel app and repeat M01–M06 with new future records.
4. Confirm there are no mixed-content or CORS errors in Network. Reload the saved listing/plan URL directly.
5. Restart/redeploy only the authorized test API service and confirm its saved plan remains. Record deployment URLs and commit IDs.

## 9. Results and release decision

Suggested team split: one person runs forms/validation, one runs matching rejection tests, one checks pricing/failures, and one checks persistence/hosted behavior. Use separate databases for independent scenarios. One person can also run the plan sequentially.

| Run detail | Value |
| --- | --- |
| Tester / date / browser | |
| Commit / database / test date D | |
| Frontend / API URL | |
| Model mode / routing provider | |
| Baseline listing / order / trip / plan IDs | |

Copy one row for every test ID above. Allowed results: PASS, FAIL, BLOCKED, NOT RUN.

| Test ID | Result | Actual behavior / IDs / evidence | Issue / owner |
| --- | --- | --- | --- |
| M01 | NOT RUN | | |
| M02 | NOT RUN | | |
| M03 | NOT RUN | | |
| M04 | NOT RUN | | |
| M05 | NOT RUN | | |
| M06 | NOT RUN | | |
| M07 | NOT RUN | | |
| V01–V10 (expand to one row each) | NOT RUN | | |
| R01–R11 (expand to one row each) | NOT RUN | | |
| P01–P05 (expand to one row each) | NOT RUN | | |
| F01–F08 (expand to one row each) | NOT RUN | | |
| Hosted checks 1–5 (expand to one row each) | NOT RUN | | |

For a failure, record: test ID, exact inputs/time, steps, expected result, actual result, relevant record IDs, HTTP status/response and a screenshot if useful. Remove credentials from evidence.

**Ready for a local demo:** M01–M07 pass; pricing matches exactly; critical negative tests prevent impossible proposals; failures never become fake success; pending-confirmation wording is correct; saved decisions survive restart. Any wrong money, accepted impossible route, lost decision, leaked secret or fake route is a blocking defect.

**Ready for a hosted demo:** All local criteria plus hosted checks pass. Explicit fallback mode is acceptable only if the team agrees to present it as fallback. Do not claim live AI was verified when F02 is blocked.

**Outside this prototype:** Secure role authentication, payments, actual buyer/transporter confirmation, guaranteed reservations, split shipments, pooled loads and live vehicle tracking. Passing this plan does not establish those capabilities.
