# PROGRESS

Read this file first, together with `cowork-prompt-dnd-app.md` (the brief). It is the project memory.

## Status

| Phase | State |
|---|---|
| 0: scaffold + module 1 (dice, HP, history) | **done**, published at https://solforio.github.io/dnd_app/ (repo Solforio/dnd_app) |
| 1: accounts and cloud save | **done**, live on Firebase project `dungeons-9446d` (Spark); confirmed working by the user |
| 2: character sheet and multiple characters | **done** (2026-10-13) |
| 3: parties | **done** (2026-10-13); rules (35 tests) deployed to `dungeons-9446d`; two-browser emulator check passes |
| 4: inventory and weight | **done** (2026-10-13) |
| maps (built before 5 to 7, user request) | **done** (2026-10-14); rules (45 tests) deployed; two-user emulator check passes |
| 5+: notes, codex, PWA | not started |
| ideas I1 to I7 (see "Ideas") | registered 2026-10-14; I2, I3 and I4 done, rest not started |

## Phase 0: what exists

- Vite 8 + React 19 + TypeScript 6 (strict, `noUncheckedIndexedAccess`), Zustand 5, Vitest 5, ESLint 10.
- `src/domain/dice`: parser (`parseFormula`), engine (`rollFormula`, injectable `DieRoller`), RNG (`cryptoDie`: `crypto.getRandomValues` with rejection sampling). ESLint forbids `Math.random`.
- `src/domain/hp`: damage, healing, temporary HP, long rest, direct edits, death saves; every rule returns `{ vitals, message }`, where the message is the Italian status line.
- `src/domain/character.ts`: `Character` type, `loadCharacter` (migrate, then sanitize), history cap, JSON export/import.
- `src/domain/schema`: `runMigrations` and sanitizing helpers. `src/domain/format/number.ts`: the only number formatter.
- `src/data/localStore.ts` + `characterStore.ts`: Zustand store, localStorage with a 400 ms debounce, flushed on `visibilitychange`/`pagehide`.
- UI: big SVG d20, mode selector, dice tray, free formula, presets, history, HP panel, death saves, export/import.
- `.github/workflows/deploy.yml`: typecheck, lint, test and build, then deploy to Pages. `VITE_BASE` comes from the repository name.

## Decisions (and why)

- **Presets belong to the character**: "Spada lunga d20+7" only makes sense for one character. Each new character gets the three example presets.
- **History** lives in the character document, newest first, capped at 100.
- **Character shape v1**: `{ schemaVersion: 1, id, name, hp {cur,max,temp}, deathSaves {successes,failures}, rollMode, presets[], history[], updatedAt }`.
- **Migrations**: `characterMigrations[n]` upgrades vN to vN+1. A document with no version counts as v1. Newer-than-known documents are refused, and in localStorage they are kept untouched (`unreadable`) rather than overwritten. Every source (localStorage, import, later Firestore) goes through `loadCharacter`.
- **localStorage envelope**: key `dnd-companion:local`, `{ schemaVersion: 1, activeCharacterId, characters[] }`. Already multi-character, ready for Phase 2.
- **Import** of a character with a different id does not discard the current one: it stays in storage (`others`), to be reached from the Phase 2 picker.
- **Number format**: es-ES with a comma for decimals; thousands are always grouped with a period, four-digit numbers included (`1.250`). The grouping is done by hand in `formatNumber`, so every browser gives the same result. Negative numbers use the real minus sign (`−`).
- **d20 mode**: stored per character (`rollMode`). Death-save rolls always use a plain d20, ignoring the selector.
- **HP rules beyond the brief**: damage at 0 HP to a *stable* character resets the successes and adds one failure (no longer stable). Healing a dead character does nothing (the message says to clear the failures by hand). Raising current HP above 0 by a direct edit resets the death saves.
- **Router**: `HashRouter` (react-router) is postponed until there is a second screen (Phase 1), to avoid a dependency with no use yet.
- **Inventory (Phase 4, agreed with the user)**: weights are **always stored in pounds**; the UI shows and edits in kg or lb, kg by default, using the Italian Player's Handbook conversion **1 lb = 0.5 kg**. Capacity = STR × an editable coefficient (`capacityPerStrLb`, default 15, range 1 to 50, step 0.5, "Ripristina 15 lb" button), shown in the chosen unit (15 lb = 7.5 kg). The variant encumbrance thresholds are 1/3 and 2/3 of the capacity. Built in Phase 4 (see below).

## Phase 1: what exists

- `src/domain/account.ts`: username rules (3 to 20 chars, a-z 0-9 _ -, lowercased), synthetic email `<username>@dnd.local`, `UserDoc`.
- `src/domain/sync.ts`: `deriveSyncStatus`, `planUpload` (fresh / identical / conflicts), `isUntouchedDefault`, `createDebouncedWriter`.
- `src/data/firebase.ts` (+ `firebaseConfig.ts`: web config of `dungeons-9446d`; set it to `null` for a local-only app), `auth.ts`, `characterRepo.ts`, `session.ts` (orchestrates local vs cloud workspace, saving, upload, sign-out, refresh on tab focus).
- `characterStore.ts` no longer persists anything: it bumps `revision` on user changes and `session.ts` saves.
- UI: `#/accedi` (SignInPage), AccountBar + SyncBadge in the header, UploadDialog after login.
- `firestore.rules` + `tests/rules/` (run with `npm run test:rules`, also in CI with Java 21).

## Phase 1 decisions

- **Password**: no app-side rules (user's choice). Firebase's own minimum of 6 characters still applies and is the only message shown.
- **Local mode stays**: logged out = browser workspace; logged in = account workspace. Separate; login and logout never overwrite either.
- **Upload offer** after login when the device has characters that are not the untouched default: fresh ones are uploaded, conflicts (same id, different content) are chosen one by one; "Non ora" asks again next login, "Non chiedere più" stores `dnd-companion:upload-dismissed:<uid>`.
- **Cloud saving**: whole character with `setDoc`, 1.5 s debounce, flushed on hide/pagehide; last write wins. No realtime listener on own characters: one read at login, one re-read of the active character when the tab becomes visible (applied only if newer and no local edits happened meanwhile).
- **activeCharacterId** lives in `users/{uid}`, written only when the active character changes.
- **Sign-out** flushes and waits (max 5 s) for pending writes; if offline with unsynced writes it asks first.
- **Real project** (2026-10-13): `dungeons-9446d`, web app `dnd-companion` created with the CLI, Firestore `(default)` STANDARD, rules deployed with `npx firebase deploy --only firestore:rules --project dungeons-9446d`. `.firebaserc` default stays `demo-dnd` on purpose, so a bare command never touches the real project. Sign-up with `<username>@dnd.local` verified on the real Auth (test account deleted).
- **Quota estimate** (party of 6, ~4 h session): ~160 reads, ~600 to 900 writes. Well under 5% of the Spark daily limits.

## Phase 2: what exists

- `src/domain/sheet/rules.ts`: abilities, the 18 skills (English ids, Italian labels, linked ability), the 14 SRD conditions, limits.
- `src/domain/sheet/sheet.ts`: `Sheet` type, `defaultSheet`, `sanitizeSheet`, calculations (`abilityMod`, `totalLevel`, `proficiencyBonus`, `saveBonus`, `skillBonus`, `passivePerception`, `initiative`, `attackBonus`, `attackFormula`, `damageFormula` with critical, `classSummary`), rests (`shortRest`, `longRestSheet`).
- `src/domain/workspace.ts`: pure multi-character operations (`selectIn`, `addAndSelect`, `duplicate`, `removeFrom`, `CHARACTER_LIMIT` = 20).
- Store: `selection` counter (user switched character) and `removed` queue next to `revision`; actions `createNew`, `duplicateOf`, `addImported`, `select`, `remove`, `editSheet`, `shortRest`. `session.ts` writes `activeCharacterId` on switch, flushes the previous character first, then deletes removed ones (`deleteCharacter`, 1 write each).
- UI: tabs Tiri / Scheda / Personaggi (`TabNav`), header switcher (`CharacterBar`), `CharactersPage` (use, create, duplicate, export, import, delete with confirmation), `features/sheet/*` (play mode rolls on click, «Modifica la scheda» turns sections into forms), sticky `RollStrip` with the last roll and the d20 mode.
- `NumberField` accepts decimals with a comma (`decimals` prop); `TextField` for labelled text.

## Phase 2 decisions

- **Character v2** = v1 + `sheet` (nested object). Migration 1→2 adds `defaultSheet()`; tested with a real v1 document and a v1 export file. Firestore rules unchanged (they already allow the owner to create, update and delete characters).
- **Typed by hand**: AC, speed, max HP (inventory will compute AC later). Classes and race are free text (an SRD list may come with the codex). Multiclass supported (max 6 entries, total level capped at 20).
- **Proficiency levels** for skills: none, half (rounded down, Jack of All Trades), proficient, expertise; plus an extra bonus per save and skill (magic items).
- **Critical damage** doubles the dice, not the flat modifiers. Damage dice are validated with the dice parser and stored in canonical form.
- **Metres** for speed and darkvision (Italian PHB), one decimal, shown with a comma.
- **Rests**: the long rest (from Tiri or Scheda) also restores every feature use and removes one exhaustion level (SRD, food and drink assumed). The short rest restores «a riposo breve» uses; hit dice are not tracked yet.
- **Conditions, exhaustion, inspiration and feature uses** are game state: clickable in play mode, no need to enter edit mode.
- **Import** adds the character (or replaces the one with the same id after confirmation); it no longer replaces the active one.
- **Quota**: switching character = 1 write (`activeCharacterId`); create = 1 write; delete = 1 write; sheet edits go through the existing 1.5 s debounce.

## Phase 3: what exists

- `src/domain/party.ts`: join codes (`generateJoinCode`, `normalizeJoinCode`, `formatJoinCode`; 8 chars from a 31-letter alphabet without 0/O/1/I/L), `Sharing` + `defaultSharing`, `hpStatus`, `buildSummary`, `sameSummary`, `partyGlance`, sanitizers for every party document, `countdown`, `formatSessionDate`, limits.
- `firestore.rules`: parties, members, quests, log, partyCodes, memberships. `tests/rules/parties.rules.test.ts` covers creation, joining, isolation, cards, transfer, code regeneration, deletion, quests and log.
- `src/data/partyRepo.ts` (Firestore calls, listeners) and `src/data/partyStore.ts` (state, actions returning Italian errors, summary publishing).
- UI in `src/features/party/`: `PartiesPage` (`#/gruppo`: my parties, join, create), `PartyPage` (`#/gruppo/:id`) with `PartyHeader`, `MemberCards`, `PartyGlance`, `QuestBoard`, `SessionLog`, `MySharing`, delete. Tab «Gruppo».

## Phase 3 decisions

- **Layout** as in the brief, plus: `schemaVersion` on every document; `characterId` and `sharing` mirrored in `users/{uid}/memberships/{pid}` (so summaries can be published without reading the party); `nextSession` may be null.
- **Join**: read `partyCodes/{code}` (get only), then one batch: member card (`role: 'player'`, the code; the rule compares it with the party's code and `joinEnabled`) + membership. The membership starts with an empty name; the lazy rename fills it when the party is opened.
- **Create**: one batch of 4 (party, code, DM card, membership); rules tie them with `getAfter`/`existsAfter`. A code collision fails the batch and the client retries with a new code.
- **Roles**: the DM role always equals `ownerUid` (rule `roleMatchesOwner`). Transfer = one batch: party.ownerUid, both member roles, the old DM's membership; the new DM's membership role catches up when opened. The DM cannot delete their own card while the party exists (found by the rules tests).
- **Soft limits** in the UI only: 10 parties per user, 10 members per party. The member count is checked right after joining (non-members cannot read members); over the limit, the client leaves again.
- **Privacy**: name, class and level always visible; HP exact / status only / hidden (default status); conditions shared by default; AC, passive Perception, death saves, inspiration, languages, proficient skills (not half), darkvision are opt-in. Status words: sano (> ½), ferito (> ¼), in fin di vita, a terra (0), plus **morto** (3 failures), added beyond the brief's four.
- **Summary publishing**: `partyStore` watches the active character; for each membership using it, after 3 s it builds the summary and writes only if it differs from the last one sent (`sameSummary`). Flushed when the page is hidden. When the group screen shows our own card, it publishes if the card is behind.
- **Realtime**: only on `#/gruppo/:id`, detached on leave: party doc, members, active quests, latest 20 log entries. Closed quests and older log pages are read on demand.
- **Removed or deleted**: listeners get permission-denied → «Gruppo non disponibile» with «Togli dai miei gruppi» (deletes the own membership; the DM cannot write other users' private data).
- **Delete party**: quests and log in batches of 450, then other cards, code, party, own card and membership in a final batch.
- **Quota** (party of 6, 4 h): ~35 reads to open the screen, ~600 summary writes delivered to 6 screens ≈ 3.600 reads; total ≈ 4.000 reads and 800 writes per session.

## Phase 4: what exists

- `src/domain/inventory.ts`: `Inventory` (`items`, `coins`, `settings`), `sanitizeInventory`, weights (`carriedWeightLb`, `contentsWeightLb`, `coinsWeightLb`), value (`totalValueCp`, `coinsValueCp`), `capacityLb`, `encumbrance`, `speedPenaltyM`, units (`toUnit`, `fromUnit`, `formatWeight`, `formatGp`).
- Character **v3** = v2 + `inventory`; migration 2→3 adds `defaultInventory()` (tested from v1 and v2; export round-trip includes the inventory).
- UI: tab «Zaino» (`src/features/inventory/`): weight bar and encumbrance, kg/lb toggle, items with search and category filter, containers with their contents underneath, quick ± quantity, `ItemEditor`, coins, weight settings. The sheet shows the speed penalty.

## Phase 4 decisions

- Weights in **pounds** (2 decimals), values in **copper pieces** (integers); UI in kg (default) or lb, values in mo with up to 2 decimals.
- **Containers**: one level only (a container is never inside another); optional capacity with a "troppo pieno" warning; «il contenuto non pesa» for a bag of holding. Removing a container, or unticking «È un contenitore», moves its contents out instead of deleting them.
- **Attunement**: at most 3; the UI disables the fourth, sanitizing keeps the first 3.
- **Coins**: cp, sp, ep, gp, pp (mr, ma, me, mo, mp); 50 coins = 1 lb; «Le monete pesano» can be switched off (user request).
- **Encumbrance**: over capacity = «Sovraccarico» always; with the variant rule over ⅓ «Ingombrato» (−3 m), over ⅔ «Pesantemente ingombrato» (−6 m); shown on the sheet's speed.
- Inventory is never shared in parties. No Firestore cost beyond the character's existing debounced save.

## Maps: what exists

- `src/domain/maps.ts`: `GameMap`, `PersonalMap` (pins inside), `MapPin` (x, y as 0..1 fractions), sanitizers, hierarchy (`breadcrumb`, `canNest`, `mapTree`), pan and zoom math (`fitView`, `clampView`, `zoomAt`, `toImageFraction`, `toScreen`, `centreOn`), `downscaleTarget`, `nameFromFile`.
- `src/data/imageStore.ts`: IndexedDB `dnd-companion-images`, images keyed by **fingerprint** (SHA-256 of the original file, 32 hex); `prepareImage` downscales above 8192 px or 45 MP to JPEG 0,9.
- `src/data/mapRepo.ts` + `mapStore.ts`: personal maps in `users/{uid}/maps/{id}` (logged out: localStorage `dnd-companion:maps`); party maps in `parties/{pid}/maps/{id}` with pins in `.../pins/{pinId}`; listeners only on the open page.
- UI `src/features/maps/`: `MapsPage` (`#/mappe`: scope switch «Le mie mappe» / «Gruppo: …», tree, add one or more images, edit, replace image, delete), `MapPage` (`#/mappe/io/:id`, `#/mappe/gruppo/:pid/:id`: breadcrumb, «Aggiungi segnalino», pin list), `MapViewer` (pointer pan, wheel and pinch zoom, keyboard), `PinPanel`.
- Tabs are now Tiri · Scheda · Zaino · Mappe · Gruppo; «Personaggi» is reached from the header select («Gestisci personaggi…»).

## Maps decisions

- **Images never leave the device** (copyright, and no Cloud Storage on Spark). A party member loads the same file locally; if the fingerprint differs the app warns and, on «Usala comunque», stores it under the map's fingerprint.
- `faerun-images/` (the user's downloaded WotC maps, see its SOURCES.txt) is in `.gitignore`: never commit it.
- Sub-maps: `parentId` on the map; a pin can open another map (`linkMapId`). Going back through the breadcrumb (`?da=<child>`) centres on the pin that leads to the child.
- Party maps: created, edited and deleted by the DM only; any member adds pins; author or DM edits/deletes them. Deleting a map deletes its pins first; deleting a party deletes its maps and pins.
- Limits (UI): 30 maps per scope, 300 pins per map. Logged-out personal maps are not uploaded at login (separate workspaces, like characters).
- Quota: opening a party map ≈ 1 read per pin + the maps list (≤ 30); each pin change = 1 write.
- Image evaluation (2026-10-14): best world maps «1479-faerun low-res.jpg» (5e era) and «Map - Faerun - 3E.jpg» (more roads and towns); «Sword-Coast-Map HighRes-Compressed.jpg» (8192 px) for the Sword Coast. Several city folders hold artwork rather than maps.

## Condition effects (added by a background agent, 2026-10-14)

- `src/domain/sheet/conditionEffects.ts`: SRD 5.1 summaries and full text of the 14 conditions and 6 exhaustion levels, implied conditions; shown under the conditions on the sheet («Effetti attivi»), with the CC-BY attribution.

## Ideas (proposed by the user, 2026-10-14)

Proposals, not work orders. I decide order and timing, tick the box when done, and write here every change of plan or doubt. Difficulty: S small, M medium, L large. Rough build order is in "Chosen order" below.

### [ ] I1. Preloaded Faerûn map, available offline, plus hand-added maps (step 1 done 2026-10-14: private account copy)

- **Request of 2026-10-14**: "load the Faerûn map in the main software so it is on every device". **Decision: not bundled.** The files in `faerun-images/` are © Wizards of the Coast, downloaded from the Forgotten Realms wiki with the note "personal use only, do not redistribute" (see `faerun-images/Faerun/SOURCES.txt`), and the brief forbids committing them. Putting the map in the repo or in `public/` would publish it on a public site and in the git history, which cannot be undone. If the owner really wants it public anyway, that is their call to make explicitly; the alternative is a fan-made map under a compatible licence (none chosen yet).
- **Done instead** (same result for the owner's own devices): **«Immagine su tutti i miei dispositivi»** on every map page. «Salva nel mio account» keeps a private copy of the image in the user's account (`users/{uid}/mapImages/{fingerprint}` + `/chunks/{n}`, owner-only rules, tested; no Cloud Storage needed): pictures over 3 MB are recompressed (JPEG, longest side 3000 px), cut into 700.000-character chunks (at most 8). On another device, opening a map whose image is missing first looks in the account and downloads it by itself (7 reads for a 3 MB image); only if it is not there does it ask for the file. «Togli dall'account» removes it. Logged-out users keep the old behaviour (image stays in the browser). Decision changed from the Maps phase ("images never leave the device"): they now can, to the user's private account only, and only on request. Checked on the emulators with an 11 MB image (6 chunks, 2,7 MB back, decodes), rules deployed.
- **Still to do**: the one-time bulk import from the `faerun-images` folder (folder picker, tree from a static catalogue without images), the offline app shell (PWA), `navigator.storage.persist()`. Quota note: 3 MB images use about 4 MB of the 1 GiB free storage each.
- Original note follows.

- **State**: manual maps already exist (Maps phase). What is missing is the "already there" part.
- **Problem**: the images are WotC material (SOURCES.txt in `faerun-images/`). The site is public, so they can be neither in the repo nor in `public/`, nor in the build output on Pages. Also note: `faerun-images/Faerun_immagini_5e.zip` is not on disk any more; only the extracted `Faerun/` folder is (gitignored).
- **Change of plan (not "preloaded for everyone")**: the images cannot ship with the app, so "preloaded" becomes "one-time bulk import per device":
  1. A static `public/maps-catalog.json` (names, hierarchy, expected file names, **no images**) describes the Faerûn tree: world map, Sword Coast, one sub-map per city.
  2. «Importa pacchetto mappe»: the user picks the folder (`<input webkitdirectory>`, no dependency) or the zip (would need a small unzip library, e.g. `fflate`: ask first). Files are matched to catalog entries by file name; the tree is created in one go (personal maps, `parentId` set), images go to the existing IndexedDB store.
  3. Offline: IndexedDB already works offline once imported. The app shell itself needs the PWA phase (service worker). Add `navigator.storage.persist()` so the browser does not evict the images.
- **Difficulty**: M. **Depends on**: PWA (offline shell), existing map store. **Risks**: iOS Safari evicts site data after about 7 days without use unless the app is installed to the home screen; every device (and every player) must import once; ~100 MB of images may be slow on phones. Fan-made maps with a compatible licence could replace the WotC set later without any code change.

### [x] I2. Character photos: portrait, plus full-body on the sheet (done 2026-10-14)

- **Done**: `src/domain/portrait.ts` (limits, `sanitizePortraits`, geometry; tests), `portraitRepo` (IndexedDB `dnd-companion-portraits` when logged out; `users/{uid}/portraits/{characterId}` in the account), `portraitStore` (loaded per character when shown), `portraitImage` (portrait = centred 256 px square, full-body fits 768 px, JPEG, quality then size drop until under the limit: 60.000 / 220.000 characters). UI: portrait avatar in the header switcher and on the sheet header (upload in edit mode), «Aspetto» card with the full-body picture (never shared). Removing a character removes its pictures.
- **Party**: `parties/{pid}/members/{uid}/portrait/main` holds the shared portrait; the member summary carries `portraitAt` (its version), so other members fetch it once per version (1 read) and only when the summary says there is one. Sharing gained `portrait` (**default on**; checkbox «Mostra il mio ritratto agli altri» in «La mia scheda nel gruppo»); turning it off or removing the picture deletes the shared document. The portrait document is written before the summary that mentions it. Owner and DM can delete it; leaving, removing a member and deleting a party clean it up (best effort).
- **Rules** (deployed to `dungeons-9446d` 2026-10-14): personal portraits owner-only with size and format checks; shared portraits member-readable, owner-written. 45 rules tests pass. Checked in the browser with the emulators (upload, card shows it, unsharing removes it); a second member was not tried live.
- Original note follows.

- **Plan**: portrait shown on the sheet, in the header switcher and in the party member cards (Gruppi); the full-body picture only on the sheet.
- **No Cloud Storage (Blaze)**, so pictures are downscaled in the browser (portrait about 256 px WebP/JPEG, ~15 to 30 KB; full-body about 768 px, ~80 to 150 KB) and stored as base64 in a **separate small document**, not inside the character (the character is rewritten on every debounced save and has the 1 MiB limit):
  - own portrait + full-body: `users/{uid}/portraits/{characterId}` (owner only);
  - shared portrait: `parties/{pid}/members/{uid}/portrait/main` (portrait only, never the full-body), written when the user shares it, read once per member when the party page opens.
  - Logged out: IndexedDB, like map images.
- **Difficulty**: M. **Depends on**: `imageStore.prepareImage` (reuse the downscaler), new rules + tests. **Risks**: base64 inflates size by a third (still tiny); members could upload any picture to a shared party (moderation is up to the group; the DM can remove a member's portrait: add a rule for that); quota is 1 write per photo change, 1 read per member on opening a party.

### [x] I3. 3D animation for every die (done and checked in the browser 2026-10-14)

- **Done**: `src/features/dice/solids.ts` builds the d4 (tetrahedron), d6 (cube), d8 (octahedron), d10/d100 (pentagonal trapezohedron, planar kites) and d12 (dodecahedron); the d20 stays in `d20geometry.ts`. `Die3D` takes `sides`; `D20Result` picks the **first term with dice**, falls back to the d20 for flat-only or unusual dice (d3, d7…), and draws a d100 as a d10. The natural face goes in front when exactly one die of that kind was kept (not for the d100). `solids.test.ts` checks shape, planarity, convexity, numbering (opposite faces add up to n+1) and upright facing for every solid. Typecheck, lint and 164 tests pass.
- **Checked on screen**: every die rolled in the browser. The d4 and d6 rest slightly tilted (face-on they looked flat), the d10 stands on its long tip. The tray now builds the formula in the **order the dice were first chosen** (it used to sort by size), so "first die chosen" is really the first one. The d4 shows its number at the face centre, not at the vertex like a real one.
- Original note follows.

- Already in the Backlog (user request 2026-10-14). `Die3D` + `d20geometry.ts` project a real icosahedron to SVG each frame, no library.
- Add the solids: tetrahedron (d4), cube (d6), octahedron (d8), pentagonal trapezohedron (d10 and d100), dodecahedron (d12). Several kinds in one roll: the animation uses the **first dice term of the formula**; the number of dice still shows in the result. d100 is shown as one d10 solid (the result strip already shows the two parts).
- **Difficulty**: M (geometry, "which face is up" per solid, label placement on triangles vs pentagons vs kites). **Depends on**: nothing. **Risks**: low; keep reduced motion, the no-tumble-on-load rule and the natural-20 face logic; unit tests for each solid (face count, vertices on the unit sphere, face normals). The d4 shows its number at the vertex up, so use the "top reading" convention for it.

### [x] I4. Level-up: raise HP and choose the hit die (done and checked in the browser 2026-10-14)

- **Done**: `ClassEntry` gained `hitDie` (0 = SRD die for the class name, Italian or English; d8 if unknown) and `hitDiceUsed`. **No character version bump**: the fields live inside the nested sheet and `sanitizeSheet` defaults them, so old documents and exports load unchanged (tested). Domain in `src/domain/sheet/hitDice.ts` (+ tests); store actions `levelUp` and `spendHitDie`; UI `HitDiceCard` on the Scheda page (spend a die: rolls die + CON through the dice module, so it shows in the roll strip and history, and heals; «Sali di livello» form with roll / fixed value / typed value, die choice, preview of the gain) and a hit die select per class in edit mode. Long rest regains half the total dice (min 1, biggest first); short rest recovers none (SRD).
- **Decisions**: gain = die value + CON modifier, at least 1 (SRD); max and current HP both grow by it; a later CON change is **not** retroactive (the «Ricalcola dal COS» button is not built: add it if wanted). The manual level field in edit mode still changes the level without touching HP. **Discoverability fix (user report, 2026-10-14)**: the level-up form first lived only at the bottom of the Scheda page, and the edit-mode level field changes the level without touching HP, so HP never grew. Now «Sali di livello (aggiunge PF)» is also on the Tiri page (HP panel) and in the sheet edit mode, the level field warns that HP do not change, and the HP panel has a visible «Aumenta PF massimi» (raises max and current by the amount typed) and a clearer manual-edit line. Typecheck, lint, 172 tests, build pass; level-up and spending checked in the browser. Spending is disabled at full HP.
- Original note follows.

- On level-up (or when a class level is added) the user picks per level: **roll the hit die**, **take the average** (SRD: ½ die + 1), or **type a value**; CON modifier is added; the class's hit die can be set (free choice, default from the SRD class table). Max HP and current HP grow by the same amount. A change of CON modifier later is not retroactive unless the user asks (button «Ricalcola dal COS»).
- This needs **hit dice tracking**, which is the open question in this file: spend on a short rest, recover half (min 1) on a long rest. I fold it into this idea since the data (die per class, level) is the same.
- **Difficulty**: S to M. **Depends on**: sheet `classes` (multiclass: one hit die per class, pool per die type), HP domain. **Risks**: sheet max HP is typed by hand today, so migration must not rewrite it (character v4 adds `hitDice` with sensible defaults, empty = untracked). Level-up dialog must show the exact arithmetic.

### [ ] I5. Bestiary: full monster list + party "Pokédex" bestiary

- **Two parts**:
  - A. **Monster list**: all SRD 5.1 monsters (~330) as static JSON in `public/` (CC-BY attribution already in the app), lazy-loaded, searchable, filters by type, CR and size.
  - B. **Party bestiary** on the Gruppi page: starts **empty**; entries are created by hand (pick an SRD monster or type a custom one, since homebrew and non-SRD monsters exist), then filled with what the DM reveals during play: seen/unseen silhouette, known AC, HP, resistances, abilities, notes, where met. Pokédex style = grid of cards, silhouette until discovered.
- **Sync**: `parties/{pid}/bestiary/{entryId}`, one document per entry (concurrent edits on different monsters do not collide). Same permission pattern as the party pins: any member adds and edits notes, author or DM deletes (to be decided, see Chosen order). Listener only while the page is open.
- **Difficulty**: L (data import and size; party sync and rules). **Depends on**: SRD JSON (not in the repo yet: needs a download from an SRD source; I will check the licence and note it), PWA for caching. **Risks**: SRD names are in English (the app is Italian: keep the English name as the key and let the user add an Italian name); JSON size (~1 MB) must stay lazy; quota ≈ 1 read per discovered entry on opening, 1 write per edit; set a limit (e.g. 300 entries).

### [ ] I6. Grimoire: spells, slots, rests (steps a and b done 2026-10-14; c to do)

- **Step b done** (spell list): `scripts/build-srd-spells.mjs` builds `public/srd/spells.json` (319 SRD 5.1 spells, English, 360 KB, 92 KB gzipped, fetched only when the Grimorio tab opens) from the 5e-bits database (code MIT, text from the SRD 5.1 under CC-BY 4.0; attribution shown on the page). `src/domain/spells.ts`: catalogue sanitizer, class rules (known: bard, sorcerer, warlock, ranger, Eldritch Knight, Arcane Trickster; prepared from the whole list: cleric, druid, paladin; spellbook: wizard), cantrips known and spells known by class level, prepared = ability modifier + level (paladin half level, min 1), wizard book = 6 + 2 per level above 1, highest castable spell level per class, add/remove/prepare with every limit explained in Italian, casting options (slot of the spell level or higher, pact slot, ritual). Lists live in `sheet.spellcasting.lists` by class key (no version bump). UI: a **Grimorio tab** with the slots, one card per casting class (counts, cantrips, known/book/prepared lists with the full SRD text, "Lancia" choosing the slot, search and add), and an "ignore the limits" switch in edit mode for feats and house rules. 210 tests; checked in the browser (add, level limit, prepare, cast spends the slot).
- **Limits**: SRD only (319 spells, English); the third casters use the wizard list without the school restriction; Magic Initiate and similar are covered only by the ignore-limits switch; concentration and duration are shown, not tracked (that is I8). Step c (concentration, ritual casting in play) moves into I8.

- **Step a done** (slots, pact slots, spending, rests; no spell data): `src/domain/sheet/spellSlots.ts` + tests, `spellcasting` inside the sheet (**no character version bump**, sanitized defaults), `SpellSlotsCard` on the Scheda page (round buttons: filled = available, tap to spend, empty = tap to recover), hand-set maximums in edit mode (0 to 9 per level) for unknown classes or house rules. Casters are recognised by class name (Italian or English); third casters by subclass (Cavaliere Mistico / Eldritch Knight, Mistificatore Arcano / Arcane Trickster).
- **Correction of the note below**: the SRD 5.1 rounds half-caster levels **down** in multiclassing (the "round up" was the 2024 rule). A single casting class follows its own table (paladin and ranger from level 2, third casters from level 3); with several casting classes, full levels are added to half and third levels (each group summed, then rounded down).
- Short rest restores the warlock's pact slots, long rest everything (also hit dice and uses, as before). Arcane Recovery is not automated: tap an empty circle to get a slot back. Feature uses already had the short/long recharge, so "the same rules for special abilities" holds. Checked in the browser (spend, long rest, status line).

- **Rules to implement (SRD 5.1)**:
  - Slots per level from class level: full casters (bard, cleric, druid, sorcerer, wizard), half casters (paladin, ranger, round **up** as in the SRD multiclass table), third casters (eldritch knight, arcane trickster), **multiclass slot table**, warlock **Pact Magic** (separate slots, recovered on a **short** rest).
  - Known vs prepared: **wizard** has a spellbook (adds 2 per level) and prepares INT mod + level; **cleric, druid** prepare WIS mod + level from the whole class list; **paladin** prepares CHA mod + half level; **sorcerer, bard, warlock, ranger** know a fixed number from the class table (and can swap one on level-up). Cantrips known per class table.
  - Slots are spent in play (also casting at a higher level) and recovered on long rest; Arcane Recovery (wizard) on a short rest; warlock on a short rest. The same recharge model drives class features: **features already have a «riposo breve / lungo» recharge** (Phase 2), so spell slots and features share one `Recharge` concept instead of two.
- **Change of plan (flagged)**: "divine vs arcane" is **not a rule in 5e** (only a flavour label; no mechanical difference). I implement the mechanical differences that matter, which are the ones in the list above (prepared-from-whole-list vs spellbook vs known). The label «Divina / Arcana / Primordiale» can be shown as a tag on the class if wanted.
- **Order inside this idea**: (a) slots, pact slots, spending and rests, no spell data needed; (b) the SRD spell list (~320 spells) as static JSON, per-class lists, known/prepared with the counts above, cantrips; (c) concentration and ritual markers.
- **Difficulty**: L (the biggest idea). **Depends on**: hit dice/level-up (I4) for the level tables, SRD spell data, PWA caching, sheet classes. **Risks**: correctness of tables (every one gets a test); multiclass casters; subclass casters (eldritch knight) need a subclass field; spell text is English SRD; character v5 needs a migration (`spellcasting` empty by default).

### [ ] I7. Master section (DM area)

- **What it does**: the party's DM sees the participants' sheets, assigns conditions, adds or removes HP, "and so on".
- **Why this is the hard one**: until now every character is written only by its owner (rules: owner only; party cards are opt-in summaries). Letting the DM write to someone else's character would clash with the owner's debounced last-write-wins save (the DM's change would be overwritten, or would overwrite theirs), and no Cloud Functions exist on Spark.
- **Proposed design (to confirm with the user before building)**:
  1. **Visibility**: a per-party opt-in «Condividi la scheda completa con il Master» publishes a full read-only snapshot to the member card (`parties/{pid}/members/{uid}/sheet`, bigger than the summary, same 3 s debounce; history and inventory can be left out). The DM sees it read-only. Default off. Honest about what the DM can read.
  2. **Changes go through a command queue, not direct writes**: the DM creates `parties/{pid}/commands/{id}` (`targetUid`, `kind`: `damage | heal | tempHp | addCondition | removeCondition | …`, `amount`, `by`, `at`). The target's client, while the app is open, listens to its own commands (one query), applies each with the **existing domain functions** (`applyDamage`, conditions…), then deletes the command and a line goes to the party log («Il Master ha inflitto 7 danni a X»). So the character document keeps a single writer and there are no conflicts.
  3. Rules: DM may create commands for members; only the target may read and delete them; field-level validation; rules tests.
  4. Tab «Master» shown only when the user owns a party.
- **Limits to accept**: a change is applied only when the player's device is online with the app open (the DM sees "in attesa" until then). Pending commands older than N hours expire.
- **Difficulty**: L. **Depends on**: Phase 3 parties, HP/condition domain functions (already pure), the bestiary pattern (I5) for DM-only tools later. **Risks**: privacy (opt-in required), abuse (a DM applying commands the player never sees: always log them and show a toast), quota (a listener per device on the commands collection: reads only when a command arrives; snapshot publishing adds ~1 write per change for opted-in members), rules complexity. A "player must accept" mode is possible later.

### [x] I8. Combat screen (proposed by the user, 2026-10-14; built 2026-10-14)

- **Built**: tab «Combattimento» (a red dot on the tab while a combat is on). `src/domain/sheet/combat.ts` (+ tests): `sheet.combat = { active, round, effects[] }` (no version bump, sanitized defaults), start / end, **end of turn** (round +1, every timed effect −1, expired ones announced and removed), one concentration effect at a time, `durationOf` for SRD durations (rounds, minutes ×10; hours, days, «until dispelled», «special» are ended by hand; instantaneous = no effect), `concentrationDC` = max(10, half the damage). A long rest ends the fight. Casting during a combat (`castWithEffect`) adds the spell as an effect and drops the previous concentration spell; cantrips now have a «Lancia» button (no slot). Damage while concentrating shows the Constitution save banner (DC, roll button, «Ho mantenuto» / «Perdo la concentrazione»); falling to 0 HP ends concentration with no save.
- **Page**: turn card (start, «Fine turno», end with confirmation), «In breve» (AC, initiative roll, speed with encumbrance, proficiency, six saves as roll buttons, spell save DC and spell attack roll per casting class), HP (bar, damage, healing, death saves at 0, concentration check), conditions, active effects (spell effects can be read in full), attacks, saved rolls as one-tap buttons, and the spells ready to cast (cantrips, known or prepared, grouped by level, each readable in full, with the slots line).
- **No duplicated information (decision)**: *moved*, not copied: the **Conditions** card (now only here) and the **Attacks** card in play mode (the Scheda page shows them only in edit mode, with a pointer to this screen otherwise). Single home for the rest: slots and spell management stay in the Grimorio, the full HP panel (maximum HP, level-up, rests) and preset creation stay on Tiri. Deliberate read-only mirrors, because this page is also the character summary: AC, initiative, speed, proficiency, saves; HP bar and quick damage/healing; the saved rolls; the castable spells and a text line of the slots.
- Original note follows.

- **Does it make sense? Yes.** At the table the same things are needed together and today they live on four pages: HP, conditions, saved attacks, available spells and slots, and the duration of effects. One screen that gathers them, plus a turn counter, is the natural next step after the grimoire.
- **Shape**: a «Combattimento» entry (button on Tiri, then a tab while active) that turns combat mode on. Contents: HP panel with quick damage and healing, conditions, the attacks of the sheet with their roll buttons (play mode, as on the sheet), spell slots and the spells to cast (a cast spends the slot and, when the spell has a duration, adds an effect), the list of **effects with remaining rounds**, and a **«Fine turno»** button: round +1, every timed effect −1, expired ones are announced and removed. «Termina combattimento» clears the effects and the round (conditions stay, they are game state).
- **Data**: `combat: { active, round, effects[] }` inside the character (survives a reload mid-fight, no migration: sanitized defaults); effect = name, remaining rounds or null (manual), concentration flag, note. Not shared with the party at first.
- **Concentration**: one concentration effect at a time (casting a new one asks to drop the old one); taking damage while concentrating shows the CON save with DC max(10, half the damage) and a roll button.
- **Durations**: SRD spell durations are text («1 minute», «Concentration, up to 1 hour»); a small parser turns «1 round» and minutes into rounds (1 minute = 10 rounds), longer durations stay manual. Tested like the dice parser.
- **Difficulty**: M to L. **Depends on**: I6b (spell data with durations; the screen can start with manual effects and attacks before that), existing HP, conditions, attacks, slots. **Risks**: scope creep (initiative tracking belongs with the Master section, I7: the DM's shared initiative order could later feed «è il tuo turno»); end-of-turn versus start-of-turn expiry (start with «end of my turn»); duplicating UI instead of reusing the existing cards (reuse them).

### UI and usability plan (2026-10-14): strategies 1 and 2 applied, the rest proposed

**Applied (user: «non ho preferenze, procedi»)**: `FoldCard` (`src/components/FoldCard.tsx`): a card whose title is a button, with a one-line summary while folded, state remembered per card id (`dnd-companion:fold:<id>`). Folded by default: Formula libera, Aspetto (figure), Dadi vita e livello, Impostazioni del peso; Storico and Abilità are foldable but open, and the history shows the last 5 with «Mostra tutti». Skills in play mode show only the proficient ones (or with an extra bonus) in a two-column grid, with «Mostra tutte le 18» (a new character with no proficiency sees all). The death-save pips on the Tiri page appear only at 0 HP or while some are marked. Measured on the dev character (desktop, stacked sum of the cards): Scheda 2727 → 1941 px, Zaino 913 → 675, Tiri 2219 → 2037 (page 1587 → 1405). Strategy 3 (rest of Tiri) and 5 (vital strip) are the next ones.

**Also applied (2026-10-14, later)**: strategy 5, the **vital strip** (`src/features/vitals/VitalStrip.tsx`): sticky under the tabs on every page, with avatar, name and class, HP bar, quick damage and healing, AC, the round in combat (a link to the combat screen), the HP status line, the concentration check and the death saves at 0 HP. It replaces the phone-only HP quick bar, the HP card of the combat screen and the old HP panel of the Tiri page; the rarer HP changes (temporary and maximum HP, manual values, level-up, long rest) moved into a folded **«Gestione PF»** card. Strategy 3, partly: saved rolls became chips, the free formula is folded. Still open from 3: moving the free formula inside the tray.

### Fantasy look, second pass (2026-10-14, bolder; still not seen by the author)

- **Why it felt static**: besides the flat boxes, this PC has Windows "reduce animations" on, and the app obeyed it, so nothing moved. Decorative animations now follow the same **Animazioni** setting as the dice (`html[data-motion]`, set by `syncMotionAttribute`): default is the system, one click on «Attiva le animazioni» (under the die) forces them on.
- **Character**: **Cinzel** for titles and numbers, **Cinzel Decorative** for the logo (SIL OFL, bundled in `src/assets/fonts` with its licence, 190 KB; the font choice was in the list of ideas the user asked to continue); **leaf-shaped corners** (two sharp, two round) on cards, buttons and fields instead of uniform rounded boxes; an **accent colour per section** (gold for dice and sheet, crimson for combat, arcane violet for the grimoire, emerald for maps, azure for the party, bronze for the backpack) that tints the background, titles, brackets, tab and pips; **icons** on the seven tabs (inline SVG); a **rune ring** (tick marks turning slowly, plus a halo) behind the die; **embers** drifting up in the header; the logo **shimmers**; cards **rise** when a page opens; the spell window is a **parchment** with dark-red ink; the HP bar fills with a gradient; pips glow like gems.
- **Caveat**: the browser tool could not take screenshots in this session either (computed styles, fonts loaded, accents per section, no horizontal overflow and the animations were checked). Look at it and say what to dial down.
- **Still open**: parchment texture on cards, ornate section dividers, icons for spell schools and conditions, accent by character class, a light parchment theme, a dark-red theme for the Master section, sparkles on a natural 20, route transitions between pages.

### Fantasy look, first pass (2026-10-14)

- **Done**, CSS only, no images or web fonts (works offline, nothing to license): new palette in `tokens.css` (midnight indigo, aged violet, bronze lines, burnished gold, parchment text; contrast measured: text 13.5, muted 7.4, gold titles 11), `src/styles/fantasy.css`: night-sky background, framed cards with an inner line and **gold corners**, small-caps titles with a gold diamond and a fading rule, bevelled buttons with a gold glow on hover, a gold primary button, a gem-like HP bar, a gold d20 in the header, glowing active tab, gold glow on a critical die, spell dialog in the same frame.
- **Caveat**: the browser tool could not take screenshots in this session, so the result was checked through computed styles (contrast, no horizontal overflow, the sticky strip) and not by eye. First thing to do next: look at it and tell me what to tone down or push.
- **Ideas not done yet**: a fantasy web font for titles (Cinzel or similar, SIL OFL, vendored in `public/fonts`, about 100 KB: needs the user's OK since it adds an asset), parchment texture on cards, ornate dividers between sections, icons for tabs and spell schools (SVG, inline), an accent colour per class (the strip and titles take the colour of the character's class), a page-change transition, embers or sparkles around a natural 20, a light «parchment» theme as an option, a dark-red theme for the Master section.

(original proposal below)

**Why**: pages are long and information gets lost. Measured on the live site (desktop 1707 px wide; «stacked» = the sum of the cards, a good estimate of a phone's scroll height): **Tiri** 1590 px (stacked 2131, 6 cards; HP 606, Vassoio 434), **Scheda** 1955 px (stacked 2577, 10 cards; Abilità alone 830, Caratteristiche 473, Dadi vita 276), **Combattimento** 1401 px (stacked 1413), **Zaino** 915 px (the weight settings card alone 305). The tab bar now has 7 entries.

Strategies, from cheapest to biggest:
1. **Collapsible cards that remember their state** (one small component, state in `localStorage`): Abilità, Dadi vita, Impostazioni del peso, Storico, Formula libera collapsed by default. Gain: Scheda about −1000 px, Zaino −250, Tiri −450. Risk: low.
2. **Skills compact**: a two-column grid, proficient skills first (or only them, with «mostra tutte le 18»). Abilità goes from 830 px to about 300.
3. **Tiri page**: Formula libera folded into the tray («formula avanzata»), presets as chips under the die (as in the combat screen), history shows the last 5 with «mostra tutto», the HP panel slimmed (manual edit, level-up and rests in a «Gestione PF» fold). Gain about −600 px, and the die is visible without scrolling.
4. **Scheda page split into sections** with a segmented control (Riepilogo · Abilità · Capacità e tratti · Aspetto): only one section at a time. Gain: every section about one screen on a phone.
5. **Always-visible vital strip** under the tabs (name, HP bar with quick damage and healing, AC, round in combat): HP no longer needs a card on three pages.
6. **Navigation**: on phones a bottom bar with the five used most (Tiri, Scheda, Combattimento, Grimorio, Zaino) and «Altro» (Mappe, Gruppo, Personaggi, Impostazioni); fewer tabs, thumb reach.
7. **Density setting** («Compatta / Comoda»): less padding and smaller type for people who prefer seeing more. Risk: touch targets must stay at least 44 px in the comfortable mode.
8. **Long texts** (traits, features, notes): two lines with «Espandi». **Inventory**: denser rows, categories as chips, settings in a fold.
9. **Wide screens**: three columns above 1300 px (today two), so the page is shorter instead of leaving blank space.

Recommended order: 1 and 2 (an afternoon, no data changes), then 3 and 5, then 4 and 6, then 7 to 9. Strategies 1 to 3 alone cut the longest pages by about a third.

### Changes after user feedback (2026-10-14, evening)

- The die on the Tiri page is a button: a tap rolls what the tray holds, which now **starts as a single d20** («Torna a 1d20» resets it). Tray state lives in `src/data/trayStore.ts`, shared with the die.
- Spell descriptions: every list (Grimorio, picker for new spells, combat screen, active effects) shows the start of the text under the name and a **«Leggi»** button; the name opens the same window. After a cast a notice offers «Leggi»; the window has the choice «Apri questa finestra ogni volta che lancio» (remembered, `dnd-companion:spell-popup`). Native `<dialog>`: Escape and the backdrop close it.

### Chosen order (2026-10-14)

1. **I3** 3D dice: already requested as the next step, no dependencies, no sync.
2. **I4** (done) Level-up HP + hit dice: small, closes the open question, and its class/level data is needed by I6.
3. **I2** (done) Photos: introduces "small image in Firestore" and the first rules change for shared data, simpler than the bestiary.
4. **I6a** (done) Spell slots + rests (no spell data); then I6b (spell list)
   **I8** (combat screen, done) followed I6b.
5. **I5** Bestiary (monster list first, party bestiary second): first feature with shared data written by every member; reuses the pins pattern.
6. **I7** Master: needs the commands channel and a privacy decision, builds on all of the above; last of the sync features.
7. **I1** Faerûn bulk import: best done together with the PWA phase (offline shell), since offline is part of the request.

Status: nothing started yet (only registered).

## Dependencies

Runtime: react, react-dom, zustand. Dev: vite, @vitejs/plugin-react, typescript, vitest, eslint (+ @eslint/js, typescript-eslint, react-hooks, react-refresh, globals), @types/*.
Phase 1 added: firebase, react-router (v8, `HashRouter` from `react-router`), dev: firebase-tools, @firebase/rules-unit-testing. Phase 2 and 3 added nothing. Ask before adding anything else.

## Open questions

- (Hit dice tracking: done with I4.)

## Next step

1. Follow the "Chosen order" in the Ideas section (starts with I3, the 3D dice, the same item as the Backlog entry below).
2. User tries maps on https://solforio.github.io/dnd_app/ (personal, then a party map with a friend).
3. Phase 5 (notes) and the PWA phase are still planned; the ideas above are interleaved with them as the user prefers.

## Backlog (user requests, 2026-10-13)

- **3D die matches the dice rolled (requested 2026-10-14, DONE: see I3)**: the 3D animation should show the die that was rolled (d4, d6, d8, d10, d12, d20, d100) instead of always a d20. With several kinds of dice in one roll, use the **first kind chosen** (the first dice term of the formula). Today `Die3D` + `d20geometry.ts` draw only an icosahedron: add the other solids (tetrahedron, cube, octahedron, pentagonal trapezohedron for d10/d100, dodecahedron), keep the total on the front face, and keep reduced motion and the natural-d20 face logic.

Order chosen by the user: 1) HP visible on phones (done), 2) 3D dice animation (done), 3) Phase 4 inventory (done), 4) maps (done).

- **Maps (requested early)**: interactive Faerûn map with city sub-maps, clickable; pins on a personal map and on a shared party map. Constraints: no WotC map images in the repo (user loads their own image, kept in the browser, or a fan map with a compatible licence); no Cloud Storage (needs Blaze), so a shared map image cannot be uploaded: pins are shared through Firestore with coordinates relative to the image, each member loads the same image locally. Plan with a quota estimate before building.

- **Dice animation**: done: `Die3D` + `d20geometry.ts`, a real icosahedron projected into SVG each frame (no library), tumbles ~1,1 s and lands with the natural d20 face in front showing the total; none with reduced motion, and the roll already on screen at page load does not tumble.
- **HP on phones**: done: `HpQuick`, sticky at the top of the Tiri page below 860 px, with quick damage and healing.
