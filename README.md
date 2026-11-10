# ResponseHub

ResponseHub is a responsive emergency incident reporting and disaster-management frontend prototype. It demonstrates the complete workflow from public reporting and explainable severity suggestion through administrator review, progress updates, and browser-local reference tracking.

## Run locally

Requirements: Node.js and npm.

```bash
npm install
npm run dev
```

Open the URL printed by Vite.

## Production build

```bash
npm run build
```

## Demo behavior

- The first launch seeds 13 fictional incidents covering all categories, severities, statuses, and verification states.
- Reports and administrator changes are stored in versioned `localStorage`.
- Data is local to one browser and is not shared between devices.
- The administrator workspace is an unauthenticated demo.
- “Reset demo data” replaces browser-local data with the original fictional dataset.
- Empty incident data remains empty and is not silently reseeded.
- Location access is requested only when “Use my location” is selected. Coordinates are displayed as coordinates and are not reverse-geocoded.

## Important limitations

This is a frontend prototype only. It does not contact emergency services, dispatch responders, authenticate users, secure report references, or perform validated emergency triage. The severity suggestion uses transparent demonstration rules and every report requires administrator review. Do not enter real personal information.

## Main routes

- `/` — Public home
- `/report` — Incident report and review flow
- `/track` — Privacy-limited reference tracking
- `/admin` — Demo administrator overview
- `/admin/incidents` — Searchable and filterable incident list
- `/admin/incidents/:id` — Incident details and administrative controls

## Photos and map

- Reporters can attach up to 3 photos. They are resized to compact JPEGs and stored in `localStorage`; if browser storage fills up, the confirmation screen warns that the report was not saved. Photos are visible only to administrators, never on the tracking page.
- The admin overview and incident details show a Leaflet map of incidents that have coordinates. Map tiles load from OpenStreetMap (no API key, but an internet connection is required). Demo incidents use fictional, approximate coordinates; reports get coordinates only when the reporter uses "Use my location".
