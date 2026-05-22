# Repository Instructions

## Basic Guidelines

- Keep `CLAUDE.md` and `AGENTS.md` synchronized: every instruction change to one file must be mirrored in the other in the same change.
- Write all documents under `docs/` in Korean.
- Write all content outside `docs/`, including `CLAUDE.md`, `AGENTS.md`, code comments, and instruction documents, in English.
- Whenever updating instructions, optimize `CLAUDE.md` and `AGENTS.md` by avoiding duplicate content and organizing the structure so it is easy to understand.
- Do not add content that the user did not request.

## Knowledge Wiki - `docs/wiki/`

A persistent knowledge base maintained by the LLM. It covers both project knowledge and external material, but the two spaces are kept strictly separate. This section defines the wiki layout, operational flow, and authoring rules.

For the foundational pattern this implementation is built on, see `docs/wiki/about.md`. That file is the conceptual reference. This `Knowledge Wiki` section is the prescriptive, project-specific implementation and takes precedence if the two ever conflict.

### Layout

```text
docs/wiki/
|-- index.md          # KB catalog: one-line summary plus link per page
|-- log.md            # Chronological work log, append-only
|-- raw/              # External source material, temporary and deleted after digest
`-- kb/               # Project knowledge base, permanent
    |-- entities/     # Concrete things: services, modules, schemas, external systems
    |-- concepts/     # Abstract topics: business logic, domain concepts, flows
    `-- decisions/    # Design and architecture decisions, date-stamped
```

Create missing layout files or directories before the first wiki operation that depends on them.

### Separation of Spaces

- `docs/wiki/raw/` is temporary. It holds external material in original form, such as articles, papers, meeting notes, reports, and screenshots. When ingest finishes, delete the original file. Only processed knowledge remains inside `docs/wiki/kb/`.
- `docs/wiki/kb/` is permanent. The LLM owns and maintains it; the user reads and directs.
- The flow is one-way: `docs/wiki/raw/` to `docs/wiki/kb/`. Content in `kb/` is never copied back into `raw/`.
- The LLM reads freely from `raw/`, but does not modify files there until ingest completes.

### Operations

#### Ingest

1. The user places material in `docs/wiki/raw/` as a file or provides source text in chat.
2. The LLM reads the material in full and aligns with the user on the key takeaways.
3. The LLM updates or creates the relevant `kb/` pages under `entities/`, `concepts/`, or `decisions/` as appropriate. A single source touching many pages is normal.
4. The LLM repairs cross-links, including bidirectional connections and broken-link fixes.
5. The LLM updates `docs/wiki/index.md` and `docs/wiki/log.md`.
6. If a raw file was used, the LLM deletes the original file from `docs/wiki/raw/`. Ingest is not complete until this step is done.

#### Query

- Use `docs/wiki/index.md` to identify candidate pages, read the relevant `kb/` pages, then answer with citations.
- Choose the output format that fits the question: markdown prose, comparison table, slide deck, chart, diagram, or another suitable artifact.
- If the answer has reuse value, file it back into `kb/` as a new page and update `index.md` and `log.md`.

#### Lint

Periodically inspect and report on:

- Contradictions between pages.
- Stale claims that newer sources have superseded.
- Orphan pages with no inbound links.
- Frequently mentioned concepts that lack their own page.
- Missing or broken cross-references.
- Information gaps worth investigating.

### Conventions

- Wiki page bodies are written in Korean.
- Filenames use kebab-case `.md`, such as `withdrawal-flow.md` or `btc-deposit-pipeline.md`.
- Cross-links use relative paths within the wiki, such as `[wallet service](../entities/wallet-service.md)`. In actual Korean wiki pages, link text should be Korean.
- Log entries use `## [YYYY-MM-DD] {ingest|query|lint} | {title}`. Append new entries at the bottom of `log.md`, oldest first and newest last, so `grep "^## \\[" log.md | tail -5` returns the five most recent entries.
- Index entries use one line per page: `- [title](path) - one-line summary`. Group entries by category: `entities`, `concepts`, and `decisions`.
- Every `kb/` page ends with a `## Sources` section listing provenance metadata: title, author, publication date, URL, and ingest date. The original raw file is deleted, so this is where identifying source information survives.
- YAML frontmatter for fields such as `tags`, `updated`, and `sources` is optional and should be used when useful.

### LLM Rules

- Whenever a `kb/` page is created or modified, update `index.md` and `log.md` in the same pass.
- Ingest must include deletion of the original `raw/` file when one exists. Do not stop halfway.
- When finding a contradiction, do not silently drop one side. Record both claims and ask the user.
- One source affecting 10 to 15 pages is normal; do not avoid the bookkeeping.
- Apply the same care to wiki work that you apply to code work: understand the context before editing, keep changes scoped, and verify the result.

## Ticket History - `docs/tickets/`

`docs/tickets/` stores per-issue root-cause analyses and response plans. Each file is a frozen snapshot of the plan at the time the ticket was opened or explicitly documented by the user. It is not a progress log and not a living status document.

### Purpose and Scope

- Keep one markdown file per ticket or sub-task, keyed by ticket ID.
- Store the plan only: overview, problem definition, root cause, decisions, TDD test plan, implementation plan, scope, non-goals, and references.
- Preserve historical intent at a point in time. Do not update old ticket documents just because the project direction later changes.
- Use `docs/wiki/` for current knowledge and `docs/tickets/` for historical plans. They may reference each other, but they are not substitutes.

### Agent Restrictions

- Do not create any file under `docs/tickets/` unless the user explicitly asks for it.
- Do not modify any file under `docs/tickets/` unless the user explicitly asks for that exact modification.
- Do not rewrite, reword, reformat, typo-fix, link-fix, or otherwise improve existing ticket documents on your own initiative. Surface issues to the user instead.
- Do not make retroactive corrections to past ticket documents when later decisions or facts change. Create a new ticket only if the user asks for one.
- Do not append implementation progress, status notes, outcomes, lessons learned, or execution logs after implementation begins.
- These restrictions override any general documentation, wiki, or helpfulness guideline that might suggest proactive updates.

### Exceptions

- Retroactive authoring for already completed work is allowed only when the user explicitly requests it.
- All exceptions require direct user instruction. Inferred intent does not count.

### Conventions

- Ticket document bodies are written in Korean because they are under `docs/`.
- Filenames use `{ISSUE-ID}-{sub-number}-{English-Title-Slug}.md`, such as `ISSUE-001-01-Introduce-LLM-Wiki.md`.
- Keep file contents limited to the plan. Do not include diary entries, execution history, or retrospective sections.
- All implementation plans must follow TDD structure: define the test plan first, then the implementation plan.
- Ticket documents may reference related wiki pages or code. Wiki pages should generally not depend on ticket files because ticket files are frozen and may become stale relative to current knowledge.

### Recommended Template

Use Korean section titles in ticket documents. The required semantic outline is below. Do not copy these English labels into files under `docs/tickets/`; translate the headings to Korean when writing the actual ticket document.

```markdown
# {Ticket Title}

## Overview

### Goal

### Background

### Impact Scope

### Non-Goals

### References

## Problem Definition

### Symptoms

### Root Cause

### Constraints

## Decisions

## Test Plan

### Test Cases

### Expected Failures Before Implementation

### Validation Criteria

## Implementation Plan

### Steps

### Risks
```
