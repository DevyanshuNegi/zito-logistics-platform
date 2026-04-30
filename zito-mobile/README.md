# Zito Mobile

Mobile workspaces currently cover:

- Customer booking, tracking, profile, history, and owned-fleet management
- Driver trip and safety workflows
- Transporter dashboard, fleet, bookings, drivers, and finance
- Courier-company dashboard, load plans, and owned-fleet management

Zito Mobile is the Expo Router app for the Zito logistics platform by Aurenza Limited. It provides customer booking and tracking, driver trip execution, and transporter fleet operations in one mobile codebase.

## Roles

- Customer: create bookings, estimate pricing, track trips, review history, and manage profile
- Driver: accept trips, move statuses, capture proof of delivery, submit SOS/help, and manage availability
- Transporter: manage dashboard KPIs, drivers, fleet, bookings, and finance views

## Local Setup

1. Install dependencies

```bash
npm install
```

2. Add environment variables in `.env`

```bash
EXPO_PUBLIC_API_URL=http://YOUR_BACKEND_HOST:3000
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=YOUR_GOOGLE_MAPS_API_KEY
```

3. Start the app

```bash
npx expo start
```

## Brand

- Product: `Zito`
- Company: `Aurenza Limited`
- App tagline: `Smarter. Faster. Reliable.`
- Descriptor: `Your logistics. Simplified.`

## Notes

- The customer booking flow depends on Google Places, device location, and maps support.
- The active mobile implementation lives in the JavaScript route tree under `app/`.
