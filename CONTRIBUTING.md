# Contributing

Thanks for your interest.

## Whose project this is

This is the author's personal tool. It is built for the author's own use and shared in case it is useful to others. It is not a community-governed project: what goes in, and how it works, is decided by the author alone.

- **Forks are welcome.** The code is [GPL-3.0-or-later](LICENSE); take it in whatever direction you like.
- **Suggestions are welcome, but they are suggestions.** If you can make a convincing case that something is a good idea, the author will implement it or accept your implementation. If not, the answer is no. Opening a pull request creates no expectation that it will be merged.
- **Please open an issue first** to talk through a bug or an idea, before spending time on code. Bug reports, feedback, example diagrams and testing on Linux and macOS are all very welcome.

## What you give by contributing

Anything you send in (code, documentation, examples or other material, by pull request, patch or attachment) is given freely. By sending it you agree that:

1. You wrote it, or otherwise have the right to submit it.
2. It gives you no rights in the project: no ownership, no say in the project's direction, no credit or payment owed.
3. You grant the author a perpetual, worldwide, irrevocable, royalty-free license to use, copy, modify, distribute, sublicense and **relicense** your contribution under any terms, including different open-source or proprietary ones. You keep the copyright you already have and may use your own code elsewhere.
4. To the extent the law allows, you waive any moral or similar rights that would get in the way of that.

Every pull request has a checkbox for this; one without it ticked will not be merged. If you can't agree, don't submit code (an issue describing the idea is still very welcome). This is a plain statement of terms, not legal advice, and only here to safeguard the author from undue headaches.

## Setting up

You need [Node.js](https://nodejs.org/) (developed on Node 24) and git. There is no database, no external service and no native compile step.

```bash
git clone https://github.com/NoobsDeSroobs/context-heavy-diagrams.git
cd context-heavy-diagrams
npm install
npm run dev
```

If the app will not start after you update Electron (for example with `npm audit fix`), the binary was not downloaded: run `node node_modules/electron/install.js`. A normal `npm install` fetches it through the project's `postinstall` script.

Install scripts of dependencies are reviewed through the `allowScripts` list in `package.json` (npm 11.16+ warns about unreviewed ones; npm 12 blocks them). After adding a dependency that has one, run `npm approve-scripts --allow-scripts-pending` and approve or deny it.

Before sending anything, these must pass (CI runs them on Windows and Linux):

```bash
npm run typecheck
npm run lint
npm test
```

`npm run build` runs the typecheck plus a full production build. Do not run Prettier over `docs/`: it reformats every table and buries small edits in huge diffs. Format code only.

## How the project is organised

- [`docs/architecture/overview.md`](docs/architecture/overview.md) maps the components, and [`docs/architecture/glossary.md`](docs/architecture/glossary.md) defines the vocabulary used in the UI and the code.
- Significant design choices are recorded as short decision records in [`docs/decisions/`](docs/decisions/). If your change makes a real design choice, add one (what was decided, what else was considered, why). Skim the existing ones first; the answer to "why is it like that?" is often there.
- Planned work lives as epics in [`docs/planning/`](docs/planning/README.md), and real bugs in [`docs/known-issues.md`](docs/known-issues.md).
- The `.chd` file format is specified in [`docs/file-format.md`](docs/file-format.md). If you change a `schema.ts` under `src/shared/`, update that file in the same change. Files from older versions must keep loading without migration ([ADR 0029](docs/decisions/0029-backward-compatible-loading-is-a-standing-rule.md)).

## Rules that apply to every change

- **Windows and Linux are both first-class.** No hard-coded path separators, no OS-only APIs or shell built-ins, UTF-8 files, per-OS locations via `app.getPath(...)`. Paths stored inside a file use `/`.
- **Dependencies are tracked.** After adding or updating one, run `npm run notices` and commit `THIRD-PARTY-NOTICES.md`; `npm test` fails otherwise, and also if the new package's license is not known to be GPL-compatible ([ADR 0119](docs/decisions/0119-generated-third-party-notices.md)).
- **The app stays offline.** Nothing may make a network request. A test fails if a network API appears in `src/`, `extension/` or the command-line tool.
- **Paths inside a `.chd` file are untrusted.** Resolve them against the diagram's folder and keep them inside it ([ADR 0115](docs/decisions/0115-paths-stored-in-diagrams-are-untrusted.md)).
- **Anything that lets an AI assistant write a `.chd` file must check that the file is unchanged since it was read**, and a create must fail if the file exists ([ADR 0109](docs/decisions/0109-stale-edit-check-for-every-ai-write-path.md)).
- **Comments explain what the code cannot.** A line above something tricky is good; restating what the code obviously does is not. Purpose and design belong in `docs/`, not in code comments.

## AI-assisted contributions

Using an AI assistant is fine; much of this project was written that way (see the README). You remain responsible for what you submit: understand it, run it, and test it, and say in the pull request if an assistant wrote a substantial part. Pull requests that look generated without being understood or tested will be closed.

## Reporting security problems

Not in a public issue. See [SECURITY.md](SECURITY.md).
