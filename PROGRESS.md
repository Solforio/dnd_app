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
| maps (requested before 5 to 7) | next: plan first |
| 5+: notes, codex, PWA | not started |

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

## Dependencies

Runtime: react, react-dom, zustand. Dev: vite, @vitejs/plugin-react, typescript, vitest, eslint (+ @eslint/js, typescript-eslint, react-hooks, react-refresh, globals), @types/*.
Phase 1 added: firebase, react-router (v8, `HashRouter` from `react-router`), dev: firebase-tools, @firebase/rules-unit-testing. Phase 2 and 3 added nothing. Ask before adding anything else.

## Open questions

- Hit dice tracking (spend on short rest, recover half on long rest): not in the brief, propose it if the user wants it.

## Next step

1. User tries the inventory, the quick HP bar and the 3D die on https://solforio.github.io/dnd_app/.
2. Maps: write the plan (personal and party maps, sub-maps of cities, pins, Firestore layout and rules for party pins, quota) and wait for approval. The user is gathering the map images.

## Backlog (user requests, 2026-10-13)

Order chosen by the user: 1) HP visible on phones (done), 2) 3D dice animation (done), 3) Phase 4 inventory (done), 4) maps (next).

- **Maps (requested early)**: interactive Faerûn map with city sub-maps, clickable; pins on a personal map and on a shared party map. Constraints: no WotC map images in the repo (user loads their own image, kept in the browser, or a fan map with a compatible licence); no Cloud Storage (needs Blaze), so a shared map image cannot be uploaded: pins are shared through Firestore with coordinates relative to the image, each member loads the same image locally. Plan with a quota estimate before building.

- **Dice animation**: done: `Die3D` + `d20geometry.ts`, a real icosahedron projected into SVG each frame (no library), tumbles ~1,1 s and lands with the natural d20 face in front showing the total; none with reduced motion, and the roll already on screen at page load does not tumble.
- **HP on phones**: done: `HpQuick`, sticky at the top of the Tiri page below 860 px, with quick damage and healing.
