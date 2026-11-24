// "Is the package there" (REVIEW_2026-11-24 S3; docs/SYNERGIES.md "Which packages a list has, and when one is there"):
// the partner rule is one function now (partnerRolesOf), shared by the bots' and coach's package facts
// (src/ai/packages.ts) and the tuners' partner split (src/lib/cutRanking.ts); the synergy report keeps its own copy,
// which reads no `needs`. Unifying them moved no output: the three rules agree on every catalogue package and role.
import { describe, expect, it } from 'vitest';
import { partnerRolesOf, roleMap, roleMatches, SYNERGIES, type SynergyRole } from '../src/content/synergies';

const ROLES: SynergyRole[] = ['enabler', 'payoff', 'both', 'piece'];

/** The report's rule (src/analysis/synergies.ts partnerAt) and the cut ranking's before 2026-11-24, as written there. */
const reportRule = (role: SynergyRole, r: SynergyRole) => (role === 'enabler' ? roleMatches(r, ['payoff']) : role === 'payoff' ? roleMatches(r, ['enabler']) : true);
/** src/ai/packages.ts partnerRoles before 2026-11-24. */
function packagesRule(role: SynergyRole, needs: { enabler?: number; payoff?: number }): SynergyRole[] {
  const split = (needs.enabler ?? 0) > 0 || (needs.payoff ?? 0) > 0;
  if (!split || role === 'piece' || role === 'both') return ['enabler', 'payoff', 'both', 'piece'];
  return role === 'enabler' ? ['payoff', 'both'] : ['enabler', 'both'];
}

describe('one partner rule', () => {
  it.each(SYNERGIES.map((s) => [s.id, s] as const))('%s: every rule gives every member role the same partners', (_id, s) => {
    const roles = new Set(roleMap(s).values());
    for (const role of roles) {
      const shared = partnerRolesOf(role, s.needs);
      expect(shared).toEqual(packagesRule(role, s.needs));
      for (const r of ROLES) expect(shared.includes(r), `${role} ↔ ${r}`).toBe(reportRule(role, r));
    }
  });

  it('the rules differ only for a package that names no sides and has enablers or payoffs (none in the catalogue)', () => {
    expect(partnerRolesOf('enabler', { any: 2 })).toEqual(['enabler', 'payoff', 'both', 'piece']);
    expect(ROLES.filter((r) => reportRule('enabler', r))).toEqual(['payoff', 'both']);
    expect(SYNERGIES.filter((s) => !(s.needs.enabler || s.needs.payoff) && [...roleMap(s).values()].some((r) => r === 'enabler' || r === 'payoff'))).toEqual([]);
  });
});
