# Zito Mobile

Zito Mobile is the shared Expo Router app for customer, driver, transporter, and courier-company workflows. This repo now carries the full Android and iPhone delivery setup needed for:

- local development
- internal QA builds
- Android Play Store submission prep
- iPhone TestFlight submission prep

## Platform Coverage

- Android phones
- iPhone
- Mobile web for lightweight preview only

The active mobile workspaces currently cover:

- Customer booking, tracking, history, profile, and owned-fleet management
- Driver trip, earnings, SOS, and profile workflows
- Transporter dashboard, drivers, fleet, bookings, and finance
- Courier-company dashboard, bookings, and fleet operations

## Roles

- Customer: create bookings, estimate pricing, track trips, review history, and manage profile
- Driver: accept trips, move statuses, capture proof of delivery, submit SOS/help, and manage availability
- Transporter: manage dashboard KPIs, drivers, fleet, bookings, and finance views
- Courier company: manage courier dispatch, booking flow, owned fleet, scans, and waybills

## Prerequisites

- Node.js and npm
- Expo account
- EAS access (`npm run eas:login` or `npx eas-cli login`)
- Real API base URL
- Real Google Maps API key for Android and iPhone
- Apple Developer + App Store Connect access for iPhone release
- Google Play Console access for Android production release

## Required Project Values

Before any remote build, set:

1. `.env`

```bash
EXPO_PUBLIC_API_URL=https://your-api-host.example.com
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=YOUR_GOOGLE_MAPS_API_KEY
EXPO_PUBLIC_APP_ENV=development
```

2. `app.json`

- replace `expo.extra.eas.projectId`
- replace the placeholder iOS Google Maps key
- replace the placeholder Android Google Maps key

## Local Development

Install dependencies:

```bash
npm install
```

Start the Expo app:

```bash
npm run start
```

### Android Local

On Windows or macOS, Android local native runs are supported if Android Studio / SDK is installed:

```bash
npm run android
```

### iPhone Local

Local native iPhone runs require macOS + Xcode:

```bash
npm run ios
```

If you are on Windows, use Expo Go for lightweight UI testing and EAS Build for real iPhone binaries.

## EAS Login

Use the bundled EAS CLI through the project scripts:

```bash
npm run eas:login
```

If you prefer direct npx usage, use:

```bash
npx eas-cli login
```

Do not use `npx eas login`; that is not the correct package entrypoint for this repository.

## EAS Build Profiles

`eas.json` now provides:

- `development`: internal dev-client build
- `preview`: internal QA distribution
- `production`: store/TestFlight-ready production build

Each profile labels the app environment through `EXPO_PUBLIC_APP_ENV`, and Android / iPhone builds are explicitly configured.

## Android Release Flow

Internal QA APK:

```bash
npm run android:preview
```

Production Android App Bundle for Play Console:

```bash
npm run android:playstore
```

Submit Android production build metadata to Google Play internal track:

```bash
npm run android:submit
```

Notes:

- `preview` builds use APK for faster internal testing
- `production` builds use Android App Bundle (`.aab`) for Play Store delivery
- Google Play signing and service credentials are not stored in this repo

## iPhone Release Flow

Internal QA build:

```bash
npm run ios:preview
```

Production iPhone build:

```bash
npm run ios:production
```

TestFlight-ready build alias:

```bash
npm run ios:testflight
```

Submit to App Store Connect / TestFlight:

```bash
npm run ios:submit
```

Notes:

- TestFlight is the required iPhone QA path before App Store release
- Apple credentials and signing assets are managed through Expo / App Store Connect, not committed here

## Combined Release Helpers

Build both platforms for internal QA:

```bash
npm run build:preview
```

Build both platforms for production:

```bash
npm run build:production
```

## Permissions & Capabilities

The setup now explicitly covers:

- location access for route and tracking
- camera access for scans, POD, and support evidence
- photo library access for upload flows
- Android adaptive app icon assets
- iPhone bundle ID and Android package name alignment

## OTP Auto-Fill

The mobile login flow now supports OTP autofill-friendly behavior:

- iPhone uses the platform one-time-code autofill path
- Android supports SMS-OTP autofill-friendly input handling
- full-code paste or autofill into the first OTP field is split across all 6 OTP cells automatically

For Android SMS Retriever-compatible delivery, set the backend environment variable:

```bash
TWILIO_VERIFY_ANDROID_APP_HASH=YOUR_ANDROID_SMS_RETRIEVER_HASH
```

That value belongs in the backend environment because Twilio Verify appends it to the verification SMS body.

## Verification Commands

Lint:

```bash
npm run lint
```

Expo public config check:

```bash
npx expo config --type public
```

Expo doctor:

```bash
npm run doctor
```

## Brand

- Product: `Zito`
- Company: `Aurenza Limited`
- App tagline: `Smarter. Faster. Reliable.`
- Descriptor: `Your logistics. Simplified.`

## Notes

- The customer booking flow depends on Google Places, device location, and maps support.
- The active mobile implementation lives in the JavaScript route tree under `app/`.
- Mobile web is useful for preview, but operational QA must happen on Android and iPhone devices before release.
- Android and iPhone must stay functionally aligned for customer, driver, transporter, and courier-company workflows.
