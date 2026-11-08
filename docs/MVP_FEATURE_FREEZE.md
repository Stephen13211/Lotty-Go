# Lotty Go MVP feature freeze and launch checklist

Branch: `feature/full-platform-build`

This document defines the first public-release scope. New ideas outside this list are deferred until after the core release unless required for safety, law, security, or payment integrity.

## P0 — must work before public launch

### Accounts and access
- Rider and driver registration, login, logout, and password reset.
- Role-aware navigation and account ownership checks.
- Secure session handling and useful error/retry states.

### Rider booking
- Current-location pickup and manual pickup pin/address.
- Destination search and up to two ordered extra stops.
- Road-route distance and transparent fare estimate.
- Clear ride category, passenger/courier eligibility, and payment method availability.
- No card option presented as usable until card collection is integrated.

### Driver availability and dispatch
- Approved drivers only; online/offline state persisted server-side.
- Fresh location heartbeat for online drivers and nearby-driver map display.
- Atomic ride claiming so two drivers cannot accept the same request.
- Rider searching/matching state, cancellation, timeout, retry, and accepted transition.
- Driver request details and accept/decline controls.

### Active ride
- Live driver location and rider-visible pickup distance/ETA.
- Correct pickup → stops → destination route order.
- Driver identity, photo, vehicle make/model and registration.
- Arrival, two-minute free waiting grace period, configurable waiting rate, trip start and completion.
- In-app rider/driver chat.
- Pickup PIN before trip start.
- Trip history and receipts.

### Cancellation and disputes
- Cancellation reasons for rider and driver.
- R10 rider cancellation fee only when the assigned driver is less than 1 km from pickup, with a clear warning and final confirmation.
- Distance and fee calculated server-side from a fresh driver location; never trust client-submitted distance.
- Record reason, fee decision, distance, timestamps and payment/collection state.
- A dispute/support path and fair exception handling for safety incidents or driver-caused delays.
- Do not claim fee collection until a working payment/arrears mechanism exists.

### Safety, compliance and trust
- Manual driver approval and private document storage.
- Review applicable South African ID, driving licence, PrDP, vehicle/operating documents, roadworthiness, insurance and safety screening requirements with qualified local guidance.
- Rider and driver ratings, report-a-problem and support contact.
- Secure live trip sharing by phone share sheet (WhatsApp, SMS, email and other compatible apps), with an expiring public link that stops when the trip ends.
- Trusted contact and emergency help flow.
- Privacy controls, consent, data retention and POPIA review.
- Clear rider/driver terms, fare and fee disclosure, cancellation policy and incident escalation.

### Admin and operations
- Admin-only driver/document approval and rejection notes.
- Configurable waiting and cancellation fee settings.
- Ride search/oversight, support/dispute handling, audit trail.
- Driver earnings estimate and cash collection confirmation with a 75/25 commission ledger; admin can record receipt of cash commission.
- No claim of automatic bank payouts until a supported payout provider and reconciliation flow are integrated.

### Payments
- Cash ride recording and settlement status, with driver confirmation and an admin commission-received queue.
- Card payment collection, webhook verification, refunds and reconciliation before enabling card in the app.
- Driver 75% / Lotty Go 25% split calculated server-side.
- Verify a compliant provider can pay drivers directly to ordinary bank accounts; do not assume PayFast supports the required marketplace split/payout workflow.
- Cancellation and waiting fees must have a disclosed and operational collection path before being described as collected.

## P1 — useful, but not a launch blocker
- Scheduled rides.
- Promotions/referral codes.
- Driver destination filters and bonus campaigns.
- Advanced demand/surge pricing.
- More ride categories and fleet tools.
- In-app automated support chat.

## P2 — explicitly deferred
- Subscription/membership products.
- Women-only matching until supply, eligibility and operational policies are ready.
- Multi-city expansion and advanced dispatch optimisation.
- Audio recording, automated anomaly detection and sophisticated fraud scoring.

## Release gates
1. TypeScript and Android production export pass.
2. Supabase migrations are applied once, in order, and policies/RPCs tested with rider, driver and admin accounts.
3. Two-device end-to-end tests pass: request, match, accept, approach, arrival, wait, PIN, start, route, complete, rate, history.
4. Negative tests pass: unapproved driver, stale location, double accept, wrong user, cancellation boundary at 1 km, fee dispute, network loss.
5. Payment collection, payout and refund paths are tested with the provider before any paid rides are enabled.
6. South African legal, safety, insurance, privacy and operating requirements are reviewed before public launch.

## Current implementation status and remaining release gates

Implemented in the app/database code:
- Rider/driver authentication, role-aware screens, password-reset route and deep-link scheme `lottygo://`.
- Rider booking with pickup, destination and up to two stops; cash-only until a card gateway is connected.
- Server-side driver availability heartbeat, eligibility checks and atomic ride claiming.
- Rider matching screen and active-ride lifecycle.
- Live location/route ETA, participant chat, trip sharing, pickup PIN, configurable waiting fee and cancellation reason/R10 fee recording.
- Driver document review and admin approval; waiting-fee admin controls.
- Trip history, one rating per trip participant, support reports, admin support queue and trusted emergency-contact storage.
- Active-trip emergency button records an urgent report and opens the phone dialler for South African emergency number 112.

Verified in the connected Supabase project:
- Core trip, matching, waiting-fee, cancellation, trip-sharing and pickup-PIN tables/functions exist.
- `trip-share` Edge Function is deployed with JWT verification disabled; its token validation is handled in the function.
- Database execute grants were hardened: anonymous callers cannot execute the app RPC functions; signed-in users retain only the intended RPC access.
- Ratings, support-report and emergency-contact schema/functions are installed.
- Cash collection confirmation and 75/25 cash commission settlement ledger are installed.

Remaining before public launch:
- Run TypeScript and Android export checks on the latest commit and resolve any failures.
- Test real two-phone ride lifecycle, pickup PIN, waiting fee, cancellation boundary, trip-sharing link expiry/revocation and ratings.
- Enable and verify leaked-password protection in Supabase Auth.
- Configure and test password-reset email delivery and the `lottygo://reset-password` redirect on a real device.
- Emergency contact details are stored but are not automatically messaged; emergency button records an in-app report and opens the phone dialler. It does not dispatch emergency services.
- Add operational notifications for support/emergency reports and a staffed response process before launch.
- Card collection, refunds, cancellation-fee collection and automatic 75/25 driver bank payouts are not integrated. Cash commission can be recorded, but actual commission transfers are still handled outside the app; the database cannot send money to drivers.
- Confirm South African licensing, PrDP, operating licence, insurance, criminal-record screening, consumer terms, POPIA and incident-response obligations with qualified local advisers.
- The Supabase migration-list API currently reports no tracked migration history even though the schema objects are present (they were previously applied through SQL Editor). Do not run `supabase db push` until the existing database migrations are safely reconciled with the CLI migration history.
