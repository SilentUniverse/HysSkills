# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed. Loaded into every session, so it stays lean.

Tradeoff: biases toward caution over speed. For trivial tasks, use judgment.

## 1. Think in English, respond in Chinese

- Thinking, code, identifiers, file names, search queries: English
- All responses to the user: Chinese
- Written artifacts (CONTEXT.md, ADR, PRD, `.scratch/` issues, handoffs): Chinese body + English term names. Term names must match code identifiers exactly. Example: `Reconciliation（对账）：指…`

## 2. Think Before Coding

Don't assume. Don't hide confusion. Surface tradeoffs.

- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them, don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 3. Simplicity First

Minimum code that solves the problem. Nothing speculative. Before writing code, descend this ladder, stop at the first rung that holds:

1. Does this need to exist? no: skip it (YAGNI)
2. Stdlib already does it? use it
3. Native platform feature does it? use it (e.g. `<input type="date">` over a date-picker library)
4. An installed dependency already does it? use it
5. One line does it? one line
6. Only then: write the minimum code that works

Lazy, not negligent: the ladder is about not inventing code. Trust-boundary validation, data-loss handling, security, and accessibility are never on the chopping block, they're the "does it work correctly" floor, not speculative padding.

- No features beyond what was asked.
- No abstractions for single-use code.
- No flexibility or configurability that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask: would a senior engineer say this is overcomplicated? If yes, simplify.

## 4. Surgical Changes

Touch only what you must. Clean up only your own mess.

When editing existing code:
- Don't improve adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it, don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: every changed line should trace directly to the user's request.

## 5. Goal-Driven Execution

Define success criteria. Loop until verified. Transform tasks into verifiable goals:

- "Add validation" → write tests for invalid inputs, then make them pass
- "Fix the bug" → write a test that reproduces it, then make it pass
- "Refactor X" → ensure tests pass before and after

For multi-step tasks, state a brief plan as `Step → verify: check` lines. Strong success criteria let you loop independently; weak criteria ("make it work") require constant clarification.

## 6. Local document layout

Standard artifact locations. Skills read/write these paths, do not invent alternatives.

| Artifact | Path | Producer |
|---|---|---|
| Domain glossary | `CONTEXT.md` (repo root) | `/grill-with-docs` |
| Architecture decisions | `docs/adr/NNNN-slug.md` | `/grill-with-docs`, `/improve-codebase-architecture` |
| Requirements snapshot (PRD) | `.scratch/<feat>/PRD.md` (revisions: `PRD-v2.md`, ...) | `/to-prd` |
| Implementation tasks | `.scratch/<feat>/issues/NN-slug.md` | `/to-issues` |
| Session handoffs | `docs/handoffs/<date>-<topic>.md` | `/handoff` |
| Skill config | `docs/agents/` | `/hys-setup` |

Immutability rules:

- An issue with `status: done` (in YAML frontmatter) is immutable: never edit its body or change its `status`. The git commit is the source of truth. To revise, create a new redo issue (`NN-redo-<slug>.md`). Frontmatter schema lives in `engineering/ARTIFACT-FORMAT.md`.
- An ADR superseded by another ADR is immutable: never edit its body. Mark it superseded; the new ADR carries the change.
- Re-running `/to-prd` defaults to writing a new `PRD-vN.md` with a `Supersedes:` header; the older PRD stays untouched. Append-in-place is reserved for purely additive changes the user explicitly asks for.

## 7. Modern CLI tooling

Prefer modern tools over legacy ones, but respect the layering: the harness already exposes ripgrep-backed `Grep`, `Glob`, and `Read` tools with permission integration. Use those for routine agent search/read; only drop to a shell tool when the built-in can't express the need.

| Legacy | Modern | When the agent uses the shell tool (not the built-in) |
|---|---|---|
| `grep` / `Select-String` | `rg` | only when a built-in `Grep` can't express it (e.g. piping into another command) |
| `find` | `fd` | listing/finding files in a shell pipeline (built-in `Glob` covers most cases) |
| `cat` | `bat` | viewing in a terminal; use `bat -pp` (plain, no pager) inside scripts |
| `ls` / `dir` / `Get-ChildItem` | `eza` | terminal listing only |
| `sed` (substitute) | `sd` | batch find-replace across files: `sd 'old' 'new'` |
| JSON query/edit | `jq` | any JSON read/transform |
| YAML query/edit | `yq` | frontmatter extraction: `yq --front-matter=extract '.status' issue.md` |
| `grep` for code structure | `ast-grep` (`sg`) | structural/AST search & rewrite (e.g. find `as Type` casts), not text matching |

Key distinctions:

- `jq` is JSON-only; YAML frontmatter needs `yq`. To read an issue's `status` / `blocked_by` / `refines` deterministically: `yq --front-matter=extract '.blocked_by[]' <file>`, never parse frontmatter by hand or by line-grep.
- `rg` and `ast-grep` are complementary, not interchangeable. `rg` matches text/lines (fast, use for `^status:` and prose); `ast-grep` matches syntax tree nodes (use for "find all calls to X", "find all `as Type` assertions"). Reach for `ast-grep` only when text matching would be brittle.
- `rg`/`fd` respect `.gitignore` and let glob exclude paths, e.g. `rg '^status:' -g '**/issues/*.md'` matches active issues without touching `issues/archive/`.

When a shell command embeds a user-supplied value, quote it; these tools take regex by default (`rg`, `sd`), so escape literals or pass `--fixed-strings` / `-F`.

---

These guidelines are working if: fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.
