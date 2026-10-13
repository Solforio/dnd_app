# Compagno D&D

App web gratuita per giocatori di D&D 5e: dadi, punti ferita, scheda, zaino, note, bestiario, mappe e gruppo condiviso.
Il brief completo è in `cowork-prompt-dnd-app.md`, lo stato del lavoro in `PROGRESS.md`.

## Requisiti

- Node.js 24 (o almeno 20.19) e npm
- Java 21, solo per gli emulatori Firebase: `winget install EclipseAdoptium.Temurin.21.JDK`

## Comandi

```sh
npm install        # una volta, installa le dipendenze
npm run dev        # avvia l'app in locale: apri l'indirizzo che stampa (di solito http://localhost:5173)
npm test           # test della logica (dadi, PF, schema dei dati)
npm run typecheck  # controllo dei tipi
npm run lint       # controllo dello stile del codice
npm run build      # build di produzione in dist/
npm run preview    # serve la build di dist/ in locale
```

### Con gli emulatori Firebase (account e salvataggio senza toccare il progetto vero)

```sh
npm run emulators  # terminale 1: Auth e Firestore in locale, interfaccia su http://localhost:4000
npm run dev:emu    # terminale 2: l'app collegata agli emulatori
npm run test:rules # test delle regole di sicurezza (avvia e chiude da solo l'emulatore)
```

Gli emulatori usano il progetto `demo-dnd`: un id che inizia con "demo-" non raggiunge mai i server veri.

Per provare la build esattamente come su GitHub Pages (servita sotto `/<nome-repo>/`):

```sh
VITE_BASE=/nome-repo/ npm run build && npm run preview
```

In PowerShell: `$env:VITE_BASE='/nome-repo/'; npm run build; npm run preview`.

## Pubblicazione su GitHub Pages

1. Crea un repository vuoto su GitHub (ad esempio `dnd-companion`), senza README.
2. Collega e carica il codice:
   ```sh
   git remote add origin https://github.com/<utente>/dnd-companion.git
   git push -u origin main
   ```
3. Su GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
4. Ad ogni push su `main` il workflow `.github/workflows/deploy.yml` esegue test e build e pubblica l'app su
   `https://<utente>.github.io/dnd-companion/`. Lo stato è nella scheda **Actions**.

Il percorso di base viene preso automaticamente dal nome del repository: se lo rinomini non serve cambiare nulla.

## Struttura

```
src/
  domain/      TypeScript puro e testato: dadi, PF, scheda, schema e migrazioni, formattazione dei numeri
  data/        store dell’app, Firebase e salvataggio (browser o account)
  features/    componenti React per area: dice/, hp/, character/, sheet/, inventory/, party/, account/
  components/  componenti condivisi
  styles/      token di design e stile globale
```

`domain/` non importa React né Firebase: la regola ESLint lo impedisce.
