# 🚨 ResponseHub

> **Emergency Response & Disaster Management Platform — intelligent incident prioritization, response team management, nearest-team assignment, lifecycle tracking, live maps and analytics.**

![React](https://img.shields.io/badge/react-19-61DAFB.svg)
![TypeScript](https://img.shields.io/badge/typescript-5.7-3178C6.svg)
![Vite](https://img.shields.io/badge/vite-8-646CFF.svg)
![Leaflet](https://img.shields.io/badge/maps-Leaflet%20%7C%20OpenStreetMap-199900.svg)
![OSRM](https://img.shields.io/badge/routing-OSRM-orange.svg)
![PostGIS](https://img.shields.io/badge/storage-PostgreSQL%20%7C%20PostGIS-336791.svg)
![Code Clash](https://img.shields.io/badge/Code%20Clash%202026-Round%202-red.svg)

---

## 📌 Problem Statement

During emergencies, dispatchers receive many reports at once and must decide quickly which to handle first, which team to send, and how far away that team is. Common problems:

1. **No objective prioritization:** reports are handled first-come-first-served, so a building collapse with people trapped can wait behind a minor report.
2. **Manual, error-prone dispatch:** dispatchers guess which team is closest, may send a team that is already busy, or assign two teams to one incident.
3. **No shared picture:** incident status, team availability and routes live in different places, so nobody sees the whole operation.

**ResponseHub** solves this with an automatic, explainable priority score, a response-team roster with availability, nearest-suitable-team recommendations using real road routes (OSRM), a strict incident lifecycle that keeps teams and incidents consistent, a live operations map, and a dashboard computed from real records.

---

## 🚀 Features

| Feature | Subsystem | Mechanism | Output | Status |
|---|---|---|---|---|
| **1. Intelligent Incident Prioritization** | `src/domain/priority.ts`, `server/src/domain/priority.ts` | Transparent rule-based weighted score (0–100): severity 40, people affected 25, category 20, time since report 15. Critical ≥ 75, High ≥ 55, Medium ≥ 35, else Low. Recomputed on every change and every minute (waiting-time escalation). **Not ML** — every point is explained. | Priority badge, score, factor breakdown, priority sort, critical alerts | Working (browser demo) · API implemented |
| **2. Response Team Management** | `src/pages/TeamsPage.tsx`, `server/src/services/team.service.ts` | Add / edit / delete / search / filter teams; availability toggle; validation (unique names, coordinates, phone); map location picker; busy teams cannot be deleted or marked available. | Team roster (ID, name, category, lat/lng, availability, assigned incident, contact) | Working · API implemented |
| **3. Location-Based Team Assignment** | `src/services/routing.ts`, `server/src/services/assignment.service.ts` | Suitable categories per emergency → available teams → Haversine shortlist (PostGIS KNN on the server) → OSRM road routes → shortest drive time. Falls back to labelled straight-line distance if OSRM is down. Manual assignment with mutual-aid override. | Recommended team, straight-line vs road distance, ETA, route | Working |
| **4. Assignment & Incident Tracking** | `src/domain/workflow.ts`, `server/src/services/workflowTx.ts` | Reported → Assigned → In Progress → Resolved. Assigning sets Busy; resolving releases the team (Available). Atomic transitions; DB row locks + partial unique indexes prevent duplicate assignments. | Lifecycle stepper with timestamps, status history, assignment history | Working |
| **5. Route & Location Visualization** | `src/components/map/OperationsMap.tsx`, `src/pages/LiveMapPage.tsx` | Leaflet + OpenStreetMap; incident dots coloured by priority; team icons per category (ringed when busy); OSRM routes (solid) or straight-line fallback (dashed); popups; filters by category / priority. | Live map, incident map with proposed route | Working |
| **6. Advanced Analytics Dashboard** | `src/domain/analytics.ts`, `server/src/services/analytics.service.ts` | Metrics and charts from real records with date, category, location, priority and status filters; updates automatically on change. | Totals, critical, available/busy teams, assigned, resolved, priority/status/category/team charts, daily & weekly trends | Working |

---

## 🏗️ Tech Stack

### Frontend
| Component | Version | Role |
|---|---|---|
| **React** | `19` | UI (existing Round 1 app, extended) |
| **TypeScript** | `5.7` | Strict typing of incidents, teams, workflow |
| **Vite** | `8` | Dev server / build |
| **Tailwind CSS** | `4` | Existing design system (unchanged) |
| **Leaflet + OpenStreetMap** | `1.9` | Maps, markers, routes |
| **Recharts** | `2.15` | Dashboard charts (already in Round 1) |
| **OSRM** | public demo or self-hosted | Road distance, drive time, route geometry |

### Backend (`server/`)
| Component | Version | Role |
|---|---|---|
| **Node.js + Express** | `22+` / `5` | REST API |
| **Prisma** | `6` | ORM + migrations |
| **PostgreSQL + PostGIS** | `16` / `3.4` | Storage, spatial KNN, distances |
| **Socket.io** | `4.8` | Real-time incident / team updates |
| **Zod, JWT, bcrypt** | — | Validation, auth, RBAC |

---

## 📂 Project Structure

```
ResponseHub/
├── src/                              # React app (Round 1 + Round 2)
│   ├── domain/
│   │   ├── priority.ts               # Weighted priority score + explanation
│   │   ├── teams.ts                  # Suitable team categories, ranking
│   │   ├── geo.ts                    # Haversine distance, formatting
│   │   ├── workflow.ts               # Atomic incident/team state transitions
│   │   └── analytics.ts              # Dashboard metrics & trends
│   ├── services/
│   │   ├── incidentService.ts        # localStorage persistence (v2, migrates v1)
│   │   ├── routing.ts                # OSRM client + nearest-team recommender
│   │   ├── incidentApi.ts            # REST adapter for the backend
│   │   └── realtime.ts               # Socket.io client
│   ├── components/
│   │   ├── map/OperationsMap.tsx     # Incidents, teams, routes
│   │   ├── map/LocationPicker.tsx    # Click-to-set team location
│   │   ├── teams/TeamAssignmentPanel.tsx  # Recommend / assign / lifecycle actions
│   │   ├── teams/TeamFormDialog.tsx  # Add / edit team
│   │   └── incidents/{PriorityPanel,LifecycleTracker}.tsx
│   ├── pages/                        # Home, Report, Track, Hotspots, Dashboard,
│   │                                 # Incidents, Incident detail, Teams, Live map
│   ├── data/                         # Fictional seed incidents & teams
│   └── types/                        # incident.ts, team.ts, api.ts
├── server/                           # Express + Prisma + PostGIS API
│   ├── prisma/schema.prisma          # Incident, ResponseTeam, TeamAssignment, IncidentStatusChange…
│   ├── prisma/migrations/            # init, PostGIS triggers, Round 2 teams
│   ├── src/services/                 # incident, team, assignment, analytics, workflowTx
│   └── README.md                     # Full API reference
└── README.md
```

---

## ⚙️ Installation & Setup

### Prerequisites
- **Node.js** 22+ and npm
- **Docker** (only for the optional backend: PostGIS + MinIO)

### Step 1: Clone

```bash
git clone https://github.com/ariyan211/RescueHub.git
cd RescueHub
```

### Step 2: Run the web app (all six features work here)

```bash
npm install
npm run dev
```

Open the printed URL, then **Open Admin Demo** → Overview, Incidents, Response teams, Live map. Data is stored in the browser; **Reset demo data** restores the fictional dataset.

Optional `.env` for the web app:
```env
VITE_OSRM_URL=https://router.project-osrm.org   # or your own OSRM server
VITE_API_URL=http://localhost:4000              # only when using the backend adapter
```

### Step 3 (optional): Backend API

```bash
cd server
cp .env.example .env          # set JWT_SECRET, SEED_ADMIN_PASSWORD, OSRM_URL
npm install
npm run db:up                 # PostGIS
npm run db:deploy             # migrations
npm run db:generate
npm run db:seed               # admin + demo incidents + teams + assignments
npm run dev                   # http://localhost:4000
```

Key Round 2 endpoints (staff JWT required): `GET/POST /api/v1/admin/teams`, `PUT/DELETE /admin/teams/:id`, `PATCH /admin/teams/:id/availability`, `GET /admin/incidents/:id/recommendations`, `POST /admin/incidents/:id/assignments`, `DELETE /admin/incidents/:id/assignments/current`, `GET /admin/incidents/:id/route`, `GET /admin/analytics?category=&priority=&status=&location=&from=&to=`. See [server/README.md](server/README.md).

---

## 🧠 How It Works

```
Citizen / admin report
        │
        ▼
Saved ──► Priority score (severity + people + category + waiting time)
        │
        ▼
Suitable categories ──► Available teams ──► Haversine shortlist ──► OSRM road routes
        │                                                           │
        ▼                                                           ▼
Admin confirms recommended (or manual) team ◄──── nearest by drive time
        │
        ▼
Team BUSY · Incident ASSIGNED ──► map shows incident, team, route
        │
        ▼
Team on scene: IN PROGRESS ──► RESOLVED ──► team released (AVAILABLE)
        │
        ▼
Dashboard metrics & charts update automatically
```

**Priority formula:** `score = severity(8/18/30/40) + people(0/8/14/20/25) + category(6–20) + waiting(5/8/11/13/15)`; thresholds Critical ≥ 75, High ≥ 55, Medium ≥ 35. Critical severity is never below High.

**Distances:** straight-line = Haversine (great circle). Road distance and ETA come only from OSRM, and the UI labels which one is shown.

---

## 📈 Scalability

- PostGIS GiST indexes and KNN (`<->`) find the nearest teams without scanning the whole roster.
- Partial unique indexes guarantee one open assignment per team and per incident, even with many dispatchers.
- The OSRM shortlist is capped at 4 teams per recommendation, and routes are cached.
- The event bus can move to Redis pub/sub for several API instances.

---

## 💡 Feasibility

- Fully open-source and free: OpenStreetMap, Leaflet, OSRM, PostgreSQL/PostGIS. No paid API keys.
- The demo runs entirely in the browser; the backend runs with Docker Compose.
- OSRM can be self-hosted for production. The public demo server is fair-use only.

---

## 🌟 Novelty & Comparison

| Capability | ResponseHub | Manual dispatch | Generic ticketing tool |
|---|---|---|---|
| Priority | Explainable weighted score, auto-escalates | Gut feeling | Manual labels |
| Team selection | Nearest suitable team by road time | Guesswork | None |
| Duplicate / busy-team protection | Enforced (state machine + DB constraints) | None | None |
| Map with routes | Yes (OSM + OSRM) | Paper / separate tool | No |

---

## 🔧 Edge Cases Handled

- Routing service down or slow (7 s timeout) → straight-line fallback, clearly labelled, no fake ETA.
- Incident without coordinates → manual assignment only, with an explanation.
- Busy team assignment, double assignment, deleting a busy team, or marking an assigned team available → refused with a clear message.
- Two browser tabs → state syncs through storage events, and every action re-reads the latest saved state.
- Round 1 saved data → migrated to v2 automatically; nothing is deleted.

---

## ⚠️ Disclaimer

This is a hackathon prototype using **fictional** data. It is not a certified emergency dispatch system. The priority score is a rule-based aid, not validated triage. Always follow official emergency procedures.

---

## 📜 License

No license has been chosen yet. All rights reserved by the author until a license file is added.

---

## 🧩 Author & Team

- **Author:** ariyan211
- **Repository:** [https://github.com/ariyan211/RescueHub](https://github.com/ariyan211/RescueHub)
- **Event:** Code Clash 2026, Round 2
