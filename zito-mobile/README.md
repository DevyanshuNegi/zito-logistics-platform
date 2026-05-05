# Zito Mobile

Mobile workspaces currently cover:

- Customer booking, tracking, profile, history, and owned-fleet management
- Driver trip and safety workflows
- Transporter dashboard, fleet, bookings, drivers, and finance
- Courier-company dashboard, load plans, and owned-fleet management

Platform coverage:

- Android phones
- iPhone (shared Expo / React Native codebase)
- Mobile web for lightweight preview only

Zito Mobile is the Expo Router app for the Zito logistics platform by Aurenza Limited. It provides customer booking and tracking, driver trip execution, courier-company operations, and transporter fleet operations in one mobile codebase.

## Roles

- Customer: create bookings, estimate pricing, track trips, review history, and manage profile
- Driver: accept trips, move statuses, capture proof of delivery, submit SOS/help, and manage availability
- Transporter: manage dashboard KPIs, drivers, fleet, bookings, and finance views
- Courier company: manage courier dispatch, booking flow, owned fleet, scans, and waybills

## Local Setup

1. Install dependencies

```bash
npm install
```

2. Add environment variables in `.env`

```bash
EXPO_PUBLIC_API_URL=https://your-api-host.example.com
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=YOUR_GOOGLE_MAPS_API_KEY
```

3. Start the app

```bash
npx expo start
```

## iPhone

The codebase is already configured for iPhone under the same Expo app:

- iOS bundle identifier: `com.aurenza.zito`
- iPhone build command: `npm run ios`
- remote iPhone build profiles: `preview` and `production` in `eas.json`

Important limits:

- local `expo run:ios` requires macOS + Xcode
- on Windows, use Expo Go for UI testing or Expo EAS Build for real iPhone binaries

Recommended iPhone testing flow:

1. Set real values in `.env` and `app.json`
2. Set a real EAS project ID in `expo.extra.eas.projectId`
3. Sign in to Expo: `npx eas login`
4. Build internal QA app: `npm run ios:preview`
5. Build TestFlight candidate: `npm run ios:testflight`
6. Submit to TestFlight/App Store Connect: `npm run ios:submit`

Permissions already prepared for iPhone:

- location while in use
- camera for proof of delivery / scans
- photo library for support evidence and document uploads

## Release Notes

- Android and iPhone must stay functionally aligned
- iPhone release readiness depends on Apple Developer / App Store Connect credentials, which are not stored in this repo
- TestFlight is the expected pre-release path for iPhone QA

## Brand

- Product: `Zito`
- Company: `Aurenza Limited`
- App tagline: `Smarter. Faster. Reliable.`
- Descriptor: `Your logistics. Simplified.`

## Notes

- The customer booking flow depends on Google Places, device location, and maps support.
- The active mobile implementation lives in the JavaScript route tree under `app/`.
- Mobile web is useful for preview, but operational QA must happen on Android and iPhone devices before release.
