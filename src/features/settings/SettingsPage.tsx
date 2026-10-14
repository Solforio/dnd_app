import { useEffect, useId, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { resetFoldState } from '../../components/foldStorage';
import { clearImages, imageUsage } from '../../data/imageStore';
import { requestSignOut, useSession } from '../../data/session';
import { useSettings } from '../../data/settingsStore';
import { useSpellDialog } from '../../data/spellDialog';
import { useTheme, type Theme } from '../../data/themePref';
import { formatNumber } from '../../domain/format/number';
import { DENSITIES, DENSITY_LABELS, TEXT_SIZE_LABELS, TEXT_SIZES, vibrationPattern, type Density, type TextSize } from '../../domain/settings';
import { SyncBadge } from '../account/SyncBadge';

/** A radio group drawn as a row of buttons. */
function Segmented<T extends string>({ legend, value, options, onChange }: { legend: string; value: T; options: readonly { id: T; label: string }[]; onChange: (v: T) => void }) {
  const name = useId();
  return (
    <fieldset className="plain">
      <legend className="visually-hidden">{legend}</legend>
      <div className="segmented">
        {options.map((o) => (
          <label key={o.id}>
            <input type="radio" name={name} checked={value === o.id} onChange={() => onChange(o.id)} />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function Row({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <div className="setting-row">
      <div>
        <strong>{title}</strong>
        {hint && <p className="small muted">{hint}</p>}
      </div>
      <div className="setting-control">{children}</div>
    </div>
  );
}

const megabytes = (bytes: number) => `${formatNumber(Math.round((bytes / 1_048_576) * 10) / 10, 1)} MB`;

/** What this browser keeps for the app, and what can be done about it. */
function StorageSection() {
  const [usage, setUsage] = useState<{ count: number; bytes: number } | null>(null);
  const [total, setTotal] = useState<{ used: number; quota: number } | null>(null);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [message, setMessage] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);

  const refresh = async () => {
    setUsage(await imageUsage());
    try {
      const e = await navigator.storage?.estimate?.();
      setTotal(e?.usage !== undefined && e.quota !== undefined ? { used: e.usage, quota: e.quota } : null);
      setPersisted((await navigator.storage?.persisted?.()) ?? null);
    } catch {
      setTotal(null);
    }
  };

  useEffect(() => {
    void imageUsage().then(setUsage);
    void (async () => {
      try {
        const e = await navigator.storage?.estimate?.();
        setTotal(e?.usage !== undefined && e.quota !== undefined ? { used: e.usage, quota: e.quota } : null);
        setPersisted((await navigator.storage?.persisted?.()) ?? null);
      } catch {
        setTotal(null);
      }
    })();
  }, []);

  return (
    <section className="card stack" aria-labelledby="set-data">
      <h2 id="set-data">Dati e spazio</h2>
      <Row title="Spazio usato" hint="Quello che il browser tiene per l’app: personaggi, immagini delle mappe, ritratti.">
        <span>{total ? `${megabytes(total.used)} su ${megabytes(total.quota)}` : 'Non disponibile in questo browser'}</span>
      </Row>
      <Row title="Immagini delle mappe" hint="Restano su questo dispositivo; se le hai salvate nel tuo account si riscaricano da sole.">
        <span>{usage ? `${formatNumber(usage.count)} ${usage.count === 1 ? 'immagine' : 'immagini'}, ${megabytes(usage.bytes)}` : '…'}</span>
      </Row>
      <Row
        title="Proteggi i dati dallo sfratto"
        hint="I browser possono cancellare i dati dei siti quando lo spazio scarseggia (o dopo molti giorni senza usarli, su iPhone). Chiedere la protezione evita di perdere mappe e personaggi locali."
      >
        {persisted === true ? (
          <span className="result-tag crit">Protetti</span>
        ) : (
          <button
            type="button"
            disabled={typeof navigator.storage?.persist !== 'function'}
            onClick={async () => {
              const ok = await navigator.storage.persist();
              setPersisted(ok);
              setMessage(ok ? 'Dati protetti.' : 'Il browser non ha accettato: prova dopo aver installato l’app o usato di più il sito.');
            }}
          >
            Proteggi
          </button>
        )}
      </Row>
      <Row title="Schede richiudibili" hint="Torna all’aperto o chiuso di partenza per tutte.">
        <button type="button" onClick={() => setMessage(`Ripristinate ${resetFoldState()} schede: tornano come all’inizio quando riapri le pagine.`)}>
          Ripristina
        </button>
      </Row>
      <Row title="Cancella le immagini delle mappe" hint="Le toglie solo da questo dispositivo. Le mappe e i segnalini restano.">
        {confirmClear ? (
          <span className="row" role="group" aria-label="Conferma">
            <button
              type="button"
              className="danger"
              onClick={async () => {
                await clearImages();
                setConfirmClear(false);
                setMessage('Immagini cancellate da questo dispositivo.');
                void refresh();
              }}
            >
              Sì, cancella
            </button>
            <button type="button" onClick={() => setConfirmClear(false)}>
              Annulla
            </button>
          </span>
        ) : (
          <button type="button" disabled={!usage || usage.count === 0} onClick={() => setConfirmClear(true)}>
            Cancella
          </button>
        )}
      </Row>
      <Row title="Backup dei personaggi" hint="Esporta e importa i personaggi come file.">
        <Link className="button-link" to="/personaggi">
          Apri Personaggi
        </Link>
      </Row>
      <p className="status-line small" role="status" aria-live="polite">
        {message}
      </p>
    </section>
  );
}

function AccountSection() {
  const phase = useSession((s) => s.phase);
  const user = useSession((s) => s.user);
  const [message, setMessage] = useState('');
  return (
    <section className="card stack" aria-labelledby="set-account">
      <h2 id="set-account">Account</h2>
      {phase === 'cloud' && user ? (
        <Row title={`Sei dentro come ${user.username}`} hint="Personaggi, mappe e gruppi sono salvati nel tuo account.">
          <span className="row">
            <SyncBadge />
            <button
              type="button"
              onClick={async () => {
                const r = await requestSignOut(false);
                setMessage(r === 'unsynced' ? 'Sei offline con modifiche non ancora salvate: esci dalla barra in alto per confermare.' : '');
              }}
            >
              Esci
            </button>
          </span>
        </Row>
      ) : (
        <Row title="Stai usando l’app senza account" hint="I dati restano su questo dispositivo. Con un account li ritrovi su tutti i dispositivi e puoi entrare nei gruppi.">
          <Link className="button-link" to="/accedi">
            Accedi o registrati
          </Link>
        </Row>
      )}
      <p className="status-line small" role="status" aria-live="polite">
        {message}
      </p>
    </section>
  );
}

/** The preferences of this device, and the credits and licences of what the app contains. */
export function SettingsPage() {
  const { settings, update, reset } = useSettings();
  const theme = useTheme((s) => s.theme);
  const setTheme = useTheme((s) => s.set);
  const spellPopup = useSpellDialog((s) => s.autoOpen);
  const setSpellPopup = useSpellDialog((s) => s.setAutoOpen);
  const canVibrate = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
  const [message, setMessage] = useState('');

  return (
    <main className="app-main single settings-page">
      <section className="card stack" aria-labelledby="set-look">
        <h2 id="set-look">Aspetto</h2>
        <Row title="Tema" hint="Notte è scuro, Pergamena è chiaro.">
          <Segmented<Theme>
            legend="Tema"
            value={theme}
            options={[
              { id: 'night', label: 'Notte' },
              { id: 'parchment', label: 'Pergamena' },
            ]}
            onChange={setTheme}
          />
        </Row>
        <Row title="Dimensione del testo" hint="Ingrandisce o rimpicciolisce tutta l’app.">
          <Segmented<TextSize> legend="Dimensione del testo" value={settings.textSize} options={TEXT_SIZES.map((id) => ({ id, label: TEXT_SIZE_LABELS[id] }))} onChange={(textSize) => update({ textSize })} />
        </Row>
        <Row title="Densità" hint="Compatta riduce gli spazi: più cose nello schermo, meno scorrimento.">
          <Segmented<Density> legend="Densità" value={settings.density} options={DENSITIES.map((id) => ({ id, label: DENSITY_LABELS[id] }))} onChange={(density) => update({ density })} />
        </Row>
        <Row title="Decorazioni delle cornici" hint="Angoli dorati, grana della carta, rombi e filetti. Spegnile per un aspetto più sobrio.">
          <label className="inline">
            <input type="checkbox" checked={settings.ornaments} onChange={(e) => update({ ornaments: e.target.checked })} />
            {settings.ornaments ? 'Accese' : 'Spente'}
          </label>
        </Row>
      </section>

      <section className="card stack" aria-labelledby="set-dice">
        <h2 id="set-dice">Dadi</h2>
        <Row title="Vibrazione al tiro" hint={canVibrate ? 'Un breve impulso a ogni tiro: più lungo con un fallimento critico, a più colpi con un critico.' : 'Questo dispositivo non supporta la vibrazione.'}>
          <span className="row">
            <label className="inline">
              <input type="checkbox" checked={settings.vibration} disabled={!canVibrate} onChange={(e) => update({ vibration: e.target.checked })} />
              {settings.vibration ? 'Accesa' : 'Spenta'}
            </label>
            <button type="button" disabled={!canVibrate} onClick={() => navigator.vibrate(vibrationPattern({ crit: true, fumble: false }))}>
              Prova
            </button>
          </span>
        </Row>
      </section>

      <section className="card stack" aria-labelledby="set-spells">
        <h2 id="set-spells">Incantesimi</h2>
        <Row title="Descrizione dopo il lancio" hint="Apre da sola la finestra con l’effetto dell’incantesimo ogni volta che ne lanci uno. Altrimenti compare un avviso con «Leggi».">
          <label className="inline">
            <input type="checkbox" checked={spellPopup} onChange={(e) => setSpellPopup(e.target.checked)} />
            {spellPopup ? 'Apri sempre' : 'Solo se la chiedo'}
          </label>
        </Row>
      </section>

      <StorageSection />
      <AccountSection />

      <section className="card stack" aria-labelledby="set-reset">
        <h2 id="set-reset">Ripristino</h2>
        <Row title="Impostazioni di questo dispositivo" hint="Tema, dimensione del testo, densità, decorazioni, vibrazione e finestra degli incantesimi tornano come all’inizio. I personaggi non cambiano.">
          <button
            type="button"
            onClick={() => {
              reset();
              setTheme('night');
              setSpellPopup(false);
              setMessage('Impostazioni ripristinate.');
            }}
          >
            Ripristina
          </button>
        </Row>
        <p className="status-line small" role="status" aria-live="polite">
          {message}
        </p>
      </section>

      <section className="card stack" aria-labelledby="set-about">
        <h2 id="set-about">Informazioni e licenze</h2>
        <p className="small">
          Compagno D&amp;D è un’app non ufficiale, fatta da fan: non è affiliata né approvata da Wizards of the Coast. Le immagini delle mappe
          che carichi restano tue: non vengono pubblicate.
        </p>
        <p className="small">
          Questo lavoro include materiale tratto dal System Reference Document 5.1 («SRD 5.1») di Wizards of the Coast LLC, disponibile su{' '}
          <a href="https://dnd.wizards.com/resources/systems-reference-document" target="_blank" rel="noreferrer">
            dnd.wizards.com
          </a>
          . L’SRD 5.1 è distribuito con licenza{' '}
          <a href="https://creativecommons.org/licenses/by/4.0/legalcode" target="_blank" rel="noreferrer">
            Creative Commons Attribution 4.0
          </a>
          . Lo usiamo per condizioni, incantesimi e mostri (testi in inglese).
        </p>
        <p className="small muted">
          I dati degli incantesimi e dei mostri vengono dal database{' '}
          <a href="https://github.com/5e-bits/5e-database" target="_blank" rel="noreferrer">
            5e-bits
          </a>{' '}
          (licenza MIT). I caratteri Cinzel e Cinzel Decorative sono di The Cinzel Project Authors, con licenza SIL Open Font 1.1.
        </p>
        <p className="small muted">
          Codice dell’app:{' '}
          <a href="https://github.com/Solforio/dnd_app" target="_blank" rel="noreferrer">
            github.com/Solforio/dnd_app
          </a>
          .
        </p>
      </section>
    </main>
  );
}
