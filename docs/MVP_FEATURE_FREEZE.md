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
- Share-trip details/trusted contact and emergency help flow.
- Privacy controls, consent, data retention and POPIA review.
- Clear rider/driver terms, fare and fee disclosure, cancellation policy and incident escalation.

### Admin and operations
- Admin-only driver/document approval and rejection notes.
- Configurable waiting and cancellation fee settings.
- Ride search/oversight, support/dispute handling, audit trail.
- Driver earnings ledger with the agreed 75/25 calculation.
- No claim of automatic bank payouts until a supported payout provider and reconciliation flow are integrated.

### Payments
- Cash ride recording and settlement status.
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

## Current known implementation gaps
- Rider's driver-profile helper must use `get_matched_driver_profile(p_ride_id)`, not direct table access.
- Rider request currently saves a ride then shows an alert; no proper matching/search screen.
- Driver online state is currently local UI state; no durable online heartbeat/location directory.
- Driver live location currently publishes only during an assigned active ride.
- No server-enforced R10 cancellation fee/reason flow yet.
- Pickup PIN, share-trip/emergency workflow, ratings and support workflow need verification/implementation.
- Card collection and automatic 75/25 bank payout are not integrated.
