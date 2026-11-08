# Live trip sharing setup

The app creates a private, unguessable link for an active ride and opens the Android/iOS system share sheet. On Android, the rider can choose WhatsApp, SMS, Gmail, or another compatible app. The recipient does not need a Lotty Go account.

## 1. Apply the database migration

In the Supabase SQL Editor, run the contents of:

`supabase/migrations/202611090003_trip_sharing.sql`

This creates a private token table and an authenticated RPC. The token table has no anon/authenticated table access; the client receives only the newly generated bearer token from the RPC.

## 2. Deploy the public read-only share page

From the repository root, with the Supabase CLI linked to the correct Lotty Go project, run:

```bash
supabase functions deploy trip-share --no-verify-jwt
```

The function must be deployed with JWT verification disabled because the recipient is not signed in. The function itself validates a 256-bit random token, checks expiry and active ride status, and uses the server-side service-role key only inside the Edge Function. Never put the service-role key in the app or share URL.

Supabase provides `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to deployed Edge Functions. Confirm both are available in the function environment.

## 3. Test on two phones

1. Create a ride with a rider and accept it with an approved driver.
2. On the active ride screen, tap **Share live trip**.
3. Choose WhatsApp and send the link to a second phone.
4. Open the link without signing in. Confirm pickup, destination, driver/vehicle details and the embedded map appear.
5. Move the driver phone and confirm the shared map/location refreshes approximately every 8 seconds.
6. Complete or cancel the ride. Refresh the link and confirm it stops showing trip data.
7. Try an invalid token and an expired token; neither should return trip details.

## Privacy and limitations

- The link is a bearer credential: anyone who receives or is forwarded the URL can view the shared trip while it is active. Share only with trusted contacts.
- Links expire after 12 hours and are automatically invalid once the ride is no longer accepted or in progress.
- The page is read-only and does not expose rider phone/email or payment details.
- The page refreshes driver location from the ride record; the driver app must have location permission and an active ride location heartbeat.
- The current implementation uses the operating system's standard share sheet, so WhatsApp is one option when installed; it does not require a WhatsApp Business API integration.
