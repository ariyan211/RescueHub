import type { Prisma, TeamAvailability, TeamCategory } from "@prisma/client";
import type { TeamDTO } from "../domain/contract.js";
import { toTeamDTO } from "../domain/mapper.js";
import { conflict, notFound } from "../lib/errors.js";
import { logger } from "../lib/logger.js";
import { prisma } from "../lib/prisma.js";
import { bus } from "../realtime/events.js";
import { isUniqueViolation, lockTeams } from "./workflowTx.js";

const withActive = { activeIncident: { select: { id: true } } } as const;

export interface TeamInput {
  name: string;
  category: TeamCategory;
  latitude: number;
  longitude: number;
  contactName: string;
  contactPhone: string;
  contactEmail?: string | null;
}

export async function publishTeams(ids: string[]) {
  const teams = await prisma.responseTeam.findMany({ where: { id: { in: ids } }, include: withActive });
  for (const team of teams) bus.emit("team:updated", { team: toTeamDTO(team), deleted: !!team.deletedAt });
}

export async function listTeams(filters: {
  q?: string;
  category?: TeamCategory[];
  availability?: TeamAvailability[];
}): Promise<TeamDTO[]> {
  const where: Prisma.ResponseTeamWhereInput = {
    deletedAt: null,
    ...(filters.category && { category: { in: filters.category } }),
    ...(filters.availability && { availability: { in: filters.availability } }),
    ...(filters.q && {
      OR: [
        { name: { contains: filters.q, mode: "insensitive" } },
        { code: { contains: filters.q, mode: "insensitive" } },
        { contactName: { contains: filters.q, mode: "insensitive" } },
        { contactPhone: { contains: filters.q } },
      ],
    }),
  };
  const teams = await prisma.responseTeam.findMany({ where, include: withActive, orderBy: { code: "asc" } });
  return teams.map(toTeamDTO);
}

export async function getTeam(id: string): Promise<TeamDTO> {
  const team = await prisma.responseTeam.findFirst({ where: { id, deletedAt: null }, include: withActive });
  if (!team) throw notFound("Response team not found");
  return toTeamDTO(team);
}

async function nextCode() {
  const rows = await prisma.$queryRaw<{ max: number | null }[]>`
    SELECT max((substring(code FROM 'TEAM-(\\d+)'))::int) AS max FROM "ResponseTeam"`;
  return `TEAM-${String((rows[0]?.max ?? 0) + 1).padStart(3, "0")}`;
}

export async function createTeam(input: TeamInput): Promise<TeamDTO> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const team = await prisma.responseTeam.create({
        data: { ...input, contactEmail: input.contactEmail || null, code: await nextCode() },
        include: withActive,
      });
      logger.info({ teamId: team.id, code: team.code }, "response team created");
      const dto = toTeamDTO(team);
      bus.emit("team:updated", { team: dto, deleted: false });
      return dto;
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
      const exists = await prisma.responseTeam.findFirst({ where: { name: input.name } });
      if (exists) throw conflict("Another team already uses this name.");
      // otherwise a concurrent create took the code: retry
    }
  }
  throw conflict("Could not allocate a team code. Try again.");
}

export async function updateTeam(id: string, input: TeamInput): Promise<TeamDTO> {
  try {
    const team = await prisma.$transaction(async (tx) => {
      await lockTeams(tx, [id]);
      const current = await tx.responseTeam.findFirst({ where: { id, deletedAt: null }, include: withActive });
      if (!current) throw notFound("Response team not found");
      return tx.responseTeam.update({
        where: { id },
        data: { ...input, contactEmail: input.contactEmail || null },
        include: withActive,
      });
    });
    const dto = toTeamDTO(team);
    bus.emit("team:updated", { team: dto, deleted: false });
    return dto;
  } catch (err) {
    if (isUniqueViolation(err)) throw conflict("Another team already uses this name.");
    throw err;
  }
}

/** Manual availability (e.g. off duty). A team on an incident becomes Available only by release. */
export async function setAvailability(id: string, availability: TeamAvailability): Promise<TeamDTO> {
  const team = await prisma.$transaction(async (tx) => {
    await lockTeams(tx, [id]);
    const current = await tx.responseTeam.findFirst({ where: { id, deletedAt: null }, include: withActive });
    if (!current) throw notFound("Response team not found");
    if (availability === "AVAILABLE" && current.activeIncident)
      throw conflict(`${current.name} is responding to an incident. Resolve or unassign it to make the team available.`);
    return tx.responseTeam.update({ where: { id }, data: { availability }, include: withActive });
  });
  const dto = toTeamDTO(team);
  bus.emit("team:updated", { team: dto, deleted: false });
  return dto;
}

/** Soft delete so assignment history keeps its foreign keys; frees the name for reuse. */
export async function deleteTeam(id: string): Promise<void> {
  const team = await prisma.$transaction(async (tx) => {
    await lockTeams(tx, [id]);
    const current = await tx.responseTeam.findFirst({ where: { id, deletedAt: null }, include: withActive });
    if (!current) throw notFound("Response team not found");
    if (current.activeIncident)
      throw conflict(`${current.name} is assigned to an active incident. Resolve or unassign it before deleting the team.`);
    return tx.responseTeam.update({
      where: { id },
      data: { deletedAt: new Date(), availability: "BUSY", name: `${current.name} (deleted ${current.code})`.slice(0, 80) },
      include: withActive,
    });
  });
  bus.emit("team:updated", { team: toTeamDTO(team), deleted: true });
}
