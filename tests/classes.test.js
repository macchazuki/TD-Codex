import {describe, expect, it} from 'vitest';
import {ENGINEER_PERKS, GAME_CLASSES, MAX_SELECTED_PERKS, togglePerk, validateSelection} from '../src/game/classes.js';

describe('class and perk selection', () => {
  it('exposes only The Engineer', () => {
    expect(GAME_CLASSES.map(({name}) => name)).toEqual(['The Engineer']);
  });

  it('exposes two initially unselected perks', () => {
    expect(ENGINEER_PERKS).toHaveLength(2);
    expect(validateSelection({classKey: 'engineer', perkKeys: []})).toEqual({ok: true});
  });

  it('toggles perks independently', () => {
    expect(togglePerk([], 'tower-upgrades').perkKeys).toEqual(['tower-upgrades']);
    expect(togglePerk(['tower-upgrades'], 'gold-interest').perkKeys).toEqual(['tower-upgrades', 'gold-interest']);
    expect(togglePerk(['tower-upgrades', 'gold-interest'], 'tower-upgrades').perkKeys).toEqual(['gold-interest']);
  });

  it('enforces the reusable maximum selection rule', () => {
    expect(MAX_SELECTED_PERKS).toBe(5);
    expect(validateSelection({classKey: 'engineer', perkKeys: ['tower-upgrades', 'gold-interest', 'tower-upgrades']})).toMatchObject({ok: false, reason: 'duplicate-perk'});
  });

  it('rejects unknown class and perk keys', () => {
    expect(validateSelection({classKey: 'unknown', perkKeys: []})).toMatchObject({ok: false, reason: 'unknown-class'});
    expect(validateSelection({classKey: 'engineer', perkKeys: ['unknown']})).toMatchObject({ok: false, reason: 'unknown-perk'});
  });
});
