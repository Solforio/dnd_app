# Project brief: D&D 5e player companion web app (v3)

You are building a web app for a Dungeons & Dragons 5th Edition player and his group of friends. This document is your full context. Read it completely before writing any code, then follow the "How to work" section.

**This is a fresh start.** An earlier single-file HTML prototype exists, but it is NOT the base of this project and you will not receive it. Do not look for it, port it, or keep compatibility with it. Everything is built from zero on the stack in section 4. The behaviour it proved out is captured as requirements in section 3.

## 1. Goal

A web app, hosted for free, that gathers everything a D&D player needs at the table. Friends create an account (username and password) so their characters are saved in the cloud and available from any device. Players can also join one or more **parties** and see a shared group screen. It must work well on a phone and keep working when the connection drops.

Modules, in the order they will be built:

1. **Dice + HP + roll history** (section 3)
2. **Accounts and cloud save** (section 5)
3. **Character sheet**, multi-character: ability scores, proficiency bonus, saving throws and skills calculated automatically, AC, initiative, speed, attacks, features and traits, conditions. Every value is clickable and rolls into the dice module.
4. **Parties** (section 6): create or join one or more parties, with a group screen shared by all members
5. **Inventory and weight**: items with weight, quantity, value, category; carrying capacity; coins; containers; attunement
6. **Notes**: Markdown, organized by session, with tags and full-text search
7. **Bestiary and grimoire**: SRD data, filters, favourites, personal notes, known/prepared spells linked to spell slots
8. **Maps**: Faerûn plus individual cities, clickable pins, updatable as the campaign advances
9. **PWA**: installable, offline, polish

## 2. Hard constraints

- **Zero cost, forever.** The app must never require a paid plan or a credit card. Frontend on GitHub Pages. Backend on the **Firebase Spark (free) plan only**. Do NOT enable the Blaze plan. Do NOT use Cloud Functions, Cloud Storage for Firebase, or any other service that needs Blaze or a linked billing account. If a feature would need one of them, stop and tell me, and propose an alternative.
- **Stay inside the free quotas.** Spark has hard daily caps shared by the whole project (as of autumn 2026, roughly 1 GB of Firestore storage, 20.000 writes and 50.000 reads per day; verify the current numbers in the Firebase console before relying on them). When a cap is hit the service stops until the reset. Design for few operations: debounced saves, one document per character, realtime listeners only on the screen that needs them and only while it is open, no polling. Remember that realtime listeners are billed per document delivered, and that `get()` and `exists()` calls inside security rules can count as document reads.
- **No data loss.** Every stored document carries a `schemaVersion`. Changing a data shape means writing a migration and a test, never breaking old data. JSON export and import of a character stay available as a manual backup and device transfer.
- **Offline first.** After the first load the app works with no connection and syncs when it returns. No runtime dependency on a CDN: bundle everything.
- **Copyright.** Official Wizards of the Coast maps and non-SRD text and art must NOT be committed to the repository. Maps: let the user load their own image (kept in the browser), or use fan-made maps with a compatible licence. Rules content: only the SRD 5.1 (CC-BY 4.0) as static JSON in the repo, with the required attribution visible in the app.
- **Dice must be fair.** Rolls use `crypto.getRandomValues` with rejection sampling. Never `Math.random`.
- **Accessibility floor.** Keyboard operable, visible focus, labels on every input, `aria-live` for roll results and status messages, `prefers-reduced-motion` respected, usable at 360 px width.
- **Security level.** Hobby app among friends, no sensitive data, so username and password is acceptable. Still: never commit secrets or service-account keys, keep Firestore rules strict, never log passwords.

## 3. Module 1 requirements: dice, HP, history

Build these from scratch as pure, tested TypeScript in `domain/`, with thin React components on top.

**Formula grammar.** Terms joined by `+` or `-`. A term is a flat integer, or `NdM` (N optional, default 1), optionally followed by `kh`, `kl`, `dh` or `dl` and an optional integer (default 1): keep or drop the highest or lowest dice. Examples: `d20+5`, `2d6+1d4+3`, `4d6kh3`. Limits: 1 to 100 dice per term, 2 to 1.000 sides. Invalid input produces a clear Italian message with examples. Whitespace and case are ignored.

**Roll engine.** Takes an injectable random function so it can be tested deterministically. Returns every term with every die (kept or dropped), the subtotal, the total, and crit and fumble flags.

**d20 mode.** A selector with normal, advantage and disadvantage. It applies to every single `1d20` term that has no keep or drop suffix: roll two dice and keep the higher (advantage) or lower (disadvantage). Dropped dice are shown struck through.

**Crit and fumble.** Detected only when exactly one d20 is kept in a term: natural 20 is a crit, natural 1 is a fumble. If both appear, crit wins.

**Dice tray.** Buttons for d4, d6, d8, d10, d12, d20, d100 with per-die counters (0 to 20) and a flat modifier, building a formula that can be rolled in one click.

**Result display.** The memorable element of the whole app: a large SVG d20 shows the last total. Gold with a glow on a natural 20, red on a natural 1, a short tumble animation on each roll (disabled with reduced motion). A line under it shows the formula and any advantage or disadvantage.

**Presets.** Named formulas, rollable in one click, deletable, savable from the tray or from the free formula field. Ship three examples (a long sword attack `d20+7`, damage `d8+4`, ability score generation `4d6kh3`).

**History.** The last 100 rolls: formula, optional label, mode tag, every die, total, time. Crit and fumble highlighted. Clearable with a confirmation.

**HP.** Current, maximum, temporary, all directly editable. Rules:
- Damage consumes temporary HP first. Temporary HP do not stack: a new value replaces the old one only if higher.
- Healing never exceeds the maximum. Healing from 0 HP resets the death saves.
- If the damage left over after reaching 0 HP is at least the maximum HP: instant death.
- Damage taken at 0 HP adds one death-save failure.
- Long rest: HP to maximum, temporary HP to 0, death saves reset.
- A status line (`aria-live`) explains every change in one sentence, for example how much damage the temporary HP absorbed.

**Death saves.** Three success and three failure toggles, plus an automatic d20 roll that is also logged in the history: 20 = back to 1 HP and saves reset; 1 = two failures; 10 or more = one success; otherwise one failure. Three successes = stabilized; three failures = dead. The roll button is disabled above 0 HP.

## 4. Stack (decided)

- **Vite + React + TypeScript**, strict mode on.
- **Routing:** `HashRouter` (GitHub Pages has no server-side routing). Set Vite's `base` to the repository name.
- **State:** React state plus a small store (Zustand is fine). No Redux.
- **Backend:** Firebase JS SDK (modular): Authentication (email/password provider) and Cloud Firestore. Nothing else.
- **Local development:** Firebase Emulator Suite (Auth and Firestore), so development never consumes the real quota.
- **Tests:** Vitest for all pure logic: formula parser, roll engine, HP rules, schema migrations, sheet calculations, party summaries. Firestore rules tested with the emulator. UI tests only where cheap.
- **Styling:** plain CSS (CSS modules or one stylesheet with the design tokens below). No UI kit, no Tailwind, unless I ask.
- **Deploy:** a GitHub Action builds the app and publishes it to GitHub Pages on every push to `main`.
- **PWA:** `vite-plugin-pwa`, added in the last phase, not before.
- **Dependencies:** keep them few. Ask before adding any library beyond the ones listed here.

Suggested structure (adjust after your plan is approved):

```
src/
  domain/      pure TypeScript: dice engine, parser, HP rules, sheet math, party summaries, schema + migrations
  data/        Firebase init, auth, Firestore repositories, local cache
  features/    dice/, hp/, sheet/, party/, inventory/, notes/, codex/, maps/, account/
  components/  shared UI
  styles/      tokens.css, global.css
public/        static SRD JSON, icons
```

Keep `domain/` free of React and Firebase imports so it stays testable.

## 5. Accounts and cloud save

### Sign-in model

Friends see only "username" and "password". Firebase Auth needs an email, so build a synthetic one: `<username>@dnd.local`.

- Normalize the username (lowercase; 3 to 20 characters; letters, digits, `_` and `-`). Validate before calling Firebase, with clear Italian error messages.
- Password: at least 8 characters, enforced in the UI.
- Sign-up and sign-in on one simple screen. The username shows in the header with an "Esci" button.
- **Verify early** that Firebase accepts the synthetic email format. If it does not, propose an alternative domain and tell me.
- There is no self-service password reset, because the email is not real. I reset passwords from the Firebase console. Say so on the sign-up screen in one sentence, and advise using a password not used elsewhere.

### Local-only mode

The app is usable without logging in: data lives only in the browser (IndexedDB or `localStorage`). On first login, offer to upload the local characters to the account. Never silently overwrite either side: ask.

### Private data layout

```
users/{uid}                          { username, createdAt, schemaVersion }
users/{uid}/characters/{characterId} { ...character state, schemaVersion, updatedAt }
users/{uid}/memberships/{partyId}    { partyId, name, role, joinedAt }     (see section 6)
```

- One document per character. History is capped at 100 entries inside it, so a document never approaches the 1 MiB limit. Never one document per roll.
- Use Firestore's built-in offline persistence (persistent local cache) instead of a custom sync engine.
- Debounce writes (1,5 to 2 seconds after the last change) and flush on `visibilitychange`.
- Conflict policy: last write wins, per character. Show a small sync status in the UI (saved, saving, offline).
- Decide, and ask me to confirm in your plan, whether dice presets belong to the character or to the user.

### Things only I can do (guide me step by step)

You cannot do these for me, and you must not create accounts on my behalf. Give me a short numbered checklist and wait for me to confirm each step:

1. Create a Firebase project on the Spark plan (no billing account).
2. Enable the Email/Password sign-in method.
3. Create the Firestore database and publish the security rules.
4. Add the GitHub Pages domain (`<user>.github.io`) to Authentication's authorized domains.
5. Copy the web app config into the project. This config is public by design and may be committed; security comes from the rules. Never ask me for, or commit, service-account keys or admin credentials.

## 6. Parties

Players can create parties and join parties, and see a group screen shared by every member. A user can belong to several parties (for example two campaigns), and picks which of their characters represents them in each one.

### Roles and permissions

- **DM** (the party's creator, `ownerUid`): edits party info, manages the quest board, regenerates or disables the join code, removes members, deletes the party. Can transfer ownership to another member.
- **Player**: reads everything in the party, edits only their own member card and their own session-log entries.
- Soft limits enforced in the UI only: 10 members per party, 10 parties per user. Say so in the plan; Firestore rules cannot enforce counts.

### The group screen ("Gruppo")

Minimum viable version, in this order:

1. **Header:** party name, campaign name, current location (set by the DM), next session (date, time, place, with a countdown), and the join code with a copy button.
2. **Member cards:** one per member with the character name, class and level, an HP bar with temporary HP, AC, passive Perception, active conditions, death-save state, and inspiration. Cards update live.
3. **Party at a glance**, computed on the client from the member cards, with no extra writes: average level, best passive Perception and who has it, which languages the party covers, which skills have at least one proficient member (and which have none), who has darkvision.
4. **Quest board:** active, completed, failed. Managed by the DM.
5. **Session log:** a diary of past sessions (title, date, text). Any member can add an entry; only the author or the DM can edit or delete it.

Later, one at a time, only after I ask and after you give me an estimate of the Firestore operations each would cost: a shared roll feed (players choose to share a roll), a shared initiative tracker, a shared stash with a gold ledger, shared map pins on the maps module.

### Privacy: what a member shares

Private character data is never readable by other users. What the group sees is a separate **summary** that the player publishes into the party. Each player controls it with a per-party sharing setting:

- HP visibility: exact values, status only ("sano", "ferito", "in fin di vita", "a terra"), or hidden.
- Which of the other fields to share (default: character name, class, level, HP status, conditions).
- Inventory, notes and anything not listed above are never shared in this module.

Summary fields: `characterName, class, level, hpCur, hpMax, hpTemp, ac, passivePerception, conditions[], deathSaves, inspiration, languages[], skillProficiencies[], darkvision`. Update it with a debounce of about 3 seconds, and only when a shared field has actually changed (not on every dice roll). Before the character sheet exists (Phase 2), the summary shows only what exists so far.

### Firestore layout

```
parties/{partyId}                  { name, campaignName, ownerUid, joinCode, joinEnabled, currentLocation,
                                     nextSession: { at, place, note }, schemaVersion, createdAt, updatedAt }
parties/{partyId}/members/{uid}    { username, role: 'dm' | 'player', characterId, summary, sharing,
                                     joinCode, joinedAt, updatedAt }
parties/{partyId}/quests/{questId} { title, description, status: 'active' | 'completed' | 'failed', updatedAt }
parties/{partyId}/log/{entryId}    { title, body, sessionDate, authorUid, authorName, createdAt, updatedAt }
partyCodes/{code}                  { partyId }
```

### Joining without Cloud Functions

Cloud Functions are not allowed, so joining works through security rules. This is a starting proposal: confirm it or improve it in your plan, and prove it with emulator tests.

1. The player enters the code. The client reads `partyCodes/{code}` (`get` allowed to any signed-in user, `list` denied). Codes are 8 characters from an unambiguous alphabet, so guessing is impractical.
2. The client creates `parties/{partyId}/members/{uid}` with `role: 'player'` and the code it used. The rule compares that code with the one on the party document using `get()`, and requires `request.auth.uid == uid`.
3. In the same batch, the client creates `users/{uid}/memberships/{partyId}`, which is how the app lists "my parties" without collection-group queries.

Creating a party is one batch: the party document, the `partyCodes` entry, the DM's member document, and the membership entry (use `getAfter()` in the rules where a batch depends on its own writes).

### Rules to implement and test

- A party document: readable by its members; created by any signed-in user as owner; updated or deleted only by the owner (changing `ownerUid` only through an explicit transfer).
- A member document: readable by members of that party; created as described above; updated only by its own user, who cannot change `role` or `username` after creation; deleted by its own user (leaving) or by the owner (removal).
- Quests: readable by members, written only by the owner.
- Log entries: readable by members; created by any member with `authorUid == request.auth.uid`; updated or deleted by the author or the owner.
- `partyCodes`: `get` by any signed-in user, `list` never; created and deleted only by the party owner.
- A non-member must not be able to read or write anything inside a party. Test it.

### Realtime and cost discipline

- Attach listeners only while the group screen is open, and detach them on leave. Listen to the party document, the members collection (at most 10 documents), active quests, and the 20 most recent log entries (paginate for older ones).
- Deleting a party means deleting its subcollections from the client in batches, because Firestore does not cascade. Implement it carefully and test it.
- Renaming a party updates the cached name in each membership lazily, when a member next opens the party.

### UI copy (Italian)

"Gruppo", "Crea un gruppo", "Unisciti con un codice", "Codice del gruppo", "Esci dal gruppo", "Prossima sessione", "Missioni", "Diario delle sessioni". Empty states invite an action ("Non fai ancora parte di un gruppo: creane uno o unisciti con un codice").

## 7. Product and design decisions already made

- **UI language: Italian.** Interface text uses Italian D&D terms (PF, CA, tiri salvezza, riposo lungo, vantaggio e svantaggio, and so on). Code, identifiers, comments and commit messages are in English.
- **Number format in the UI:** Spanish convention (comma for decimals, period for thousands) wherever a decimal or large number is shown, for example item weights and coin totals. Use one formatting helper (`toLocaleString('es-ES')` or equivalent), not scattered formatting. `es-ES` omits the thousands separator on four-digit numbers: decide on one rule for that case and apply it everywhere.
- **Visual identity:** dark indigo background with a gold accent, designed for table use. Tokens in `:root`:
  - `--bg #1b1a2e`, `--surface #26243d`, `--surface2 #312e50`, `--line #443f6b`
  - `--text #ece8f5`, `--muted #a29dc0`
  - `--gold #e3b341` (critical, primary action), `--red #e8705f` (damage, fumble), `--green #62c196` (healing)
  - Headings use a Palatino/Georgia serif stack; body uses the system sans-serif stack. No web fonts, so the app stays offline.
- **One memorable element:** the large SVG d20 result. Keep everything around it quiet. No decorative gradients, no shadows on every card, no animation that is not a direct answer to a user action.
- **UI copy:** sentence case, active verbs, buttons say exactly what they do ("Lancia", "Salva come preset"), errors say what went wrong and how to fix it, empty states invite an action.
- **Game rules:** carrying capacity is Strength × 15 lb, with the optional variant thresholds (encumbered above STR × 5, heavily encumbered above STR × 10) as a toggle. 50 coins weigh 1 lb. Maximum 3 attuned items.

## 8. Deployment

You write everything needed to deploy, I do the account-bound steps.

You provide: the GitHub Actions workflow (`.github/workflows/deploy.yml`) that builds and publishes to GitHub Pages, the Vite `base` setting, a `README` with exact commands (install, run with the emulators, test, build), and the Firebase checklist from section 5.

I do: create the GitHub repository, push the code, set Pages to deploy from GitHub Actions (Settings, Pages, Source), and the Firebase steps. You may run `git` locally and prepare clean commits, but never store or ask for my credentials; if a push needs authentication, tell me the command to run myself.

## 9. Roadmap

**Phase 0: scaffold and module 1.** Vite + React + TypeScript project, design tokens, Vitest, the deploy workflow, and module 1 (section 3) with local storage only.

**Phase 1: accounts and cloud save.** Firebase setup guide, sign-up and sign-in, local-only mode, Firestore repositories with offline persistence, sync status, rules and emulator tests, migration of local data to the account.

**Phase 2: character sheet and multiple characters.** Character list and picker, the sheet with automatic calculations, click-to-roll integration with the dice module.

**Phase 3: parties.** Section 6, minimum viable version. If I want parties before the sheet is finished, ship it with the reduced summary (name, HP, conditions) and extend it later.

**Phase 4 onward:** inventory and weight, notes, bestiary and grimoire, maps, PWA, then the optional party extras.

## 10. How to work

1. **Plan first.** Before coding a phase, write a short plan: data shapes, folder structure, UI layout (a quick ASCII wireframe is enough), and what you will touch. Show it to me and wait for approval on anything that changes the data model, the Firestore layout, the security rules, or the dependencies.
2. **Small, verifiable steps.** One coherent feature per iteration. After each step, tell me exactly how to run it and test it (what to click, what I should see), including the emulator commands.
3. **Pure logic first.** Rules and calculations live in `domain/` with tests. Components stay thin.
4. **Safe rendering.** Never inject user text as HTML. Avoid `dangerouslySetInnerHTML`; sanitize anything rendered from Markdown notes or party text. Imported JSON and anything read from a shared party is untrusted: validate and clamp it.
5. **Backward compatibility.** When a stored shape changes: add defaults, a migration, bump `schemaVersion`, and add a test that loads the older shape.
6. **Integrate, do not bolt on.** New modules talk to existing ones: sheet values roll through the dice engine, party summaries read from the sheet and HP, spell slots join the long-rest reset, inventory weight reads Strength from the sheet.
7. **Watch the quota.** Before adding any feature that reads or writes Firestore, state how many operations it costs for a typical session of a party of six.
8. **Do not silently change decisions.** If something in this document seems wrong or blocks you, say so and propose an alternative instead of working around it.
9. **Report at the end of each step:** what changed, what to test, what is still missing, and the suggested next step.
10. **Keep the project memory in the repository.** Maintain a `PROGRESS.md` at the root: what is done per phase, the decisions taken and why (data shapes, Firestore layout, rules), open questions, and the exact next step. Update it at the end of every working session. A new session, possibly with a different model, must be able to resume from this brief plus `PROGRESS.md` alone. Read `PROGRESS.md` first whenever it exists.
11. **Commit in small, named steps** (for example "Add dice parser with tests"), so I can go back to any working point. Never rewrite or delete history.

## 11. Definition of done for any task

- Works at 360 px and at desktop widths, keyboard-only, with visible focus.
- Type-check, lint and tests pass; no console errors.
- Loads with empty storage and with data saved by the previous version.
- Export then import of a character round-trips with no loss.
- Works offline after the first load and syncs when back online (from Phase 1).
- Security rules deny access to other users' data and to parties the user is not in (from Phase 1 and Phase 3).
- No request to anything other than the app's own files and Firebase.
- Copy in Italian, consistent with the terms already used in the app.

## 12. First task

Start with **Phase 0**, unless I tell you otherwise in my first message. Concretely:

1. Propose the folder structure, the TypeScript types for the character and the roll history, the `schemaVersion` and migration approach, and your answer to the open question about presets.
2. Wait for my approval, then scaffold the project, build module 1 from section 3 with tests for the parser, the roll engine and the HP rules, and add the deploy workflow.
3. Tell me how to run it locally and walk me through publishing it on GitHub Pages.

Ask me at most one clarifying question at a time, and only when the answer changes what you build.
