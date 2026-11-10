import { EventEmitter } from "node:events";
import type { ActivityDTO, IncidentDTO, PublicIncidentDTO } from "../domain/contract.js";

/**
 * In-process domain event bus. Services publish here after a transaction
 * commits; the Socket.io layer subscribes. Keeping services unaware of
 * Socket.io lets us swap in Redis pub/sub (or an outbox) for multi-instance
 * deployments without touching business logic.
 */
export interface IncidentEvents {
  "incident:created": [{ incident: IncidentDTO; publicView: PublicIncidentDTO }];
  "incident:updated": [
    {
      incident: IncidentDTO;
      publicView: PublicIncidentDTO;
      change: ActivityDTO | null;
      /** Redacted change for citizens; null when the change is staff-only. */
      publicChange: ActivityDTO | null;
    },
  ];
  "incident:deleted": [{ id: string; reference: string }];
}

class TypedBus extends EventEmitter<IncidentEvents> {}

export const bus = new TypedBus();
bus.setMaxListeners(50);
