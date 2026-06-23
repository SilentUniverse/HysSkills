---
name: resume
description: Resume work from the most recent handoff. Finds the active handoff via frontmatter and the LATEST pointer, verifies the git baseline still matches, then executes its 开机动作序列. Use at the start of a new session to continue a multi-session task without hunting for the handoff file.
argument-hint: "Feature slug (optional; omit to use the latest active handoff)"
---

# Resume

The inverse of `/handoff`. It removes the friction of "which file do I read, where did I put it,
is the path still valid" — the user types `/resume` and the session continues. All handoff
artifacts follow the handoff frontmatter schema (`type` / `feature` / `git_base` / `status` / `date`)
defined in the `ship` / `to-issues` skills' `ARTIFACT-FORMAT.md`.

## Invocation

- `/resume` — locate the most recent `status: active` handoff and continue from it.
- `/resume <feat>` — continue from `.scratch/<feat>/handoff.md`.

## Process

### 0. Orientation is already loaded — don't re-own it

The session-start rule in the global `CLAUDE.md` (§6) loads the orientation layer
(`CODEBASE.md` + `CONTEXT.md` in full, `docs/adr/` titles, `git_base` drift check) **unconditionally
at the start of every session** — it does not wait for `/resume`. So by the time you run `/resume`,
the project context is already in hand. `/resume`'s job is only to *layer a handoff on top*: don't
re-load or re-explore what orientation already gave you. If for some reason orientation hasn't run
this session (e.g. the §6 rule isn't present in this repo's setup), run it now per
`docs/agents/domain.md` before continuing.

### 1. Locate the handoff

- `/resume <feat>` → read `.scratch/<feat>/handoff.md`.
- `/resume` (no arg) → read `docs/handoffs/LATEST.md`, follow its pointer. If `LATEST.md` is
  missing, scan `.scratch/*/handoff.md` and `docs/handoffs/*.md` for `status: active` and pick the
  newest by `date` (tie-break on file mtime). If none is `active`, tell the user there's nothing to
  resume and stop — do not resume a `consumed` handoff without explicit confirmation. (Step 0 has
  already run, so even with no handoff the session is oriented — say so rather than leaving the user
  empty-handed.)

### 2. Verify the baseline

Compare the handoff's `git_base` against current `git rev-parse --short HEAD`.

- **Match** — clean continuation; proceed.
- **Diverged** — commits landed since the handoff was written. Warn the user and show
  `git log --oneline <git_base>..HEAD` so they can see what changed, then ask whether to proceed.
  The handoff's "关键口径清单" may be stale relative to those commits.

Also check working-tree cleanliness; if dirty, surface `git status` briefly before acting.

### 3. Execute the 开机动作序列

Read the handoff's six sections. Section 5 (开机动作序列) is the script: read the listed files, run
the listed commands, confirm the stated first decision. Section 4 (关键口径清单) is the load-bearing
context — treat those decisions and invariants as binding. Don't re-explore what the handoff already
decided; that's the whole point of the document.

If the handoff names a feature, also glance at `.scratch/<feat>/INDEX.md` row and any
`status: ready-for-*` issues so you know the live working set.

### 4. Mark consumed when the work is finished

A handoff is a bridge for half-finished work, not a permanent record. Once the work it describes
reaches a natural stopping point (issue `done`, or the user starts something else), set its
frontmatter `status:` to `consumed` and update `docs/handoffs/LATEST.md`. If the session itself runs
long and needs a fresh handoff, write a new one via `/handoff` (which supersedes this pointer).

Do not mark `consumed` mid-task — only when the bridge has served its purpose.
