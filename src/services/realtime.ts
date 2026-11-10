/**
 * Socket.io client for live incident updates.
 * Requires the `socket.io-client` package:  pnpm add socket.io-client
 *
 *   // Staff console (DashboardPage / IncidentListPage / map)
 *   const rt = connectRealtime();            // uses the stored staff token
 *   const off = rt.onIncidentCreated((i) => ...);
 *
 *   // Citizen TrackPage
 *   const stop = await rt.trackIncident("RH-2026-7K3QX9MD", (incident, change) => ...);
 */
import { io, type Socket } from "socket.io-client";
import type { ApiActivity, ApiIncident, PublicIncident } from "../types/api";
import { API_URL, getToken } from "./incidentApi";

interface ServerToClient {
  "incident:created": (p: { incident: ApiIncident }) => void;
  "incident:updated": (p: { incident: ApiIncident | PublicIncident; change: ApiActivity | null }) => void;
  "incident:deleted": (p: { id: string }) => void;
}

type Ack = { ok: true; trackingCode: string } | { ok: false; error: string };

interface ClientToServer {
  "track:subscribe": (p: { trackingCode: string }, ack: (res: Ack) => void) => void;
  "track:unsubscribe": (p: { trackingCode: string }) => void;
}

export function connectRealtime(token: string | null = getToken()) {
  const socket: Socket<ServerToClient, ClientToServer> = io(API_URL || window.location.origin, {
    path: "/realtime",
    auth: token ? { token } : {},
    transports: ["websocket", "polling"],
  });
  const tracked = new Map<string, (incident: PublicIncident, change: ApiActivity | null) => void>();

  // Rooms are lost on reconnect; re-join anything we were tracking.
  socket.on("connect", () => {
    for (const code of tracked.keys()) socket.emit("track:subscribe", { trackingCode: code }, () => {});
  });

  return {
    socket,

    onIncidentCreated(handler: (incident: ApiIncident) => void) {
      const fn = ({ incident }: { incident: ApiIncident }) => handler(incident);
      socket.on("incident:created", fn);
      return () => void socket.off("incident:created", fn);
    },

    /** Staff sockets receive full ApiIncident payloads. */
    onIncidentUpdated(handler: (incident: ApiIncident, change: ApiActivity | null) => void) {
      const fn: ServerToClient["incident:updated"] = ({ incident, change }) => {
        if ("id" in incident) handler(incident, change);
      };
      socket.on("incident:updated", fn);
      return () => void socket.off("incident:updated", fn);
    },

    onIncidentDeleted(handler: (id: string) => void) {
      const fn = ({ id }: { id: string }) => handler(id);
      socket.on("incident:deleted", fn);
      return () => void socket.off("incident:deleted", fn);
    },

    /** Citizen tracking: resolves with an unsubscribe function, rejects if the code is unknown. */
    trackIncident(
      reference: string,
      handler: (incident: PublicIncident, change: ApiActivity | null) => void,
    ): Promise<() => void> {
      return new Promise((resolve, reject) => {
        socket.emit("track:subscribe", { trackingCode: reference }, (res) => {
          if (!res.ok) return reject(new Error(res.error));
          const code = res.trackingCode;
          tracked.set(code, handler);
          const fn: ServerToClient["incident:updated"] = ({ incident, change }) => {
            if (incident.reference === code) handler(incident as PublicIncident, change);
          };
          socket.on("incident:updated", fn);
          resolve(() => {
            tracked.delete(code);
            socket.off("incident:updated", fn);
            socket.emit("track:unsubscribe", { trackingCode: code });
          });
        });
      });
    },

    disconnect: () => void socket.disconnect(),
  };
}

export type RealtimeClient = ReturnType<typeof connectRealtime>;
