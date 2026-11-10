import { Car, Flame, MapPin, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { HotspotMap } from "../components/incidents/HotspotMap";
import { useIncidents } from "../hooks/useIncidents";
import { CATEGORIES } from "../types/incident";
import { elapsedTime } from "../utils/dateFormat";
import { areaLabel, computeHotspots } from "../utils/hotspots";

const PERIODS = [
  ["7", "Last 7 days"],
  ["30", "Last 30 days"],
  ["all", "All time"],
] as const;

const DAY = 86_400_000;

export default function HotspotsPage() {
  const { incidents } = useIncidents();
  const [category, setCategory] = useState("");
  const [period, setPeriod] = useState<string>("30");
  const [selected, setSelected] = useState<string | null>(null);

  const inPeriod = useMemo(
    () =>
      incidents.filter(
        (i) => period === "all" || Date.now() - Date.parse(i.createdAt) <= Number(period) * DAY,
      ),
    [incidents, period],
  );
  const filtered = useMemo(
    () => inPeriod.filter((i) => !category || i.category === category),
    [inPeriod, category],
  );
  const hotspots = useMemo(() => computeHotspots(filtered), [filtered]);
  const accidentSpots = useMemo(
    () => computeHotspots(inPeriod.filter((i) => i.category === "Road Accident")).slice(0, 3),
    [inPeriod],
  );
  const recurring = hotspots.filter((h) => h.count >= 2);
  const maxCount = Math.max(1, ...hotspots.map((h) => h.count));
  const categoryData = CATEGORIES.map((name) => ({
    name,
    count: inPeriod.filter((i) => i.category === name).length,
  }));
  const trend = Array.from({ length: 14 }, (_, n) => {
    const day = new Date();
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() - (13 - n));
    const start = day.getTime();
    return {
      day: day.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      count: filtered.filter((i) => {
        const t = Date.parse(i.createdAt);
        return t >= start && t < start + DAY;
      }).length,
    };
  });
  const accidentCount = inPeriod.filter((i) => i.category === "Road Accident").length;
  const topArea = hotspots[0];

  const summary = [
    [MapPin, "Active hotspot areas", recurring.length, "Areas with 2+ reports"],
    [Flame, "Reports in view", filtered.length, `${hotspots.length} areas plotted`],
    [Car, "Road accidents", accidentCount, `${accidentSpots.length} accident areas`],
    [
      TrendingUp,
      "Busiest area",
      topArea ? topArea.count : 0,
      topArea ? areaLabel(topArea) : "No data",
    ],
  ] as const;

  return (
    <main>
      <section className="bg-[#070d18] py-12 text-white">
        <div className="page-container">
          <span className="eyebrow !text-orange-300">Community insights</span>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-5xl">
            Hotspots and recurring incidents
          </h1>
          <p className="mt-4 max-w-2xl leading-7 text-slate-400">
            See which areas report incidents most often, with a closer look at road accidents. Areas
            are grouped into roughly 3 km zones and show counts only, never individual reports,
            exact locations, or personal details.
          </p>
        </div>
      </section>

      <div className="page-container space-y-6 py-10">
        <div className="flex flex-col gap-4 rounded-2xl border border-[#e4d8bb] bg-[#fbf7ee] p-4 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="label" htmlFor="hs-category">
              Incident type
            </label>
            <select
              id="hs-category"
              className="input"
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setSelected(null);
              }}
            >
              <option value="">All categories</option>
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="label" htmlFor="hs-period">
              Time period
            </label>
            <select
              id="hs-period"
              className="input"
              value={period}
              onChange={(e) => {
                setPeriod(e.target.value);
                setSelected(null);
              }}
            >
              {PERIODS.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            className="button-secondary justify-center"
            onClick={() => {
              setCategory("Road Accident");
              setSelected(null);
            }}
          >
            <Car size={16} /> Focus on road accidents
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {summary.map(([Icon, label, value, note]) => (
            <article key={label} className="rounded-2xl border border-[#e4d8bb] bg-[#fbf7ee] p-5">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#0d1626] text-orange-400">
                <Icon size={19} />
              </span>
              <p className="mt-4 text-3xl font-extrabold text-slate-950">{value}</p>
              <p className="text-sm font-semibold text-slate-700">{label}</p>
              <p className="mt-0.5 truncate text-xs text-slate-500">{note}</p>
            </article>
          ))}
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
          <section className="rounded-2xl border border-[#e4d8bb] bg-[#fbf7ee] p-4 sm:p-6">
            <h2 className="text-lg font-bold">Hotspot map</h2>
            <p className="mb-4 mt-1 text-sm text-slate-600">
              Larger, darker circles mean more reports. Select a circle or a list item to focus.
            </p>
            <HotspotMap hotspots={hotspots} selectedId={selected} onSelect={setSelected} />
          </section>

          <section className="rounded-2xl border border-[#e4d8bb] bg-[#fbf7ee] p-4 sm:p-6">
            <h2 className="text-lg font-bold">Ranked areas</h2>
            <p className="mb-4 mt-1 text-sm text-slate-600">
              Most frequently reported areas first.
            </p>
            {hotspots.length ? (
              <ol className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
                {hotspots.map((h, index) => (
                  <li key={h.id}>
                    <button
                      type="button"
                      aria-pressed={selected === h.id}
                      onClick={() => setSelected(h.id)}
                      className={`w-full rounded-xl border p-3 text-left transition ${selected === h.id ? "border-[#0b1322] bg-white" : "border-[#e4d8bb] bg-white/60 hover:border-[#c9b98f]"}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="flex items-center gap-2 text-sm font-bold text-slate-900">
                          <span className="grid h-6 w-6 place-items-center rounded-full bg-[#0d1626] text-xs text-white">
                            {index + 1}
                          </span>
                          {areaLabel(h)}
                        </span>
                        {h.count >= 2 && (
                          <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-bold text-[#b53a14]">
                            Recurring
                          </span>
                        )}
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#e8dcc0]">
                        <div
                          className="h-full rounded-full bg-[#f2562b]"
                          style={{ width: `${(h.count / maxCount) * 100}%` }}
                        />
                      </div>
                      <p className="mt-2 text-xs text-slate-600">
                        {h.count} {h.count === 1 ? "report" : "reports"} · mostly {h.topCategory}
                        {h.accidents > 0 &&
                          ` · ${h.accidents} road ${h.accidents === 1 ? "accident" : "accidents"}`}{" "}
                        · latest {elapsedTime(h.lastReportedAt)}
                      </p>
                    </button>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="rounded-xl border border-dashed border-[#cdbf9c] p-6 text-center text-sm text-slate-600">
                No located incidents match these filters.
              </p>
            )}
          </section>
        </div>

        <section className="rounded-2xl border border-[#e4d8bb] bg-[#fbf7ee] p-4 sm:p-6">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <Car size={19} /> Road accident hotspots
          </h2>
          <p className="mb-4 mt-1 text-sm text-slate-600">
            Areas with the most road accident reports in the selected period.
          </p>
          {accidentSpots.length ? (
            <div className="grid gap-3 md:grid-cols-3">
              {accidentSpots.map((h, i) => (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => {
                    setCategory("Road Accident");
                    setSelected(h.id);
                  }}
                  className="rounded-xl border border-[#e4d8bb] bg-white/70 p-4 text-left hover:border-[#c9b98f]"
                >
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    #{i + 1}
                  </p>
                  <p className="mt-1 font-bold text-slate-900">{areaLabel(h)}</p>
                  <p className="mt-2 text-2xl font-extrabold text-[#d9431a]">{h.accidents}</p>
                  <p className="text-xs text-slate-600">
                    road {h.accidents === 1 ? "accident" : "accidents"} · latest{" "}
                    {elapsedTime(h.lastReportedAt)}
                  </p>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-600">No located road accidents in this period.</p>
          )}
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-[#e4d8bb] bg-[#fbf7ee] p-4 sm:p-6">
            <h2 className="text-lg font-bold">Reports by category</h2>
            <div className="mt-4 h-64" role="img" aria-label="Bar chart of reports by category">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryData} margin={{ left: -25, bottom: 40 }}>
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11 }}
                    interval={0}
                    angle={-25}
                    textAnchor="end"
                  />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip cursor={{ fill: "#efe6d0" }} />
                  <Bar dataKey="count" fill="#f2562b" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
          <section className="rounded-2xl border border-[#e4d8bb] bg-[#fbf7ee] p-4 sm:p-6">
            <h2 className="text-lg font-bold">Reports per day, last 14 days</h2>
            <div
              className="mt-4 h-64"
              role="img"
              aria-label="Bar chart of reports per day for the last 14 days"
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trend} margin={{ left: -25 }}>
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} interval={1} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip cursor={{ fill: "#efe6d0" }} />
                  <Bar dataKey="count" fill="#0d1626" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        </div>

        <p className="text-xs leading-5 text-slate-500">
          Prototype data from this browser only. Demo incidents use fictional, approximate
          coordinates, and hotspot rankings are not validated safety or risk assessments.
        </p>
      </div>
    </main>
  );
}
