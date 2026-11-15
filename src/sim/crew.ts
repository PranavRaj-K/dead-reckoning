/**
 * Team play for up to four people on one screen. Each role owns part of the
 * spacecraft and makes the call when its subsystem faults; with fewer players,
 * roles are shared round-robin so every role always has an owner.
 */
import type { DesignSlot, FaultId } from './types';

export interface Role {
  id: 'lead' | 'spacecraft' | 'comms' | 'science';
  name: string;
  owns: string;
  slots: DesignSlot[];
  fault: FaultId | null;
}

export const ROLES: Role[] = [
  { id: 'lead', name: 'Mission lead', owns: 'Objective, orbit, launch and risk posture', slots: [], fault: null },
  { id: 'spacecraft', name: 'Spacecraft engineer', owns: 'Structure, solar arrays and battery', slots: ['bus', 'power', 'battery'], fault: 'battery-degradation' },
  { id: 'comms', name: 'Communications', owns: 'Radio, antenna and backup beacon', slots: ['radio', 'antenna'], fault: 'radio-failure' },
  { id: 'science', name: 'Science & attitude', owns: 'Instrument and pointing', slots: ['instrument', 'adcs'], fault: 'adcs-degradation' },
];

export const MAX_CREW = 4;

/** Who holds a role: role i goes to player i mod crew size. */
export function ownerOf(crew: string[], role: Role): string {
  const index = ROLES.indexOf(role);
  return crew.length > 0 ? crew[index % crew.length] : '';
}

export const roleForSlot = (slot: DesignSlot): Role => ROLES.find((role) => role.slots.includes(slot)) ?? ROLES[0];
export const roleForFault = (fault: FaultId): Role => ROLES.find((role) => role.fault === fault) ?? ROLES[0];

/** Keeps 1–4 players, each with a non-empty display name. */
export function resizeCrew(crew: string[], size: number): string[] {
  const count = Math.min(MAX_CREW, Math.max(1, Math.round(size)));
  return Array.from({ length: count }, (_, i) => crew[i]?.trim() || `Player ${i + 1}`);
}
