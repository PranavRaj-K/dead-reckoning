import { describe, expect, it } from 'vitest';
import { ROLES, ownerOf, resizeCrew, roleForFault, roleForSlot } from '../sim/crew';
import { SLOT_ORDER } from '../sim/catalogue';

describe('crew roles', () => {
  it('gives every role an owner for any crew size from 1 to 4', () => {
    for (let size = 1; size <= 4; size += 1) {
      const crew = resizeCrew([], size);
      expect(crew).toHaveLength(size);
      for (const role of ROLES) expect(crew).toContain(ownerOf(crew, role));
    }
    expect(new Set(ROLES.map((role) => ownerOf(resizeCrew([], 4), role))).size).toBe(4);
  });

  it('clamps the crew to 1–4 and keeps names', () => {
    expect(resizeCrew(['Ada'], 9)).toEqual(['Ada', 'Player 2', 'Player 3', 'Player 4']);
    expect(resizeCrew(['Ada', 'Bo'], 0)).toEqual(['Ada']);
    expect(resizeCrew(['  '], 1)).toEqual(['Player 1']);
  });

  it('maps every part slot and every fault to exactly one role', () => {
    for (const slot of SLOT_ORDER) expect(ROLES.filter((role) => role.slots.includes(slot))).toHaveLength(1);
    expect(roleForSlot('radio').id).toBe('comms');
    expect(roleForFault('battery-degradation').id).toBe('spacecraft');
    expect(roleForFault('adcs-degradation').id).toBe('science');
  });
});
