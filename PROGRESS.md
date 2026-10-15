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

### [x] I5. Bestiary: full monster list + party "Pokédex" bestiary (done 2026-10-14)

- **A. Catalogue**: tab **Bestiario**, 334 SRD 5.1 monsters (`scripts/build-srd-monsters.mjs` builds `public/srd/monsters.json` from the 5e-bits database; 451 KB, 75 KB gzipped, fetched when the tab opens; text in English, labels in Italian). Search by name, filters by type, size and challenge rating, 40 at a time, full stat block in a parchment window. `src/domain/bestiary.ts` (+ tests on the real data).
- **B. Party bestiary**, card «Bestiario del gruppo» on the party page (foldable): starts empty; a creature is added by typing its name (an SRD name is recognised, anything else becomes a custom creature with AC, HP and speed typed by hand) or with «Aggiungi al bestiario» under any stat block of the catalogue (choose the party). The card of each creature is a Pokédex card: number (its place in the SRD list, «—» for a custom one), a **black silhouette until the party knows something**, a progress bar. The creature window has the list of what the party knows (12 sections: AC, HP, speed, abilities, saves and skills, resistances and immunities, senses, languages, challenge rating, traits, actions, legendary actions; the DM tells, any member ticks): the stat block shows only those, the rest is «???». Place and notes are free text.
- **Sync and rules** (deployed to `dungeons-9446d`): `parties/{pid}/bestiary/{entryId}`, one document per creature, listener only while the party page is open (at most 300). Every member adds and fills in; name, SRD id and author never change; the author or the DM deletes. An SRD creature has the fixed id `srd-<id>`, so it can never be added twice even by two members at once. Ticking a section uses an atomic array update (found by testing: two quick clicks overwrote each other with a plain write); text fields are saved when they lose focus and again when the window closes (Escape too). The party's deletion removes its bestiary. 53 rules tests.
- **Decision, changed 2026-10-15 (owner's request)**: only the **DM reveals** what the group knows. Every member still adds creatures and writes place and notes, but ticking a section (`revealed`) is allowed only to the DM: the rules refuse an update that changes `revealed` unless `isPartyOwner`, and a player creates an entry with nothing revealed (the DM may create one already revealed). The UI shows the list read-only to players. Rules test added (67 pass). **Rules deployed** to `dungeons-9446d` on 2026-10-15.
- **Quota**: opening the party page reads one document per creature (30 creatures = 30 reads, again for each member who opens it); each tick or edit is one write.
- **Checked** on the emulators: add SRD and custom, duplicate refused, reveal and masking, notes, delete, add from the catalogue and refused twice. Not checked: two real users at once, and the look on screen.
- Original note follows.

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

### [~] I7. Master section (DM area): first part done 2026-10-14, the DM's changes to players not enabled

- **Decision (owner, 2026-10-14)**: the Master area lives **inside the party page** (card «Master», only for the DM), not in a new tab; **no changes by the DM on the players for now** (the commands channel below is not built: damage, healing, conditions). Done instead: reading the sheets, treasure, and trades between members.
- **Sheets**: a player can tick «Mostra la mia scheda completa al Master» (off by default, in «La mia scheda nel gruppo»); the app then publishes the whole character (without roll history and saved rolls) to `parties/{pid}/members/{uid}/masterview/sheet` (rules: written by its owner, read by the owner and the party's DM only; deleted on leaving, removal and party deletion). It is rewritten, after the usual 3 s, only when the character changed (compared as text). The DM sees the list of players with «Vedi la scheda» (read-only window that follows changes while open: vitals, conditions, abilities and saves, proficient skills, attacks, features and uses, slots and spells, backpack with coins and weight). Quota: one extra write per change for those who opted in; one read at open plus one per change for the DM.
- **Treasure** (`parties/{pid}/treasure/{id}`): the DM creates coins and objects (name, quantity, type, weight in kg, value in mo) for whoever takes it first, for one player, or **coins split equally between the players** (objects stay in an open treasure). Players see the ones for them in «Tesori del gruppo» and press «Prendi»: the first claim wins (the rules accept only the write that finds the treasure still open), then the player's own app puts the goods in the backpack of the **character active on that device** (stacking identical objects; refused with a message if the backpack is full, before claiming). The DM can withdraw a treasure that is not taken yet.
- **Trades** (`parties/{pid}/trades/{id}`, card «Scambi», every member): an offer takes the object out of the offering character's backpack (after the offer is safely written), so it exists in one place; the receiver accepts (the receiver's app marks it settled, then adds it to the backpack) or declines (it goes back to the offering player's backpack, also after being marked settled); the sender can cancel while pending. Containers are not tradable (empty them first). Settled trades can be removed from the list; each side sees only its own offers. A full backpack makes the goods wait. Settling is "mark first, then change the backpack" so nothing can be applied twice; the cost is that a crash in between would lose the object (the settled offer keeps its data for a manual fix). Offers settle when the party page is open.
- **Rules** (deployed): 66 tests in total, 13 new for sheets, treasure and trades. **Checked** on the emulators with two real accounts: treasure creation, empty treasure refused, claim by the player (gold and sword in the backpack), the player sees no Master panel, the DM reads the shared sheet (no inputs inside), an offer from the player, acceptance by the DM, the sword arrives; the DM's offer cancelled and the sword comes back by itself.
- **Not built, still the plan if wanted later**: DM commands (`parties/{pid}/commands/{id}`: damage, heal, conditions, applied by the player's app with a log line and a toast), a «player must accept» mode, initiative order, trading coins. Orphans: when a party is deleted its trades stay on the server (the DM cannot read them), a few small documents.
- Original note follows.

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

### Settings page (2026-10-14)

- **Where**: `#/impostazioni`, reached from the gear in the header (not a tab: there are already eight). Preferences of the **device**, kept in `localStorage` (`dnd-companion:settings`, plus the existing theme and spell-window keys): `src/domain/settings.ts` (+ tests), `src/data/settingsStore.ts`, `src/features/settings/SettingsPage.tsx`.
- **Aspetto**: theme (Notte or Pergamena, also in the header button), **text size** (90, 100, 115, 130% of the browser size: the body now uses `1rem`; checked that no page overflows sideways at 130%), **density** (comfortable or compact: tighter spacing tokens and 36 px controls), **frame decorations** on or off (gold corners, grain, diamonds, rules).
- **Dadi**: **vibration** on a roll (short buzz, a flourish for a critical hit, a long one for a fumble; disabled with a note where `navigator.vibrate` does not exist; «Prova» button). The animation switch is not there on purpose (see «Animations forced on»).
- **Incantesimi**: open the description automatically after a cast (same value as the checkbox in the spell window).
- **Dati e spazio**: space used (`navigator.storage.estimate`), map images held (count, size), **«Proteggi i dati dallo sfratto»** (`navigator.storage.persist()`: the item the Faerûn plan needed), reset the foldable cards, delete the map images from this device (with confirmation; account copies stay), link to export and import characters.
- **Account**, **Ripristino** (every device setting back to default; characters untouched) and **Informazioni e licenze**: the SRD 5.1 CC-BY 4.0 attribution text, 5e-bits (MIT), Cinzel (SIL OFL 1.1), the unofficial-fan-app notice, the repository link.
- **Decisions**: no option to hide the vital strip (damage and healing live only there), no start-page choice, no language (the app is Italian). Ideas left: choose the start tab, a high-contrast theme, default weight unit for new characters, an «export everything» button here.
- **Checked** in the browser: each control changes the page (font size, density variable, corner ornaments gone, theme, stored values), no overflow on seven pages at the largest text, storage numbers, fold reset, full reset. Not checked: the vibration itself (no phone), the look on screen.

### Animations forced on (2026-10-14, owner's request)

The «Animazioni» switch under the die is gone and the animations are **always on**: the dice, the rune ring, embers, rising cards, sparkles, the page transition, and the old pop of the roll strip, whatever the system's «reduce motion» says (the code that obeyed it was removed: `motionPref.ts`, `DiceMotionControl`, the `html[data-motion]` rules and the two `prefers-reduced-motion` blocks). Trade-off to remember: people sensitive to motion have no way to turn it off in the app.

### Fantasy look, third pass and full-screen map (2026-10-14)

- **Full-screen map**: a ⛶ button in the zoom group of every map. The map covers the whole window (and asks the browser for real full screen where it exists, so not on iPhone), the page does not scroll behind it, Escape leaves, and an overlay keeps «Aggiungi segnalino» and the pin panel reachable. A page animation on an ancestor would have trapped the fixed frame (found by measuring); `:has(.map-frame.full)` switches it off. Checked: the frame covers 1707×842 from 0,0; the image itself could not be checked here (a background tab does not run ResizeObserver).
- **Icons**: eight spell-school glyphs (spell lists, picker, spell window) and fourteen condition glyphs plus exhaustion (condition chips, active effects, and **the vital strip shows the active conditions as icons**), `src/features/icons/Glyphs.tsx`.
- **Colour by class**: `src/domain/classTheme.ts` (12 SRD classes, Italian or English, tested) tints the vital strip (border, avatar ring, HP number) with the colour of the character's first class.
- **Sparkles** around the die on a critical hit (not for the roll already on screen when the page opens, and not with animations off).
- **Grain** on the cards (an inline SVG noise, no image file), a **fading rule** after every card subtitle, an **ornament** above the footer.
- **Light theme «pergamena»**: sun/moon button in the header (`dnd-companion:theme`). Contrast audit of all visible text on Tiri, Scheda, Combattimento, Grimorio, Zaino and Mappe, in both themes: all at 4.5 or more (an early audit flagged the header and the footer, which was a transition frozen in the background tab, plus the gold text: darkened). The die and the map controls keep their dark faces. Pages not audited: Gruppo, the sign-in page, dialogs other than the spell window.
- **Page transition** (done): choosing a tab runs the page change inside a View Transition (old page fades up, new one slides in; header, tabs and vital strip stay still), started from the tab click handler because React Router does not do it with this router; off with the Animazioni setting, plain switch where the API does not exist. Checked: the transition is started on a tab click and not on ctrl-click.
- Still open: ornate corner flourishes on the main title, a dark-red theme for the Master section, a map frame with a compass rose, sound (optional, off by default).

### Fantasy look, second pass (2026-10-14, bolder)

- **Why it felt static** (history): this PC has Windows «reduce animations» on and the app obeyed it. Since replaced by always-on animations (see above).
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
5. **I5** (done) Bestiary (monster list first, party bestiary second): first feature with shared data written by every member; reuses the pins pattern.
6. **I7** (read, treasure, trades done; DM changes on players not enabled) Master: needs the commands channel and a privacy decision, builds on all of the above; last of the sync features.
7. **I1** Faerûn bulk import: best done together with the PWA phase (offline shell), since offline is part of the request.

Status: nothing started yet (only registered).

## PDF export and the name "D&D Pocket" (2026-10-14)

- The app is officially called **D&D Pocket** (title, README, header, credits). Storage keys (`dnd-companion:*`, IndexedDB `dnd-companion-*`) keep the old prefix on purpose: renaming would drop users' data.
- Settings → Dati e spazio → **Esporta tutto**: one decorated A4 PDF with every character, built in the browser (`src/pdf/`, lazy-loaded; main bundle unchanged). Per character: front page (classic sheet), traits/features/notes (with portrait and figure if present), spells (slots, DC, list by level, then full SRD text; skipped for non-casters), backpack (coins, totals, items by container). A cover with an index only when there are several characters.
- Layout in `draw.ts` (top-left coordinates over pdf-lib), `flow.ts` (columns and page breaks), pages in `sheetFront/Back/Spells/Pack.ts`, `cover.ts`, `exportPdf.ts` (pure `buildPdf`), `exportAll.ts` (browser: gathers data, fonts, download). Cinzel fonts embedded as subsets; body text uses standard PDF fonts (unsupported glyphs are replaced).
- Layout was checked by rendering the pages to images (Windows.Data.Pdf), not only by tests. Tests: page counts, cover, non-caster, missing catalogue, portrait embedding, odd glyphs.
- New dependencies, asked for explicitly by the user: `pdf-lib` 1.17.1 and `@pdf-lib/fontkit` 1.1.1 (both MIT).

## Roll strip stays in view (2026-10-15, owner's request)

On Scheda and Combattimento the last-roll card (total, formula, Normale / Vantaggio / Svantaggio) now sticks right under the vital strip. It had `position: sticky; top: 0` but sat inside the page grid (a sticky grid item can only move inside its own row) and under the vital strip. Now `RollStrip` renders a `roll-strip-wrap` before the `<main>`, and `VitalStrip` publishes its height as `--vital-h` (ResizeObserver) for the offset. On a 390 px phone the two together take about 186 px.

## Owner's requests of 2026-10-15 (evening)

- The Combattimento tab is called **«Combat»** (the label overflowed its box on a phone; the page title too). The route stays `/combattimento`.
- Tiri: **Storico shows 3 rolls** (was 5) and sits **under the Vassoio dei dadi** (right column; on a phone: die, tray, history).
- **The Gruppo tab opens the party used last** (`src/data/lastParty.ts`, key `dnd-companion:last-party`): remembered when a party page has loaded, forgotten when the party is left, deleted or gone. Only when signed in; the «← I miei gruppi» link and the URL `#/gruppo` still show the list.
- **Swipe between sections** (`src/components/swipe.ts`, used by `TabNav`): a quick sideways swipe (at least 80 px, clearly more horizontal than vertical, under 0.7 s) goes to the next or previous section in the tab order Tiri, Scheda, Combat, Zaino, Grimorio, Bestiario, Mappe, Gruppo. It is ignored when it starts on a field, a map, a dialog or a sideways-scrolling element, when a dialog is open, and on pages that are not a section root (a map, settings, characters). Checked with synthetic touch events (left, right, diagonal, on a field); not tried on a real phone. No animation of the page following the finger.

## PWA: thinking (2026-10-15), nothing built yet

**What exists**: a static site on GitHub Pages under `/dnd_app/` (`VITE_BASE` from the workflow), `HashRouter` (no server-side routing to worry about), Firestore with a persistent local cache (own data already works offline once loaded), an IndexedDB store for map images and portraits, `navigator.storage.persist()` in Settings, `viewport-fit=cover` and `theme-color`. **Missing**: web manifest, PNG icons, service worker, install prompt. Build: main chunk 1,2 MB (366 kB gzip), `exportPdf` 403 kB and `fontkit` 711 kB lazy, `public/srd/monsters.json` 451 kB and `spells.json` 360 kB fetched when their tab opens.

**Plan, in order (each step usable on its own)**
1. **Manifest and icons** (S, no dependency): `manifest.webmanifest` with `name` «D&D Pocket», `short_name`, `start_url` and `scope` `./` (so it works under `/dnd_app/`), `display: standalone`, `theme_color` and `background_color` `#1b1a2e`, icons 192 and 512 plus a maskable one and an `apple-touch-icon` 180, all drawn from `favicon.svg` (gold d20 on indigo). The PNGs need a one-off render (a script with a dev dependency such as `sharp`, or by hand from the browser).
2. **Service worker** (M): precache the built shell (HTML, hashed JS and CSS, fonts, the lazy chunks including the PDF ones, so «Esporta tutto» works offline); `public/srd/*.json` stale-while-revalidate; **never** touch Firestore and Auth traffic (the Firebase SDK manages those). Two ways: (A) `vite-plugin-pwa` (Workbox: generates the precache list, handles updates; a dev dependency to check against Vite 8) or (B) a hand-written `sw.js` with a tiny Vite plugin that lists the files (no dependency, about 80 lines, more upkeep). I lean towards A.
3. **Updates**: a notice «Nuova versione disponibile · Aggiorna» instead of reloading by itself, so nobody loses a typed note mid-edit; the SW checks on page open and on focus.
4. **Install and iOS** (S): `beforeinstallprompt` button on Android/desktop (in Settings and, once, as a hint), a short how-to for iOS («Condividi → Aggiungi alla schermata Home»), and the iOS meta tags (`apple-mobile-web-app-capable`, status bar style). iOS clears site data after about 7 days without use unless the app is on the home screen, which is the real reason to install; `storage.persist()` helps on Android/desktop only.
5. **Offline pass** (S): airplane-mode test of every tab (dice, sheet, backpack, spells, bestiary list, own maps, PDF export); what cannot work offline says so (sign-in, joining a party, party data not yet loaded). The sync badge already says «Offline».
6. Then the Faerûn bulk import (I1), which only makes sense once the shell is offline.

**Risks**: a stale SW after a deploy (hence step 3 and hashed file names); the SW scope has to be `/dnd_app/` and registration must use `import.meta.env.BASE_URL`; the SRD JSON needs revalidation or a version in its name; dev mode has no SW (test with `vite preview`); GitHub Pages cache headers are fixed; bigger CI artefact.

**Decisions needed from the owner**: (a) may I add `vite-plugin-pwa` (and a dev dependency to render the PNG icons)? (b) are the icons OK as the gold d20 on indigo of the favicon? (c) update by notice (recommended) or silently on next launch?

## Dependencies

Runtime: react, react-dom, zustand. Dev: vite, @vitejs/plugin-react, typescript, vitest, eslint (+ @eslint/js, typescript-eslint, react-hooks, react-refresh, globals), @types/*.
Phase 1 added: firebase, react-router (v8, `HashRouter` from `react-router`), dev: firebase-tools, @firebase/rules-unit-testing. Phase 2 and 3 added nothing. Ask before adding anything else. The PDF export added pdf-lib and @pdf-lib/fontkit (lazy-loaded).

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

# UX/UI review – D&D Pocket (2026-10-15)

URL reviewed: https://solforio.github.io/dnd_app/ (hash routes: #/, #/scheda, #/combattimento, #/zaino, #/grimorio, #/bestiario, #/mappe, #/gruppo)

## 0. Scope and method
- Desktop (1568x773): Tiri, Scheda, Combattimento, Zaino, Mappe, with the default empty character ("Nuovo personaggio", level 1, all zeros).
- Mobile: emulated by loading the site in iframes of 390x844, 375x667 and 360x640 px (width media queries apply; no real touch, no safe-area, no browser chrome). All 8 routes were checked at 390 px; Tiri also at 375 and 360 px.
- Sizes, fonts and contrast were measured from the DOM (computed styles). Desktop-only observations from the first pass were judged by eye.
- NOT verified: real device / touch behaviour, safe-area insets, landscape, light theme on mobile, a populated character (many items/spells/attacks), a spellcaster Grimorio, a monster detail in Bestiario, logged-in state of Gruppo, prefers-reduced-motion handling.

## 1. Overall impression
Strong, coherent fantasy identity (dark violet + gold, serif small caps, corner-bracket cards, per-tab accent colour and background hue). The hero die is the right focal point. Sticky HP/AC bar and the persistent roll-mode strip (Normale/Vantaggio/Svantaggio) are the right choices for use at the table. Main opportunities: make the roll screen unambiguous, fix the mobile layout (header weight, hidden tabs, horizontal overflow), and polish consistency and onboarding.

## 2. What works well (keep)
- Coherent, memorable visual identity; not a template look.
- HP/AC bar visible on every tab; roll strip repeated on Scheda and Combattimento.
- Saved rolls with real formulas (e.g. "Spada lunga: attacco 1d20+7") and free formulas (4d6kh3).
- Useful empty states with CTAs ("Lo zaino è vuoto…", "Aggiungi oggetto"); Gruppo clearly explains it needs an account and offers "Accedi o registrati".
- Zaino: kg/lb switch, capacity from Strength, weight bar.
- Transparent storage status ("Solo su questo dispositivo") next to Accedi.
- Existing accessibility basics (nothing to add): aria-live regions (4), aria-label on icon buttons ("Passa al tema pergamena", "Impostazioni"), aria-current="page" on tabs, 16 px inputs (no iOS zoom), light theme available.
- Secondary text contrast is good (measured: tab labels 8,3:1, fold summaries 7,4:1, footer note 8,3:1). Die-face numerals are decorative.
- Mobile: Scheda, Combattimento, Zaino, Mappe and Gruppo collapse cleanly to one column with no horizontal overflow; ability scores 3x2 grid and condition chips wrap well; Bestiario cards are dense but clear (GS, type, size, AC, HP; "334 mostri" counter).

## 3. Findings and tasks

### Phase 1 – Dice roll screen (Tiri) 🔴
- [x] (done 2026-10-15: the die drawn is the first die of the chosen formula, the result block is labelled «Ultimo tiro»; checked with 1d12+1d4) Two formulas are shown at once ("Tocca il dado per lanciare 1d20" above, "1d12+1d4" below); the die drawn is a d12 while the hint says 1d20; the big number is the previous result. Show ONE active formula; label the previous result ("Ultimo tiro"); make the drawn die match the die that will be rolled.
- [ ] Result with breakdown (e.g. "8 + 2"); nat 20 gold glow and nat 1 red tint (d20 only; for advantage/disadvantage evaluate the kept die).
- [x] (done 2026-10-15: Storico is now under the die in the left column; tray, free formula, saved rolls and Gestione PF in the right one; history still shows 5, not 3) Move "Storico" next to/under the die. Desktop: right column is mostly empty while Vassoio dei dadi and Formula libera sit below the fold on the left; move them to the right column. Mobile order: die -> mode -> last 3 history -> tray.
- [x] (done 2026-10-15: 4 columns = 4+3, count badge on each die, a hint line, − buttons 40 px; no long-press reset) Dice tray: orphan d100 (6+1 on desktop, 3+3+1 on mobile). Use 4+3 / 4 columns. Unclear affordance for adding dice (only "-" and a small "×1"): show visible +/- or a counter badge; long-press resets. The "-" buttons are 32 px high on mobile (x7).
- [x] (done 2026-10-15: 44x44 button, an «Annulla» line for 8 s via `restorePreset`) Saved rolls: the × button is tiny and deletes without confirmation -> 44x44 hit area + undo toast.
- [x] (partly, 2026-10-15: shorter subtitle, chevron 1.25rem; the empty strip under the header was not reproduced) Collapsed cards ("Gestione PF", "Formula libera"): truncated subtitle ("riposo …"), tiny chevron (15x21), empty strip under the header -> shorter subtitle, larger chevron, no extra height when collapsed.

### Phase 2 – Mobile layout, navigation, HP bar 🔴
- [x] (done 2026-10-15: `.fold > *` and the fold button get `min-width:0`; scrollWidth equals clientWidth on /, /scheda, /bestiario, /gruppo at 360/375/390) BUG: horizontal overflow on Tiri. The `.fold-head` / `.fold-summary` of the collapsible card ("Gestione PF") is 467 px wide in a 371 px viewport; the document scrolls sideways (scrollWidth 499 vs clientWidth 371; reproduced at 341, 356, 371 px). Fix with `min-width:0`, ellipsis or hiding the summary under ~480 px. Acceptance: scrollWidth === clientWidth on every route at 360/375/390.
- [x] (done 2026-10-15, CSS only in `extras.css`: header 207 → 57 px, strip 146 → 89 px, die fully visible at 360x640; strip not yet at 72 px (two rows); no "⋯" menu, the sync text became a dot with a tooltip, the username is hidden under 600 px) Mobile chrome is too tall: header 207 px + tab nav 56 px + sticky vital strip 146 px = 409 px before content. At 360x640 and 375x667 the hero die is cut in half on first load (the sticky strip alone is 23% of a 640 px screen). Make the header a single row (logo + character select + "⋯" menu with theme, settings, storage status, Accedi); compact sticky strip ≤ ~72 px (name + PF text + bar on one line; amount input + Danno/Cura + CA on the second). Target: die and formula fully visible on first load at 360x640.
- [x] (done 2026-10-15: up to 700 px a **bottom bar** with Tiri, Scheda, Combattimento, Zaino and «Altro» (a sheet with Grimorio, Bestiario, Mappe, Gruppo), safe-area padding, `viewport-fit=cover`; the top bar remains on wider screens, with the active tab scrolled into view, 12 px labels and edge fade; checked by measuring, not by screenshot, the screenshot tool timed out) Tabs: 8 tabs, nav scrollWidth 589 vs 371 visible, so Bestiario, Mappe and Gruppo are hidden; the active tab is NOT scrolled into view (scrollLeft stays 0 even when Bestiario/Mappe/Gruppo is active); no scroll hint; labels are 10,9 px. Preferred: bottom nav (Tiri, Scheda, Combattimento, Zaino + "Altro" sheet with Grimorio, Bestiario, Mappe, Gruppo), safe-area aware. Minimum: scrollIntoView({inline:"center"}) on route change, edge fade, labels ≥ 12 px.
- [x] (done 2026-10-15: placeholder «Valore», softer disabled look, ±1 and ±5 buttons in the strip from 601 px up; hidden on phones to keep the strip at two rows) HP controls: Danno/Cura are `disabled` (opacity 0,45) while the amount field is 0, so they look permanently inactive -> add placeholder "Valore" and quick buttons -1, -5, +1, +5.
- [x] (done 2026-10-15: `mid` class ≤ 50%, `low` ≤ 25%; only in the vital strip, party cards unchanged) HP bar colour by threshold: green > 50%, yellow 25-50%, red < 25% (keep the "x/y PF" text; never rely on colour alone).

### Phase 3 – Text size, tap targets, readability 🟡
- [x] (done 2026-10-15: no visible text under 12 px on the eight routes; the logo name and the sync text are hidden on phones on purpose) Tab labels 10,9 px -> ≥ 12 px; labels 13-14 px; body 16 px; nothing below 12 px (other than decorative elements).
- [x] (done 2026-10-15: `::placeholder` uses `--muted`, measured rgb(185,173,150) on the dark inputs) Placeholder colour (#757575 on dark inputs, ≈ 3,9:1) -> ≥ 4,5:1.
- [x] (done 2026-10-15: on touch screens and up to 700 px every button, select, input and link-button is at least 44 px tall; the two round header buttons stay 36 px with a 44 px hit area; inline text links are left alone; the vital strip grew from 89 to 93 px and the header from 57 to 61) Tap targets to 44x44 hit area (padding is enough; most are 36-40 px, above the WCAG 2.2 AA minimum of 24 px, so this is polish): header icons 36x36, fold chevron 15x21, preset/saved-roll chips (37 px), saved-roll ×, characteristic chips in Combattimento (65x36), "-" buttons (32 px).
- [x] (done 2026-10-15 with a `Hint` component: one short line and a «?» that opens the text; on Mappe, Combattimento, Grimorio, Bestiario) Long grey help paragraphs (Mappe, Combattimento, Grimorio, Bestiario intro) -> one short line + "?" tooltip/disclosure.
- [ ] (not applicable: the owner asked for animations always on, see «Animations forced on») Verify prefers-reduced-motion disables the dotted ring and roll animation (not verified).

### Phase 4 – Consistency 🟢
- [x] (done 2026-10-15: `button.primary` is the same gold gradient, 44 px tall, in every section and in both themes; the section accent no longer tints it; checked on Tiri, Combat, Zaino, Mappe) One primary-button style (height, radius, fill, hover/active) for "Lancia", "Inizia combattimento", "Aggiungi oggetto", "Scegli le immagini"; per-tab accent only for titles, borders, background tint.
- [x] (done 2026-10-15: tokens `--content-max` 1100 px and `--content-narrow` 820 px; sections use the wide one, single-column list pages (Mappe, Bestiario, Personaggi, Impostazioni, group list) the narrow one, on purpose) One content max-width rule; document the exception for single-column pages (Mappe is a narrow centred column on desktop while Tiri/Scheda/Combattimento use wide two-column layouts).

### Phase 5 – Onboarding, data safety, page-specific polish 🟡
- [ ] First run: guided setup (name, class, level, ability scores) or at least a primary "Crea il tuo personaggio" CTA in empty states instead of the secondary "Modifica la scheda".
- [ ] Replace the footer note repeated on every page ("I dati restano su questo dispositivo…") with a dismissible backup banner (first use + every 14 days) with an "Esporta backup" button. Data lives only on the device: loss risk is the biggest.
- [ ] Bestiario: native list bullets show outside the monster cards (reset `list-style`); 334 cards in a long scroll -> consider sticky search, remembered filters, jump by letter or windowing.
- [ ] Grimorio: "Nessuna classe incantatrice riconosciuta" appears twice in consecutive cards and the Slot card has a large empty gap -> single empty state with CTA to Scheda; shorten instructions.
- [ ] Gruppo: fine; only the repeated footer note (see the backup banner above).

## 4. Priority order
1. Fix the horizontal overflow on Tiri (bug, small change).
2. Compact mobile header + sticky strip so the die is visible on first load.
3. Tabs reachability on mobile (bottom nav or scrollIntoView + fade + larger labels).
4. Unambiguous roll screen (single formula, matching die, breakdown, nat 20/1, history next to the die, tray grid).
5. Text sizes, placeholder contrast, tap targets.
6. Consistency (buttons, widths), then onboarding and backup banner, then Grimorio/Bestiario polish.


# Code review – D&D Pocket (2026-10-15)

Scope: whole repository (222 tracked files, ~20k lines of TS/TSX), main at 47309bd. Method: read of `firestore.rules`, `.github/workflows/deploy.yml`, `src/data/*`, `src/domain/sync.ts`, `src/App.tsx`, build output; typecheck, lint, 273 tests and `vite build` all run clean. Not covered: line-by-line read of every feature component, real-device behaviour.

## Strengths (keep)
- **Layering**: `domain/` (pure rules, no React or Firebase), `data/` (stores and repos), `features/` (UI). Rules like dice, HP, rests, spell slots, loot, trades are testable and tested (27 test files, 273 tests, ~3.7 s).
- **Quality gate in CI**: typecheck, lint, unit tests, Firestore rules tests on the emulator, then build, and only then deploy. Strict TS, no `any`, one single `eslint-disable`.
- **Firestore rules are serious**: `hasOnly` key whitelists, size limits, immutable fields (`createdAt`, `username`, `joinCode`), atomic batches checked with `getAfter/existsAfter`, one-shot treasure claim, per-user trade visibility, DM-only reads for the master view.
- **Data safety**: schema versioning (`migrate.ts`, `sanitize.ts`), unreadable documents kept and written back untouched, debounced writer with injected clock, explicit upload plan that never overwrites by itself (`planUpload`).
- **Security hygiene**: no `dangerouslySetInnerHTML`/`eval`, no secrets committed (the web API key is public by design), copyrighted map images git-ignored.
- **Offline-first and cost-aware** (Spark plan, no Functions, no Storage): images chunked in Firestore, join codes instead of invites, comments on read costs of rules.
- **Documentation**: PROGRESS.md records decisions and the reasons for them.

## Weaknesses and risks
1. **Bundle size / no code splitting** (build output): main chunk 1,218 kB (364 kB gzip), `fontkit` 711 kB. `App.tsx` imports every page statically (no `React.lazy`). Vite also warns `INEFFECTIVE_DYNAMIC_IMPORT`: `pdf-lib` is imported statically by `src/pdf/draw.ts`, so the "lazy" PDF export does not move it out of the main chunk for everything that touches `draw.ts`. Slow first load on mobile data.
2. **Errors are swallowed**: 51 bare `catch {}` (e.g. `lootStore.ts` ×6, `bestiaryStore.ts` ×4, `partyStore.ts` ×3, `imageStore.ts` ×3, `localStore.ts` ×3). Some are right (localStorage unavailable), but in the party/loot/bestiary stores a failed write is invisible to the user and to `SyncStatus`.
3. **Test gap on the layer that breaks most**: the 27 test files cover `domain/` and `pdf/`; `data/` (`session.ts` 314 lines, `partyRepo.ts` 521, `partyStore.ts` 474, `characterStore.ts`) and all of `features/` have no unit tests (only dice geometry). No end-to-end test of login → sync → party flows.
4. **Multi-device conflicts**: characters are saved whole, keyed by `updatedAt` (last write wins). Two devices editing the same character offline can silently lose changes. To verify in `session.ts`/`characterRepo.ts` before deciding on a fix.
5. **Firestore rules are not deployed by CI**: `deploy.yml` publishes only GitHub Pages. Rules tested in CI can differ from the ones live in Firebase (drift), and a rules change needs a manual `firebase deploy --only firestore:rules`.
6. **Rule gaps (low severity, quota/abuse rather than leaks)**:
   - `masterview.character is map`, `trades.item is map`, `treasure.items is list` have no content/size bound beyond the 1 MiB document cap; `validCharacter` checks only `id`, `schemaVersion`, `name`, `updatedAt`.
   - `log` and `pins` `delete` do not require `isMember(pid)`: a member who left can still delete their own old entries (harmless, but inconsistent with the rest).
   - Many `get()/exists()` per request count as document reads on Spark (the file already notes it); `isMember` is evaluated on every read of every party subcollection.
   - The public API key has no App Check or HTTP-referrer restriction mentioned anywhere.
7. **Accounts without recovery**: synthetic email `username@dnd.local`, min 6-char password, so no password reset. Forgotten password = account (and cloud copy) lost. Combined with local-only data for logged-out users, data loss is the top product risk (already in the UX review as the backup banner).
8. **Large modules**: `partyRepo.ts` (521), `partyStore.ts` (474), `domain/party.ts` (439), `MapPage.tsx` (346) mix several concerns (members, treasure, trades, quests, log, maps). Fine today, costly when Phase 5 (notes) lands.
9. **Hygiene**: package still named `dnd-companion`, version `0.0.0`; `cowork-prompt-dnd-app.md` and a long chronological PROGRESS.md (440+ lines, partly in English, partly Italian UI strings) make the entry point hard to read; `react-hooks/exhaustive-deps` disabled in `MapPage.tsx:55`; user-facing strings are hard-coded Italian (no i18n layer, fine if Italian-only is a decision, but it should be written down).

## Possible changes (proposed, nothing applied yet)
Priority: P1 = do soon, P2 = next, P3 = when convenient.

- [ ] **P1 Code splitting**: `React.lazy` + `Suspense` for pages other than Tiri/Scheda (Mappe, Gruppo, Bestiario, Grimorio, Impostazioni); make `draw.ts` get `pdf-lib` only through the dynamic import (or move PDF code into one lazy entry) so `exportPdf`/`fontkit` leave the main chunk. Goal: main chunk < 500 kB. Check with `vite build`.
- [ ] **P1 Stop swallowing write errors** in `lootStore`, `bestiaryStore`, `partyStore`, `imageStore`: route failures to a shared error/`SyncStatus` path (toast or badge) and keep `catch {}` only for storage-unavailable cases, each with a one-line comment saying why.
- [ ] **P1 Backup banner + "Esporta tutto"** reminder (from the UX review, item 5) and a documented recovery story for forgotten passwords (e.g. export before sign-up prompt, or an optional real email field with Firebase password reset).
- [ ] **P1 Deploy rules from CI**: add a job (on `main`, after `test:rules`) running `firebase deploy --only firestore:rules,firestore:indexes` with a `FIREBASE_TOKEN`/service-account secret; or at least a documented manual step in README.
- [ ] **P2 Tests for the data layer**: `session.ts` (login/logout, flush, upload plan), `partyRepo` batches (against the emulator, like the rules tests), `characterStore` actions (`levelUp`, rests, `addImported`). Then a few Playwright smoke tests (roll a die, create character, export PDF).
- [ ] **P2 Conflict handling for characters**: compare `updatedAt` on write (transaction or `serverTimestamp` check) and show "modified on another device: keep mine / take theirs" instead of silent overwrite. Decide after verifying point 4.
- [ ] **P2 Tighten rules**: size caps for `masterview.character`, `trades.item`, `treasure.items[*]`; `isMember(pid)` on `log`/`pins` delete; consider App Check or at least restrict the API key by HTTP referrer in Google Cloud. Add a rules test for each change.
- [ ] **P2 Split the party layer**: `partyRepo.ts`/`partyStore.ts` into `party/members`, `party/loot` (treasure + trades), `party/story` (quests + log), `party/maps`, before Phase 5 adds notes.
- [ ] **P3 Cleanup**: rename package to `dnd-pocket` (keep the `dnd-companion:local` localStorage key, renaming it would orphan saved data); move `cowork-prompt-dnd-app.md` to `docs/`; split PROGRESS.md into "current status / next steps" (top) and an archive of decisions; remove or justify the `exhaustive-deps` disable in `MapPage.tsx`.
- [ ] **P3 i18n decision**: write down that the UI is Italian-only, or extract strings to a dictionary before adding a second language.
