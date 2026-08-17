# Repository Instructions

Keep `CLAUDE.md` and `AGENTS.md` synchronized: every instruction change to one file
must be mirrored in the other in the same change.

## Project Profile

This repository publishes Jormal's static website through GitHub Pages. The deployable
site is composed of HTML, CSS, JavaScript, and other browser-served assets; it has no
application server, database, or required package manager.

| Purpose | Command |
| --- | --- |
| Serve locally | `python3 -m http.server 8000` |
| Verify static-site invariants | `node scripts/verify-static-site.mjs` |

Use the verification script before reporting a site or repository-configuration change
complete. Run the local server and inspect the affected page in a browser when a change
has a visual or interactive effect.

## Repository Layout

```text
.
|-- index.html          # GitHub Pages entry point
|-- papa/               # browser-delivered tools and their static assets
|-- scripts/            # dependency-free repository verification utilities
`-- docs/               # Korean documentation
    |-- wiki/           # persistent LLM knowledge base
    |-- tickets/        # frozen per-ticket plans
    `-- ticket-reviews/ # compressed ticket-plan review records
```

Keep every deployable asset compatible with direct static hosting. Do not introduce a
server runtime, server-side rendering, database, secret, or build-only deployment
requirement unless the user explicitly asks for it.

## Static Site Rules

- Use relative, site-root-safe asset paths that work both on GitHub Pages and a local
  static server.
- Prefer semantic HTML, keyboard-accessible controls, responsive layouts, and useful
  alternative text for informative images.
- Keep browser processing local where possible. Before adding an external service,
  runtime dependency, analytics integration, or third-party script, get user approval
  and document its data and failure behavior.
- Avoid committing generated output, local server artifacts, credentials, or user data.
- Keep JavaScript progressively usable: a page's essential explanatory content should
  remain available when scripts fail to load.

## Development Workflow

- Read the surrounding files before editing and keep the change within the user's scope.
- Add a focused automated check when a change introduces logic that can be checked
  without a browser. Do not add a package manager or framework merely to add tests.
- Before declaring work complete, run `node scripts/verify-static-site.mjs`; for visual
  changes, also inspect the affected page in a browser at a representative viewport.
- Record durable project knowledge in `docs/wiki/kb/` and update its index and log under
  the rules in [docs/wiki/README.md](docs/wiki/README.md).

## Git and Collaboration

- Never run `git commit` unless the user explicitly asks for a commit in that turn.
- Do not stage changes unless the user explicitly asks. Never stage credentials, local
  environment files, or large generated assets.
- Never run `git push`, `git push --force`, `git rebase`, `git reset --hard`, `git clean
  -fd`, `git checkout --` on a dirty tree, or amend/rewrite an existing commit.
- Commit messages and PR titles follow [docs/commit-convention.md](docs/commit-convention.md).
  PR bodies and review comments are written in Korean.
- Use `feature/ISSUE-{NNN}.{NN}-{PascalCaseTitle}` for ticket branches. Ticket
  `ISSUE-001-01-Homepage.md` maps to `feature/ISSUE-001.01-Homepage`.

## Documentation and Language Policy

- `AGENTS.md`, `CLAUDE.md`, code, code comments, commit messages, and PR titles are
  written in English.
- The root `README.md` and everything under `docs/` are written in Korean. The only
  exception is `docs/wiki/raw/`, which preserves external source material unmodified.
- Keep code identifiers, paths, commands, and format tokens in their original form
  within Korean prose.
- Ticket rules are in [docs/tickets/README.md](docs/tickets/README.md); ticket-review
  rules are in [docs/ticket-reviews/README.md](docs/ticket-reviews/README.md).
