import { useState } from 'react';
import { removeMember, transferOwnership } from '../../data/partyStore';
import { formatNumber } from '../../domain/format/number';
import type { Member, MemberSummary } from '../../domain/party';
import { CONDITION_LABELS } from '../../domain/sheet/rules';
import { MemberAvatar } from './MemberAvatar';

function HpLine({ s }: { s: MemberSummary }) {
  if (s.hpMax !== undefined && s.hpCur !== undefined) {
    const temp = s.hpTemp ?? 0;
    const scale = s.hpMax + temp;
    return (
      <div className="stack-tight">
        <div className="hp-bar" role="meter" aria-label="PF" aria-valuemin={0} aria-valuemax={s.hpMax} aria-valuenow={s.hpCur}>
          <span className={`cur${s.hpCur <= s.hpMax / 4 ? ' low' : ''}`} style={{ width: `${(s.hpCur / scale) * 100}%` }} />
          <span className="temp" style={{ width: `${(temp / scale) * 100}%` }} />
        </div>
        <span className="small">
          PF {formatNumber(s.hpCur)}/{formatNumber(s.hpMax)}
          {temp > 0 && <span className="muted"> +{formatNumber(temp)}</span>}
          {s.hpStatus && <span className="muted"> · {s.hpStatus}</span>}
        </span>
      </div>
    );
  }
  if (s.hpStatus) return <span className={`hp-status ${s.hpStatus.replace(/ /g, '-')}`}>{s.hpStatus}</span>;
  return null;
}

function Card({ pid, m, me, isDm }: { pid: string; m: Member; me: boolean; isDm: boolean }) {
  const s = m.summary;
  const [confirm, setConfirm] = useState<'remove' | 'transfer' | null>(null);
  const [message, setMessage] = useState('');
  const down = s.hpStatus === 'a terra' || s.hpStatus === 'morto' || s.hpCur === 0;

  const stats = [
    s.ac !== undefined && `CA ${formatNumber(s.ac)}`,
    s.passivePerception !== undefined && `Perc. passiva ${formatNumber(s.passivePerception)}`,
    s.darkvision !== undefined && s.darkvision > 0 && `Scurovisione ${formatNumber(s.darkvision, 1)} m`,
  ].filter(Boolean);

  return (
    <li className={`member-card${me ? ' me' : ''}`}>
      <div className="member-head">
        <MemberAvatar pid={pid} uid={m.uid} at={s.portraitAt} name={s.characterName} size={48} />
        <div className="stack-tight">
          <div className="attack-name">
            <span className="character-name">{s.characterName}</span>
            {m.role === 'dm' && <span className="result-tag crit">DM</span>}
            {s.inspiration && <span className="result-tag crit">Ispirazione</span>}
          </div>
          <span className="small muted">
            {s.class} · {m.username}
            {me && ' (tu)'}
          </span>
        </div>
      </div>
      <HpLine s={s} />
      {stats.length > 0 && <span className="small">{stats.join(' · ')}</span>}
      {down && s.deathSaves && (
        <span className="small">
          Tiri contro morte: {formatNumber(s.deathSaves.successes)} successi, {formatNumber(s.deathSaves.failures)} fallimenti
        </span>
      )}
      {(s.conditions?.length || s.exhaustion) ? (
        <div className="chips">
          {s.conditions?.map((c) => (
            <span key={c} className="chip on static">
              {CONDITION_LABELS[c]}
            </span>
          ))}
          {!!s.exhaustion && <span className="chip on static">Indebolimento {formatNumber(s.exhaustion)}</span>}
        </div>
      ) : null}

      {isDm && !me && (
        <div className="row">
          {confirm ? (
            <div className="row" role="group" aria-label="Conferma">
              <span className="small">
                {confirm === 'remove'
                  ? `Togliere ${m.username} dal gruppo?`
                  : `Passare il ruolo di DM a ${m.username}? Tu diventi un giocatore.`}
              </span>
              <button
                type="button"
                className={confirm === 'remove' ? 'danger' : 'primary'}
                autoFocus
                onClick={async () => {
                  const err = confirm === 'remove' ? await removeMember(m.uid) : await transferOwnership(m.uid);
                  setConfirm(null);
                  setMessage(err ?? '');
                }}
              >
                Sì
              </button>
              <button type="button" onClick={() => setConfirm(null)}>
                Annulla
              </button>
            </div>
          ) : (
            <>
              <button type="button" className="ghost" onClick={() => setConfirm('transfer')}>
                Rendi DM<span className="visually-hidden"> {m.username}</span>
              </button>
              <button type="button" className="ghost danger-text" onClick={() => setConfirm('remove')}>
                Rimuovi<span className="visually-hidden"> {m.username}</span>
              </button>
            </>
          )}
        </div>
      )}
      {message && (
        <p className="error" role="alert">
          {message}
        </p>
      )}
    </li>
  );
}

export function MemberCards({ pid, members, myUid, isDm }: { pid: string; members: Member[]; myUid: string; isDm: boolean }) {
  return (
    <section className="card stack span-all" aria-labelledby="members-title">
      <h2 id="members-title">Membri</h2>
      <ul className="member-grid">
        {members.map((m) => (
          <Card key={m.uid} pid={pid} m={m} me={m.uid === myUid} isDm={isDm} />
        ))}
      </ul>
    </section>
  );
}
