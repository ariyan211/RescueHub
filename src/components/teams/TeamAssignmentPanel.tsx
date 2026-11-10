import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Navigation,
  PlayCircle,
  RefreshCw,
  Route as RouteIcon,
  UserMinus,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import type { ActionResult } from "../../context/IncidentContext";
import { formatKm, formatMinutes } from "../../domain/geo";
import { rankTeams, SUITABLE_TEAMS } from "../../domain/teams";
import { useIncidents } from "../../hooks/useIncidents";
import {
  getRoute,
  recommendTeam,
  toRouteInfo,
  type Recommendation,
  type RouteResult,
} from "../../services/routing";
import type { Incident } from "../../types/incident";
import type { ResponseTeam } from "../../types/team";
import { formatDate } from "../../utils/dateFormat";
import type { PreviewRoute } from "../map/OperationsMap";
import { Badge } from "../ui/Badge";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { teamColors, teamIcons } from "./teamVisuals";

function RouteFacts({ route, straightLineKm }: { route?: RouteResult; straightLineKm?: number }) {
  return (
    <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
      <div>
        <dt>Straight-line</dt>
        <dd>{straightLineKm !== undefined ? formatKm(straightLineKm) : "No coordinates"}</dd>
      </div>
      <div>
        <dt>Road route</dt>
        <dd>
          {!route ? (
            straightLineKm === undefined ? "—" : <span className="text-slate-400">Calculating…</span>
          ) : route.source === "osrm" ? (
            <>
              {formatKm(route.distanceKm)}
              {route.durationMin !== undefined && (
                <span className="block text-xs text-slate-500">
                  ≈ {formatMinutes(route.durationMin)} drive (OSRM)
                </span>
              )}
            </>
          ) : (
            <span className="text-amber-800">
              Unavailable
              <span className="block text-xs text-slate-500">
                {route.fallbackReason ?? "routing service unavailable"} — using straight-line
                distance, no travel time.
              </span>
            </span>
          )}
        </dd>
      </div>
    </dl>
  );
}

function TeamHeading({ team }: { team: ResponseTeam }) {
  const Icon = teamIcons[team.category];
  return (
    <div className="flex items-start gap-3">
      <span
        className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-white"
        style={{ background: teamColors[team.category] }}
      >
        <Icon size={19} />
      </span>
      <div className="min-w-0">
        <p className="font-bold text-slate-950">{team.name}</p>
        <p className="text-xs text-slate-500">
          {team.id} · {team.category} · {team.contactName} · {team.contactPhone}
        </p>
      </div>
    </div>
  );
}

export function TeamAssignmentPanel({
  incident,
  onPreview,
  onDone,
}: {
  incident: Incident;
  onPreview?: (preview: PreviewRoute | null) => void;
  onDone?: (message: string) => void;
}) {
  const { teams, assignTeam, unassignTeam, changeStatus } = useIncidents();
  const [recommendation, setRecommendation] = useState<Recommendation | null | undefined>(undefined);
  const [manualId, setManualId] = useState("");
  const [override, setOverride] = useState(false);
  const [manualRoute, setManualRoute] = useState<RouteResult | undefined>();
  const [currentRoute, setCurrentRoute] = useState<RouteResult | undefined>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmUnassign, setConfirmUnassign] = useState(false);
  const [showManual, setShowManual] = useState(false);

  const team = teams.find((t) => t.id === incident.assignedTeamId);
  const candidates = useMemo(() => rankTeams(incident, teams), [incident, teams]);
  const manual = candidates.find((c) => c.team.id === manualId);
  const teamsKey = teams.map((t) => `${t.id}:${t.availability}:${t.latitude},${t.longitude}`).join("|");
  const canAssign = incident.status !== "Resolved";

  // Recommend the nearest suitable available team whenever the situation changes.
  useEffect(() => {
    if (team || !canAssign) {
      setRecommendation(undefined);
      return;
    }
    let cancelled = false;
    setRecommendation(undefined);
    void recommendTeam(incident, teams).then((r) => !cancelled && setRecommendation(r));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incident.id, incident.category, incident.coordinates?.latitude, incident.coordinates?.longitude, team?.id, canAssign, teamsKey]);

  // Route for the currently assigned team.
  useEffect(() => {
    setCurrentRoute(undefined);
    if (!team || !incident.coordinates) return;
    let cancelled = false;
    void getRoute({ latitude: team.latitude, longitude: team.longitude }, incident.coordinates).then(
      (r) => !cancelled && setCurrentRoute(r),
    );
    return () => {
      cancelled = true;
    };
  }, [team?.id, team?.latitude, team?.longitude, incident.coordinates?.latitude, incident.coordinates?.longitude]);

  // Route for a manually selected team.
  useEffect(() => {
    setManualRoute(undefined);
    setOverride(false);
    if (!manual || !incident.coordinates) return;
    let cancelled = false;
    void getRoute({ latitude: manual.team.latitude, longitude: manual.team.longitude }, incident.coordinates).then(
      (r) => !cancelled && setManualRoute(r),
    );
    return () => {
      cancelled = true;
    };
  }, [manualId, manual?.team.latitude, manual?.team.longitude, incident.coordinates?.latitude, incident.coordinates?.longitude]);

  // Show the proposed route on the incident map.
  useEffect(() => {
    if (!onPreview) return;
    if (showManual && manual && manualRoute) onPreview({ teamId: manual.team.id, incidentId: incident.id, route: manualRoute });
    else if (!team && recommendation) onPreview({ teamId: recommendation.candidate.team.id, incidentId: incident.id, route: recommendation.route });
    else onPreview(null);
  }, [onPreview, showManual, manual, manualRoute, team, recommendation, incident.id]);

  function handle(result: ActionResult, success: string) {
    if (result.ok) {
      setError("");
      setManualId("");
      setShowManual(false);
      onDone?.(success);
    } else setError(result.error);
  }

  function confirmRecommended() {
    if (!recommendation) return;
    setBusy(true);
    handle(
      assignTeam(incident.id, recommendation.candidate.team.id, {
        method: "recommended",
        route: toRouteInfo(recommendation.route),
      }),
      `${recommendation.candidate.team.name} assigned`,
    );
    setBusy(false);
  }

  function assignManual() {
    if (!manual) return;
    handle(
      assignTeam(incident.id, manual.team.id, {
        method: "manual",
        ...(manualRoute && { route: toRouteInfo(manualRoute) }),
        overrideCategory: override,
      }),
      `${manual.team.name} assigned`,
    );
  }

  const suitableList = SUITABLE_TEAMS[incident.category].join(", ");
  const open = incident.assignments.find((a) => !a.releasedAt);
  const history = [...incident.assignments].reverse();

  return (
    <section className="card" aria-labelledby="team-panel-title">
      <h2 id="team-panel-title" className="flex items-center gap-2 text-lg font-bold">
        <Navigation size={19} />
        Response team
      </h2>
      <p className="mt-1 text-xs text-slate-500">Suitable for {incident.category}: {suitableList}.</p>

      {error && (
        <p role="alert" className="mt-4 flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-800">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          {error}
        </p>
      )}

      {team ? (
        <div className="mt-5 rounded-xl border border-indigo-100 bg-indigo-50/40 p-4">
          <div className="flex items-start justify-between gap-3">
            <TeamHeading team={team} />
            <Badge value={team.availability} />
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Assigned {open ? formatDate(open.assignedAt) : ""}
            {open ? ` · ${open.method === "recommended" ? "nearest-team recommendation" : "manual assignment"}` : ""}
          </p>
          <RouteFacts
            route={currentRoute}
            straightLineKm={
              incident.coordinates
                ? candidates.find((c) => c.team.id === team.id)?.straightLineKm
                : undefined
            }
          />
          <div className="mt-4 grid gap-2">
            {incident.status === "Assigned" && (
              <button
                className="button-primary justify-center"
                onClick={() => handle(changeStatus(incident.id, "In Progress"), "Incident marked In Progress")}
              >
                <PlayCircle size={16} />
                Team on scene — mark In Progress
              </button>
            )}
            <button
              className="button-secondary justify-center"
              onClick={() => handle(changeStatus(incident.id, "Resolved"), `Resolved · ${team.name} released`)}
            >
              <CheckCircle2 size={16} />
              Mark resolved and release team
            </button>
            <div className="flex gap-2">
              <button className="button-secondary flex-1 justify-center !py-2 text-sm" onClick={() => setShowManual((v) => !v)}>
                <RefreshCw size={15} />
                Reassign
              </button>
              <button className="button-secondary flex-1 justify-center !py-2 text-sm" onClick={() => setConfirmUnassign(true)}>
                <UserMinus size={15} />
                Unassign
              </button>
            </div>
          </div>
        </div>
      ) : !canAssign ? (
        <p className="mt-5 rounded-xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
          Incident resolved. Any assigned team has been released. Reopen the incident (set it to
          Reported or Pending) to assign a team again.
        </p>
      ) : (
        <div className="mt-5">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Recommended — nearest suitable available team
          </p>
          {recommendation === undefined ? (
            <p className="mt-3 flex items-center gap-2 text-sm text-slate-500">
              <Loader2 size={16} className="animate-spin" />
              Finding the nearest suitable team and checking road routes…
            </p>
          ) : recommendation === null ? (
            <div className="mt-3 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
              {!incident.coordinates ? (
                <>This report has no coordinates, so distance cannot be calculated. Choose a team manually below.</>
              ) : (
                <>
                  No suitable team is available right now. All {suitableList} teams are busy or
                  none exist. Free a team, <Link className="font-bold underline" to="/admin/teams">add a team</Link>,
                  or assign another category manually with an override.
                </>
              )}
            </div>
          ) : (
            <div className="mt-3 rounded-xl border border-violet-200 bg-violet-50/40 p-4">
              <div className="flex items-start justify-between gap-3">
                <TeamHeading team={recommendation.candidate.team} />
                <Badge value={recommendation.candidate.team.availability} />
              </div>
              <RouteFacts route={recommendation.route} straightLineKm={recommendation.candidate.straightLineKm} />
              <p className="mt-3 text-xs text-slate-500">
                {recommendation.basis === "road-duration"
                  ? `Chosen by shortest OSRM drive time among the ${1 + recommendation.alternatives.length} nearest suitable teams.`
                  : "Road routing unavailable — chosen by shortest straight-line (Haversine) distance."}
                {" "}Purple line on the map shows the proposed route.
              </p>
              {recommendation.alternatives.length > 0 && (
                <ul className="mt-3 space-y-1 text-xs text-slate-600">
                  {recommendation.alternatives.map((alt) => (
                    <li key={alt.candidate.team.id}>
                      Next: {alt.candidate.team.name} —{" "}
                      {alt.route.source === "osrm"
                        ? `${formatKm(alt.route.distanceKm)} road${alt.route.durationMin !== undefined ? `, ${formatMinutes(alt.route.durationMin)}` : ""}`
                        : `${formatKm(alt.route.distanceKm)} straight-line`}
                    </li>
                  ))}
                </ul>
              )}
              <button className="button-primary mt-4 w-full justify-center" disabled={busy} onClick={confirmRecommended}>
                <CheckCircle2 size={16} />
                Confirm assignment
              </button>
            </div>
          )}
          <button className="mt-4 text-sm font-bold text-blue-700 hover:underline" onClick={() => setShowManual((v) => !v)}>
            {showManual ? "Hide manual assignment" : "Choose a team manually"}
          </button>
        </div>
      )}

      {showManual && canAssign && (
        <div className="mt-4 border-t border-slate-100 pt-4">
          <label className="label" htmlFor="manual-team">
            {team ? "Reassign to" : "Assign team manually"}
          </label>
          <select id="manual-team" className="input" value={manualId} onChange={(e) => setManualId(e.target.value)}>
            <option value="">Select a team…</option>
            {candidates.map((c) => (
              <option key={c.team.id} value={c.team.id} disabled={!c.available || c.team.id === team?.id}>
                {c.team.name} · {c.team.category}
                {c.straightLineKm !== undefined ? ` · ${formatKm(c.straightLineKm)}` : ""}
                {!c.available ? " · BUSY" : !c.suitable ? " · not a standard match" : ""}
              </option>
            ))}
          </select>
          <p className="mt-2 text-xs text-slate-500">
            Busy teams cannot be selected. Distances in this list are straight-line.
          </p>
          {manual && (
            <div className="mt-3">
              <RouteFacts route={manualRoute} straightLineKm={manual.straightLineKm} />
              {!manual.suitable && (
                <label className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
                  <input type="checkbox" className="mt-1" checked={override} onChange={(e) => setOverride(e.target.checked)} />
                  {manual.team.category} teams are not a standard responder for {incident.category}. Assign anyway (mutual aid)?
                </label>
              )}
              <button
                className="button-primary mt-3 w-full justify-center"
                disabled={!manual.suitable && !override}
                onClick={assignManual}
              >
                <RouteIcon size={16} />
                {team ? "Reassign team" : "Assign selected team"}
              </button>
            </div>
          )}
        </div>
      )}

      {history.length > 0 && (
        <div className="mt-5 border-t border-slate-100 pt-4">
          <h3 className="text-sm font-bold text-slate-800">Assignment history</h3>
          <ol className="mt-3 space-y-3">
            {history.map((a) => (
              <li key={a.id} className="text-xs text-slate-600">
                <p className="font-semibold text-slate-800">
                  {a.teamName} <span className="font-normal text-slate-500">({a.teamCategory})</span>
                  {!a.releasedAt && <span className="ml-1 font-bold text-indigo-700">· active</span>}
                </p>
                <p>
                  Assigned {formatDate(a.assignedAt)} · {a.method}
                  {a.route
                    ? a.route.source === "osrm"
                      ? ` · ${formatKm(a.route.distanceKm)} road${a.route.durationMin !== undefined ? `, ~${formatMinutes(a.route.durationMin)}` : ""}`
                      : ` · ${formatKm(a.route.distanceKm)} straight-line`
                    : ""}
                </p>
                {a.releasedAt && (
                  <p>
                    Released {formatDate(a.releasedAt)} ({a.releaseReason?.replace("_", " ")})
                  </p>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}

      <ConfirmDialog
        open={confirmUnassign}
        title="Unassign this team?"
        description={`${team?.name ?? "The team"} becomes Available again and the incident returns to Pending until another team is assigned.`}
        confirmLabel="Unassign team"
        onCancel={() => setConfirmUnassign(false)}
        onConfirm={() => {
          setConfirmUnassign(false);
          handle(unassignTeam(incident.id), "Team unassigned");
        }}
      />
    </section>
  );
}
