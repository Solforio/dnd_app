# PROGRESS

Read this file first, together with `cowork-prompt-dnd-app.md` (the brief). It is the project memory.

## Status

| Phase | State |
|---|---|
| 0: scaffold + module 1 (dice, HP, history) | **done**, published at https://solforio.github.io/dnd_app/ (repo Solforio/dnd_app) |
| 1: accounts and cloud save | not started |
| 2: character sheet | not started |
| 3: parties | not started |
| 4+: inventory, notes, codex, maps, PWA | not started |

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
- **Inventory (Phase 4, agreed with the user)**: weights are **always stored in pounds**; the UI shows and edits in kg or lb, kg by default, using the Italian Player's Handbook conversion **1 lb = 0.5 kg**. Capacity = STR × an editable coefficient (`capacityPerStrLb`, default 15, range 1 to 50, step 0.5, "Ripristina 15 lb" button), shown in the chosen unit (15 lb = 7.5 kg). The variant encumbrance thresholds are 1/3 and 2/3 of the capacity. Planned shape: `inventorySettings { weightUnit: 'kg'|'lb', capacityPerStrLb, variantEncumbrance }` in the character, with schemaVersion +1 and a migration.

## Dependencies

Runtime: react, react-dom, zustand. Dev: vite, @vitejs/plugin-react, typescript, vitest, eslint (+ @eslint/js, typescript-eslint, react-hooks, react-refresh, globals), @types/*.
Coming in Phase 1: firebase, react-router-dom, firebase-tools (emulator). Ask before adding anything else.

## Open questions

- Firebase: check that Auth accepts `<username>@dnd.local` (first step of Phase 1, in the emulator).

## Next step

1. User checks Phase 0 on the live site (done: Pages from GitHub Actions, first deploy green).
2. Phase 1: plan (Firebase checklist, rules, repositories, sync status) to approve before writing code.
