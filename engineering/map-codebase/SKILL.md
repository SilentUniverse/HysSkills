---
name: map-codebase
description: One-time bootstrap that explores a whole (especially large or mature) repository read-only and produces a DRAFT CONTEXT-MAP.md at the root plus per-module CONTEXT.md stubs annotated with code paths. Use when onboarding an existing large codebase, before running /grill-with-docs per module. Produces drafts for human review — it does not finalize domain boundaries.
disable-model-invocation: true
---

# Map codebase (map-codebase)

Bootstrap the domain map for a large or unfamiliar repository in one pass, so later
skills load only the relevant slice instead of re-scanning the whole tree every session.

This skill produces **drafts**, not final truth. Domain boundaries (bounded contexts)
often don't line up with folders. You auto-generate a best-effort map; the user refines
it via `/grill-with-docs`.

## What this skill does (and does not)

Does:

- Explore the repo **read-only** — directory layout, modules, entry points, and
  cross-module dependencies (imports / calls).
- Write a **draft** `CONTEXT-MAP.md` at the repo root: candidate contexts + inferred
  relationships, each tagged `(draft — verify)`.
- Create an empty `CONTEXT.md` **stub** per candidate context, each seeded with the
  **code paths** it covers (this is the part that actually saves tokens later).
- Hand off: tell the user to run `/grill-with-docs` per module to fill the glossary and
  correct boundaries.

Does not:

- Define final domain language — that's `/grill-with-docs`.
- Write implementation details, specs, or ADRs.
- Modify any source file.
- Decide boundaries silently — every inferred boundary is a draft for the user to confirm.

## Process

### 1. Detect scale and existing docs

- If `CONTEXT-MAP.md` or a root `CONTEXT.md` already exists, read it. Don't overwrite —
  report what exists and ask whether to refresh the draft or stop.
- Gauge size: number of top-level source dirs, rough module count. If the repo is small
  (a single cohesive module), tell the user a map is overkill — a single root `CONTEXT.md`
  via `/grill-with-docs` is enough — and stop unless they insist.

### 2. Explore read-only

Map the structure without editing anything:

- Top-level source layout and per-module entry points.
- Cross-module dependencies: who imports / calls whom. Use these edges to infer relationships.
- Naming clusters that hint at a bounded context.

Prefer reading directory trees and import graphs over deep file reads. You're drawing a
map, not reading every street. For very large repos, dispatch the exploration to a
read-only subagent so the main context stays lean.

### 3. Infer candidate contexts — and flag the caveat

Group modules into candidate bounded contexts. **State explicitly** that folders are a
starting heuristic, not the truth: a context may span several folders, or one folder may
hold several contexts. Mark every candidate `(draft — verify)`.

### 4. Write the draft map

Write `CONTEXT-MAP.md` at the repo root using [MAP-FORMAT.md](./MAP-FORMAT.md). Every
context entry points at where it lives and lists the code paths it covers. Every
relationship line is tagged as inferred.

### 5. Seed per-context CONTEXT.md stubs

For each candidate context, create a stub `CONTEXT.md` at its location
(e.g. `src/<context>/CONTEXT.md`) containing:

- A one-line placeholder description.
- A `## Code paths` section listing the files / dirs that implement it.
- A `## Language` header with a `(empty — run /grill-with-docs)` placeholder.

Do **not** invent glossary terms. The stub exists so the next skill — and every future
session — knows which files map to which concept, skipping the grep phase.

### 6. Hand off

Tell the user:

- The map and stubs are **drafts**.
- Next step: for each context they're about to work in, run `/grill-with-docs` to fill the
  glossary and correct the boundary.
- They never need the whole map loaded at once — each session only reads the relevant
  context's `CONTEXT.md`. That is the token saving: a small, stable, relevant slice per
  session instead of the whole system.
