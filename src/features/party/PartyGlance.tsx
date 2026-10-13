import { formatNumber } from '../../domain/format/number';
import { partyGlance, type Member } from '../../domain/party';
import { SKILL_INFO, type SkillId } from '../../domain/sheet/rules';

const skillNames = (ids: SkillId[]) => ids.map((k) => SKILL_INFO[k].label).sort((a, b) => a.localeCompare(b, 'it')).join(', ');

/** Computed from the member cards on this device: no extra reads or writes. */
export function PartyGlance({ members }: { members: Member[] }) {
  const g = partyGlance(members);
  const n = members.length;
  const basedOn = (k: number) => (k < n ? ` (in base a ${formatNumber(k)} su ${formatNumber(n)})` : '');

  return (
    <section className="card stack" aria-labelledby="glance-title">
      <h2 id="glance-title">Il gruppo in breve</h2>
      <dl className="traits">
        <dt>Livello medio</dt>
        <dd>{formatNumber(g.averageLevel, 1)}</dd>
        <dt>Miglior Percezione passiva</dt>
        <dd>
          {g.bestPerception ? `${formatNumber(g.bestPerception.value)} (${g.bestPerception.names.join(', ')})${basedOn(g.sharing.perception)}` : 'nessuno la condivide'}
        </dd>
        <dt>Lingue</dt>
        <dd>{g.sharing.languages ? `${g.languages.join(', ') || '—'}${basedOn(g.sharing.languages)}` : 'nessuno le condivide'}</dd>
        <dt>Scurovisione</dt>
        <dd>
          {g.sharing.darkvision ? `${g.darkvision.join(', ') || 'nessuno'}${basedOn(g.sharing.darkvision)}` : 'nessuno la condivide'}
        </dd>
        <dt>Abilità coperte</dt>
        <dd>{g.skills ? `${skillNames(g.skills.covered) || 'nessuna'}${basedOn(g.sharing.skills)}` : 'nessuno le condivide'}</dd>
        {g.skills && g.skills.missing.length > 0 && (
          <>
            <dt>Abilità scoperte</dt>
            <dd className="red">{skillNames(g.skills.missing)}</dd>
          </>
        )}
      </dl>
      <p className="small muted">Ognuno sceglie cosa condividere in «La mia scheda nel gruppo».</p>
    </section>
  );
}
