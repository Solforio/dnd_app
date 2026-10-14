import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { closeParty, deleteParty, forgetParty, openParty, usePartyStore } from '../../data/partyStore';
import { useSession } from '../../data/session';
import { MemberCards } from './MemberCards';
import { MySharing } from './MySharing';
import { PartiesPage } from './PartiesPage';
import { PartyGlance } from './PartyGlance';
import { PartyHeader } from './PartyHeader';
import { QuestBoard } from './QuestBoard';
import { SessionLog } from './SessionLog';

function DeleteParty({ name, onDeleted }: { name: string; onDeleted: () => void }) {
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <section className="card stack" aria-labelledby="danger-title">
      <h2 id="danger-title">Elimina il gruppo</h2>
      {confirm ? (
        <div className="row" role="group" aria-label="Conferma eliminazione del gruppo">
          <span className="small">
            Eliminare «{name}» per tutti? Missioni, diario e membri spariscono e non si possono recuperare. I personaggi restano.
          </span>
          <button
            type="button"
            className="danger"
            disabled={busy}
            autoFocus
            onClick={async () => {
              setBusy(true);
              const err = await deleteParty();
              setBusy(false);
              if (err) setError(err);
              else onDeleted();
            }}
          >
            {busy ? 'Elimino…' : 'Sì, elimina il gruppo'}
          </button>
          <button type="button" onClick={() => setConfirm(false)}>
            Annulla
          </button>
        </div>
      ) : (
        <div>
          <button type="button" className="danger" onClick={() => setConfirm(true)}>
            Elimina il gruppo
          </button>
        </div>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

/** The shared group screen. Listeners live only while this page is mounted. */
export function PartyPage() {
  const { partyId = '' } = useParams();
  const phase = useSession((s) => s.phase);
  const user = useSession((s) => s.user);
  const status = usePartyStore((s) => s.status);
  const party = usePartyStore((s) => s.party);
  const members = usePartyStore((s) => s.members);
  const membership = usePartyStore((s) => s.memberships?.find((m) => m.partyId === partyId));
  const navigate = useNavigate();

  useEffect(() => {
    if (phase !== 'cloud') return;
    openParty(partyId);
    return closeParty;
  }, [partyId, phase]);

  if (phase !== 'cloud' || !user) return <PartiesPage />;

  const back = () => navigate('/gruppo');

  if (status === 'gone') {
    return (
      <main className="app-main single">
        <section className="card stack">
          <h2>Gruppo non disponibile</h2>
          <p>Non fai più parte di questo gruppo, oppure il DM l’ha eliminato.</p>
          <div className="row">
            <button
              type="button"
              className="primary"
              onClick={async () => {
                await forgetParty(partyId);
                back();
              }}
            >
              Togli dai miei gruppi
            </button>
            <Link to="/gruppo">Torna ai gruppi</Link>
          </div>
        </section>
      </main>
    );
  }

  if (!party) {
    return (
      <main className="app-main single">
        <p className="muted" role="status">
          Apro il gruppo…
        </p>
      </main>
    );
  }

  const isDm = party.ownerUid === user.uid;

  return (
    <main className="app-main sheet">
      <nav className="span-all small" aria-label="Percorso">
        <Link to="/gruppo">← I miei gruppi</Link>
      </nav>
      <PartyHeader party={party} isDm={isDm} />
      <MemberCards pid={party.id} members={members} myUid={user.uid} isDm={isDm} />
      <div className="column">
        <QuestBoard isDm={isDm} />
        <SessionLog myUid={user.uid} isDm={isDm} />
      </div>
      <div className="column">
        <PartyGlance members={members} />
        {membership && <MySharing membership={membership} isDm={isDm} onLeft={back} />}
        {isDm && <DeleteParty name={party.name} onDeleted={back} />}
      </div>
    </main>
  );
}
