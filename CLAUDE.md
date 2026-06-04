# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start Vite dev server
npm run build    # Production build
npm run lint     # ESLint (--max-warnings 0; CI gate)
npm run preview  # Preview production build
```

No test runner is configured. Format with Prettier and ensure ESLint passes before committing. Codebase must be in English, including comments and variable names. Commit messages use present-tense imperative ("Add Spanish locale").

Docker: `docker build -t drawdb . && docker run -p 3000:80 drawdb`.

Sharing requires the external [drawdb-server](https://github.com/drawdb-io/drawdb-server) backend. Set `VITE_BACKEND_URL` (see `.env.sample`). Optional unless sharing files.

## Architecture

DrawDB is a client-side-only React (Vite) ERD editor and SQL generator. There is no app backend; all diagram state lives in the browser via IndexedDB. Routing is in `src/App.jsx`; the editor lives at `/editor`, `/editor/diagrams/:id`, `/editor/templates/:id`.

### State: nested React Contexts

The entire editor state is split across many Context providers, composed (deeply nested) in `src/pages/Editor.jsx`. Each context has a matching hook in `src/hooks/` (re-exported from `src/hooks/index.js`). Read/write diagram state through these hooks, never by reaching into providers directly.

Key contexts: `DiagramContext` (tables + relationships + selected `database`), `AreasContext`, `NotesContext`, `TypesContext` (custom types, for DBs where `hasTypes`), `EnumsContext` (for DBs where `hasEnums`), `TransformContext` (pan/zoom), `SelectContext`, `LayoutContext`, `SettingsContext`, `UndoRedoContext`, `SaveStateContext`, `CollabContext`.

Undo/redo is two plain arrays (`undoStack`/`redoStack`) in `UndoRedoContext`. Mutating hooks (e.g. `useDiagram`) push `Action`/`ObjectType`-tagged entries onto the stack; new diagram/template/gist loads reset both stacks.

### Persistence

`src/data/db.js` defines a Dexie (IndexedDB) database `drawDB` with `diagrams` and `templates` tables. **Bumping the schema requires incrementing the `db.version(N)` number and adding an `.upgrade()` migration** (current version is high — 67). `templates` are seeded on populate from `src/data/seeds.js`.

`src/components/Workspace.jsx` is the central orchestrator: its `save()`/`load()` callbacks map context state <-> Dexie records (note `relationships` is stored as `references`), handle autosave (driven by `SaveStateContext` + `settings.autosave`), gist sharing (`src/api/gists.js`), and loading templates/diagrams/shared gists by route. Save logic branches on a `cloudSave` extension (see below) before falling back to Dexie.

### Database dialects

Supported dialects are the `DB` enum in `src/data/constants.js`; per-dialect capability flags (`hasTypes`, `hasEnums`, `hasArrays`, `hasUnsignedTypes`, `beta`) live in `src/data/databases.js`. Capability flags gate UI and save/load behavior throughout — check them rather than hardcoding dialect names.

Import/export is organized one file per dialect with an `index.js` dispatcher:
- `src/utils/importSQL/` — parse SQL (via `node-sql-parser` / `oracle-sql-parser`) into a diagram, then `arrangeTables`.
- `src/utils/exportSQL/` — generate SQL per dialect.
- `src/utils/exportAs/` — DBML, Mermaid, Markdown documentation.
- `src/utils/importFrom/` — DBML (`@dbml/core`).
- `src/utils/migrations/diffToSQL.js` — diff-based migration SQL.

When adding a dialect, add a file in each relevant `*SQL`/`importFrom` dir AND wire it into that dir's `index.js` switch.

### Constants

`src/data/constants.js` holds nearly all enums and magic numbers (`Cardinality`, `Constraint`, `ObjectType`, `Action`, `State`, `MODAL`, `Tab`, `DB`, canvas dimensions, type colors). Reuse these enums instead of string/number literals.

### Extensions / cloud (`ExtensionsContext`)

`src/context/ExtensionsContext.jsx` lets a host app inject capabilities (e.g. `cloudSave`, `cloudLoad`) and render into named `<Slot name="..." />` mount points (`canvas-overlay`, `right-panel`). When an extension function is present, `Workspace` prefers it over local Dexie persistence. This is the integration point for the hosted/paid version; keep the OSS code working without extensions.

### UI

Built on `@douyinfe/semi-ui` (Semi Design) + Tailwind v4 (PostCSS). Canvas is hand-rolled SVG in `src/components/EditorCanvas/`. Code panes use Monaco (`@monaco-editor/react`); note WYSIWYG uses Lexical. i18n via `react-i18next` with 50+ locales in `src/i18n/locales/` (RTL handled via `src/i18n/utils/rtl`).
