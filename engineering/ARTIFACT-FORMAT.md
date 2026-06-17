# Artifact Format

The single source of truth for the YAML frontmatter and index files that the engineering
skills produce and consume. Every skill that reads or writes an issue, PRD, handoff, or index
file references THIS document instead of restating the schema — keeping the contract in one
place is what lets `/ship`, `/resume`, and `/tidy` parse deterministically instead of
grepping prose.

All frontmatter is YAML between `---` fences at the very top of the file. The human-readable
body (Chinese, per `~/.claude/CLAUDE.md`) follows below the closing `---`.

## Issue files — `.scratch/<feat>/issues/NN-slug.md`

```markdown
---
type: issue
feature: balance
status: ready-for-agent       # ready-for-agent | ready-for-human | done
category: enhancement         # enhancement | detail | redo | fix
blocked_by: [01-init-schema]  # list of sibling issue slugs; [] if none
refines: 03-balance-api       # parent slice this elaborates; omit for top-level slices
created: 2026-06-18           # ISO date
---

## 上级（Parent）
## 做什么（What to build）
## 验收标准（Acceptance Criteria）
## Comments
```

Field rules:

- **type** — always `issue`.
- **feature** — the `<feat>` slug; must equal the parent directory name. Lets `/ship` and the
  index group issues without parsing paths.
- **status** — the three canonical states only. `done` is immutable (the git commit is truth).
- **category** —
  - `enhancement` — a normal vertical slice from the PRD.
  - `detail` — a small sub-behavior added later that does NOT warrant a PRD revision. MUST carry
    a `refines:` pointing at the parent slice. This is the field that keeps incremental detail
    work from becoming orphan issues (痛点 1).
  - `redo` — re-does a `done` issue the new PRD invalidated. Filename is `NN-redo-<slug>.md`.
  - `fix` — a regression fix against a `done` slice. Filename is `NN-fix-<slug>.md`.
- **blocked_by** — list of sibling slugs (filename without `.md`) that must reach `done` first.
  `/ship` topologically sorts on this. `[]` (or omit) means no blocker.
- **refines** — slug of the parent slice this elaborates. Required for `detail`/`redo`/`fix`,
  omitted for top-level `enhancement` slices. `/tidy`'s orphan check flags any non-top-level
  issue with neither a PRD user-story link nor a `refines`.
- **created** — ISO date, set once at creation, never changed.

The body keeps the existing section headings from `/to-issues`. The completion record still
appends to `## Comments` (see below) — frontmatter `status` and the `### 完成` block move together.

## Handoff files — `.scratch/<feat>/handoff.md` or `docs/handoffs/YYYY-MM-DD-topic.md`

```markdown
---
type: handoff
feature: balance              # the feature slug, or null for cross-feature work
git_base: 3451766             # commit hash HEAD was at when written
status: active                # active | consumed
date: 2026-06-18
---

# Handoff: <topic> (<date>)
## 1. 当前状态 ... (6 fixed sections, unchanged)
```

Field rules:

- **feature** — the feature slug when the handoff belongs to one feature; in that case the file
  lives at `.scratch/<feat>/handoff.md` (rolling — overwrite in place each time, git keeps history).
  Use `null` for cross-feature work; that file lives at `docs/handoffs/YYYY-MM-DD-topic.md`.
- **git_base** — HEAD's short hash at write time. `/resume` compares this against current HEAD and
  warns if they diverged (work happened since the handoff).
- **status** — `active` when written; `/resume` sets it to `consumed` once the work it describes is
  finished. Only `active` handoffs are resume candidates.

Whenever a handoff is written or updated, also rewrite `docs/handoffs/LATEST.md` (see below).

## PRD files — `.scratch/<feat>/PRD.md` / `PRD-vN.md`

```markdown
---
type: prd
feature: balance
version: 2                    # 1 for PRD.md, N for PRD-vN.md
supersedes: PRD.md            # filename of the version this replaces; omit for v1
created: 2026-06-18
---

## 问题（Problem）
## 方案（Solution） ... (existing /to-prd template, unchanged)
```

The skills read the highest `version` whose file is not listed in any other file's `supersedes`.

## SUMMARY files — `.scratch/<feat>/SUMMARY.md` (generated, not authored)

A regenerable view of "what has actually been built", aggregated from the `### 完成` blocks of all
`done` issues in the feature. Overwrite-in-place every time `/tidy` runs — it is a derived
artifact, never hand-edited.

```markdown
---
type: summary
feature: balance
generated: 2026-06-18         # regeneration timestamp
source_issues: 7              # number of done issues aggregated
---

# Balance — 已建成现实

<one-paragraph synthesis of delivered capability, in domain vocabulary from CONTEXT.md>

## 已交付切片
- 01-init-schema — <one line> (commit abc123)
- 02-balance-api — <one line> (commit def456)
...

## 当前测试覆盖
- tests/test_balance_rest.py (4 cases) ← 02-balance-api
...
```

`SUMMARY.md` exists so the PRD no longer has to be kept perpetually "live": the PRD is a versioned
*intent snapshot*, while `SUMMARY.md` is the *current-reality view*. Detail work updates reality
(issues → SUMMARY) without forcing a PRD revision (痛点 1).

## Feature index — `.scratch/INDEX.md` (generated, not authored)

Repo-wide roster of features and their issue-state counts. Regenerated by `/to-issues`, `/tdd`,
`/tidy`, and `/ship` whenever they change an issue's state. Never hand-edited.

```markdown
---
type: index
generated: 2026-06-18
---

# Issue Index

| Feature | ready-for-agent | ready-for-human | done | archived | 活跃 PRD |
|---|---|---|---|---|---|
| balance | 2 | 1 | 5 | 3 | PRD-v2.md |
| auth    | 0 | 0 | 4 | 0 | PRD.md |
```

`archived` counts files under `issues/archive/`. The active columns count only `issues/*.md`
(top level), so the table reflects the live working set, not history.

## Handoff pointer — `docs/handoffs/LATEST.md` (generated, not authored)

A one-line pointer so `/resume` and the user never have to guess which handoff is current.
Rewritten every time any handoff is written.

```markdown
---
type: handoff-pointer
updated: 2026-06-18
---

最近一份 handoff: `.scratch/balance/handoff.md` (feature: balance, status: active)
```

## Directory layout (canonical)

```
repo/
├── CONTEXT.md / CONTEXT-MAP.md
├── docs/
│   ├── adr/NNNN-slug.md
│   ├── handoffs/
│   │   ├── LATEST.md                 ← pointer (generated)
│   │   └── YYYY-MM-DD-topic.md       ← cross-feature handoffs only
│   └── agents/                       ← hys-setup output
└── .scratch/
    ├── INDEX.md                      ← roster (generated)
    └── <feat>/
        ├── PRD.md / PRD-vN.md
        ├── SUMMARY.md                ← generated
        ├── handoff.md                ← this feature's rolling handoff
        └── issues/
            ├── NN-slug.md            ← active issues
            └── archive/
                └── NN-slug.md        ← done issues moved here by /tidy
```

## Inspecting state (active working set only)

Use `rg` with a glob so matches reflect live work, not history — `**/issues/*.md` matches each
feature's top-level issues but not the nested `archive/`:

```bash
rg '^status: ready-for-agent' -g '**/issues/*.md' .scratch   # dispatchable
rg '^status: ready-for-human' -g '**/issues/*.md' .scratch   # hands-on
```

To read a single field deterministically (for `/ship`'s DAG, `/tidy`'s survey), use `yq`
against the frontmatter rather than line-matching:

```bash
yq --front-matter=extract '.status'       .scratch/balance/issues/02-api.md
yq --front-matter=extract '.blocked_by[]' .scratch/balance/issues/02-api.md
```

To see history, read `INDEX.md` (counts) or list `issues/archive/` explicitly.

## Migration

Repos created before frontmatter existed carry a bare `Status:` line and no index files.
`/hys-setup` handles the upgrade (its Case 5): it is idempotent (skips files that already have
frontmatter) and dry-run-first (prints the full plan — which files get frontmatter, which `done`
issues move to `archive/`, what indexes get generated — before touching anything).
