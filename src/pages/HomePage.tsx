import {
  AlertTriangle,
  ArrowRight,
  Bell,
  Building2,
  Car,
  CheckCircle2,
  ClipboardCheck,
  Flame,
  HeartPulse,
  HelpCircle,
  MapPin,
  Search,
  ShieldCheck,
  Waves,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { IncidentMap } from "../components/incidents/IncidentMap";
import { Badge } from "../components/ui/Badge";
import { useIncidents } from "../hooks/useIncidents";
import { CATEGORIES } from "../types/incident";

const HERO_IMAGE =
  "https://images.unsplash.com/photo-1462258409682-731445253757?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=2000";

const categories = [
  ["Fire", Flame, "Smoke, flames, or fire hazards"],
  ["Road Accident", Car, "Collisions and road obstructions"],
  ["Medical Emergency", HeartPulse, "Urgent health incidents"],
  ["Flood", Waves, "Rising water and flood damage"],
  ["Building Collapse", Building2, "Structural damage or instability"],
  ["Other Emergency", HelpCircle, "Other urgent safety concerns"],
] as const;

const steps = [
  [
    ClipboardCheck,
    "01",
    "Submit details",
    "Share the incident, its location, and clear safety indicators.",
  ],
  [
    Search,
    "02",
    "Administrator review",
    "Demo administrators verify details and confirm severity.",
  ],
  [
    CheckCircle2,
    "03",
    "Track progress",
    "Use the generated reference to check status and update time.",
  ],
] as const;

const orangeButton =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#f2562b] px-6 py-3 text-sm font-bold text-white shadow-lg shadow-orange-900/30 transition hover:bg-[#ff6a3d]";
const ghostButton =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-white/25 px-6 py-3 text-sm font-bold text-white transition hover:border-white/60 hover:bg-white/10";

export default function HomePage() {
  const { incidents } = useIncidents();
  const [mapCategory, setMapCategory] = useState<string>("");
  const mapIncidents = incidents.filter((i) => !mapCategory || i.category === mapCategory);
  const stats = [
    ["Reports in this demo", incidents.length],
    [
      "Active critical",
      incidents.filter((i) => i.currentSeverity === "Critical" && i.status !== "Resolved").length,
    ],
    ["In progress", incidents.filter((i) => i.status === "In Progress").length],
    ["Resolved", incidents.filter((i) => i.status === "Resolved").length],
  ] as const;

  return (
    <main>
      {/* Hero */}
      <section className="relative isolate overflow-hidden bg-[#070d18] text-white">
        <img
          src={HERO_IMAGE}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 -z-20 h-full w-full object-cover object-center opacity-60"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#070d18] via-[#070d18]/90 to-[#070d18]/20" />
        <div className="absolute inset-x-0 bottom-0 -z-10 h-40 bg-gradient-to-t from-[#070d18] to-transparent" />
        <div className="page-container grid items-center gap-12 py-16 lg:min-h-[640px] lg:grid-cols-[1.05fr_.95fr] lg:py-24">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-orange-400/30 bg-orange-500/10 px-3 py-1 text-xs font-bold uppercase tracking-[.15em] text-orange-300">
              <span className="h-1.5 w-1.5 rounded-full bg-orange-400" />
              Emergency response platform
            </span>
            <h1 className="mt-6 max-w-xl text-4xl font-extrabold leading-[1.08] tracking-[-.03em] sm:text-6xl">
              Report &amp; Track Emergencies in Real-Time
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-slate-300">
              Report emergencies. Bring clarity to response. Submit structured incident details, let
              administrators review urgency, and follow progress with a simple reference number.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link to="/report" className={orangeButton}>
                Report an Incident <ArrowRight size={17} />
              </Link>
              <Link to="/track" className={ghostButton}>
                Track a Report
              </Link>
            </div>
            <div className="mt-8 flex max-w-xl gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-[13px] leading-5 text-slate-300 backdrop-blur">
              <AlertTriangle size={18} className="mt-0.5 shrink-0 text-orange-400" />
              <p>
                <strong className="text-white">Prototype only.</strong> This application does not
                contact emergency services or dispatch responders. If you are in immediate danger,
                contact your local emergency services.
              </p>
            </div>
          </div>

          {/* Sample dashboard preview (fictional) */}
          <div className="relative hidden lg:block" aria-label="Sample incident interface preview">
            <div className="absolute -right-4 -top-6 flex items-center gap-2 rounded-lg border border-orange-400/40 bg-[#0d1626]/80 px-3 py-1.5 text-xs font-bold tracking-wider text-orange-300 backdrop-blur">
              <Bell size={13} /> REPORTS
            </div>
            <div className="rounded-3xl border border-white/10 bg-[#0d1626]/75 p-5 shadow-2xl shadow-black/40 backdrop-blur-md">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
                    Sample incident preview
                  </p>
                  <p className="mt-1 font-bold">Priority queue</p>
                </div>
                <span className="relative flex h-3 w-3">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-400 opacity-60" />
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-orange-500" />
                </span>
              </div>
              <div className="mt-4 space-y-3">
                <div className="rounded-xl border border-red-400/30 bg-red-500/10 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold text-slate-400">RH-DEMO-4105</p>
                      <p className="mt-1 font-bold">Cracked awning over entrance</p>
                    </div>
                    <Badge value="Critical" />
                  </div>
                  <p className="mt-3 flex items-center gap-2 text-sm text-slate-300">
                    <MapPin size={15} /> Market Hall, South Entrance
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold text-slate-400">RH-DEMO-4102</p>
                      <p className="mt-1 font-bold">Two-car intersection collision</p>
                    </div>
                    <Badge value="High" />
                  </div>
                  <div className="mt-3 flex items-center justify-between text-sm text-slate-300">
                    Road Accident <Badge value="Pending" />
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-xl bg-blue-500/15 p-4 text-sm font-semibold text-blue-200">
                  <ShieldCheck size={19} /> Every update is recorded in an activity timeline.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Live stats */}
      <section className="bg-[#070d18] pb-14 text-white" aria-label="Demo statistics">
        <div className="page-container grid grid-cols-2 gap-4 lg:grid-cols-4">
          {stats.map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <p className="text-3xl font-extrabold text-white">{value}</p>
              <p className="mt-1 text-sm text-slate-400">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Categories */}
      <section className="bg-[#f3ecdc] py-20">
        <div className="page-container">
          <div className="section-heading">
            <span className="eyebrow !text-[#d9431a]">Report by category</span>
            <h2>Choose the incident type that fits best</h2>
            <p>
              Consistent categories help administrators quickly understand and organize incoming
              reports.
            </p>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map(([name, Icon, text]) => (
              <Link
                to="/report"
                key={name}
                className="group rounded-2xl border border-[#e4d8bb] bg-[#fbf7ee] p-6 transition hover:-translate-y-0.5 hover:border-orange-300 hover:shadow-lg"
              >
                <span className="grid h-12 w-12 place-items-center rounded-xl bg-[#0d1626] text-orange-400">
                  <Icon size={22} />
                </span>
                <h3 className="mt-5 font-bold text-slate-950">{name}</h3>
                <p className="mt-1 text-sm text-slate-500">{text}</p>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-[#d9431a] opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
                  Report this <ArrowRight size={14} />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Map */}
      <section className="bg-[#0b1322] py-20 text-white" aria-labelledby="map-heading">
        <div className="page-container">
          <span className="eyebrow !text-orange-300">Live map</span>
          <h2
            id="map-heading"
            className="mt-2 max-w-2xl text-3xl font-extrabold tracking-tight sm:text-4xl"
          >
            See where reports are coming in
          </h2>
          <p className="mt-3 max-w-2xl leading-7 text-slate-400">
            Explore reports saved in this browser demo. For privacy, positions are approximate and
            only category and status are shown. Use the filters, zoom, and drag to explore.
          </p>
          <div className="mt-8 rounded-3xl bg-[#f3ecdc] p-4 text-slate-900 sm:p-6">
            <div
              className="mb-4 flex flex-wrap gap-2"
              role="group"
              aria-label="Filter map by category"
            >
              {["", ...CATEGORIES].map((c) => (
                <button
                  key={c || "all"}
                  type="button"
                  aria-pressed={mapCategory === c}
                  onClick={() => setMapCategory(c)}
                  className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold ${mapCategory === c ? "border-[#f2562b] bg-[#f2562b] text-white" : "border-[#dccfae] bg-[#fbf7ee] text-slate-600 hover:border-[#c9b98f]"}`}
                >
                  {c || "All categories"}
                </button>
              ))}
            </div>
            <IncidentMap incidents={mapIncidents} publicMode scrollZoom height={420} />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-[#f3ecdc] py-20">
        <div className="page-container">
          <div className="section-heading">
            <span className="eyebrow !text-[#d9431a]">How it works</span>
            <h2>From report to resolution</h2>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {steps.map(([Icon, number, title, text]) => (
              <article className="card !border-[#e4d8bb] !bg-[#fbf7ee]" key={title}>
                <div className="flex items-center justify-between">
                  <span className="grid h-12 w-12 place-items-center rounded-xl bg-orange-50 text-[#d9431a]">
                    <Icon size={22} />
                  </span>
                  <span className="text-3xl font-extrabold text-slate-200">{number}</span>
                </div>
                <h3 className="mt-5 text-lg font-bold">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="bg-[#070d18] py-20 text-white">
        <div className="page-container flex flex-col items-start justify-between gap-8 lg:flex-row lg:items-center">
          <div>
            <h2 className="max-w-xl text-3xl font-extrabold tracking-tight sm:text-4xl">
              Clear reports make for clearer response.
            </h2>
            <p className="mt-3 max-w-xl text-slate-400">
              Try the full workflow: submit a report, review it as a demo administrator, and track
              its status.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link to="/report" className={orangeButton}>
              Report an Incident <ArrowRight size={17} />
            </Link>
            <Link to="/admin" className={ghostButton}>
              Open Admin Demo
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
