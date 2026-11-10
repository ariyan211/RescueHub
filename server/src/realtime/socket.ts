import type { Server as HttpServer } from "node:http";
import { Server, type Socket } from "socket.io";
import type { Role } from "@prisma/client";
import { env } from "../config/env.js";
import type { IncidentDTO, PublicIncidentDTO, ActivityDTO } from "../domain/contract.js";
import { logger } from "../lib/logger.js";
import { STAFF } from "../middleware/auth.js";
import { verifyToken, type AuthUser } from "../services/auth.service.js";
import { trackingCodeExists } from "../services/incident.service.js";
import { bus } from "./events.js";

/**
 * Rooms
 *   staff             authenticated dispatchers/responders/admins — full incident payloads
 *   track:<code>      citizens following one report — redacted public payloads only
 *
 * Client → server
 *   track:subscribe   ({ trackingCode }, ack)  join a tracking room
 *   track:unsubscribe ({ trackingCode })
 *
 * Server → client
 *   incident:created  staff:  { incident: IncidentDTO }
 *   incident:updated  staff:  { incident: IncidentDTO, change }   track: { incident: PublicIncidentDTO, change }
 *   incident:deleted  staff:  { id }
 */
export interface ServerToClientEvents {
  "incident:created": (payload: { incident: IncidentDTO }) => void;
  "incident:updated": (payload: {
    incident: IncidentDTO | PublicIncidentDTO;
    change: ActivityDTO | null;
  }) => void;
  "incident:deleted": (payload: { id: string }) => void;
}

type Ack = (res: { ok: true; trackingCode: string } | { ok: false; error: string }) => void;

export interface ClientToServerEvents {
  "track:subscribe": (payload: { trackingCode: string }, ack?: Ack) => void;
  "track:unsubscribe": (payload: { trackingCode: string }) => void;
}

interface SocketData {
  user?: AuthUser;
  tracking: Set<string>;
}

type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

const MAX_TRACKED_PER_SOCKET = 5;
const trackRoom = (code: string) => `track:${code}`;

export function createRealtime(httpServer: HttpServer) {
  const io = new Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>(
    httpServer,
    {
      path: "/realtime",
      cors: { origin: env.CORS_ORIGINS },
      // Small payloads only; prevents memory abuse from clients.
      maxHttpBufferSize: 16 * 1024,
    },
  );

  // Optional auth: anonymous sockets are allowed (citizens), but a bad token is rejected outright.
  io.use((socket, next) => {
    socket.data.tracking = new Set();
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) return next();
    try {
      socket.data.user = verifyToken(token);
      next();
    } catch {
      next(new Error("unauthorized"));
    }
  });

  io.on("connection", (socket: AppSocket) => {
    const user = socket.data.user;
    if (user && STAFF.includes(user.role as Role)) void socket.join("staff");

    socket.on("track:subscribe", async (payload, ack) => {
      try {
        if (typeof payload?.trackingCode !== "string" || payload.trackingCode.length > 40)
          return ack?.({ ok: false, error: "Invalid tracking code" });
        if (socket.data.tracking.size >= MAX_TRACKED_PER_SOCKET)
          return ack?.({ ok: false, error: "Too many subscriptions" });
        const code = await trackingCodeExists(payload.trackingCode);
        if (!code) return ack?.({ ok: false, error: "Unknown tracking code" });
        socket.data.tracking.add(code);
        await socket.join(trackRoom(code));
        ack?.({ ok: true, trackingCode: code });
      } catch (err) {
        logger.error({ err }, "track:subscribe failed");
        ack?.({ ok: false, error: "Subscription failed" });
      }
    });

    socket.on("track:unsubscribe", (payload) => {
      const code = payload?.trackingCode?.toUpperCase();
      if (!code || !socket.data.tracking.has(code)) return;
      socket.data.tracking.delete(code);
      void socket.leave(trackRoom(code));
    });
  });

  // Domain events → sockets
  bus.on("incident:created", ({ incident }) => {
    io.to("staff").emit("incident:created", { incident });
  });
  bus.on("incident:updated", ({ incident, publicView, change, publicChange }) => {
    io.to("staff").emit("incident:updated", { incident, change });
    // Citizens never receive private notes, staff names or staff-only fields.
    io.to(trackRoom(incident.reference)).emit("incident:updated", {
      incident: publicView,
      change: publicChange,
    });
  });
  bus.on("incident:deleted", ({ id }) => {
    io.to("staff").emit("incident:deleted", { id });
  });

  return io;
}
