# Issue tracker: Local Markdown

Issues and PRDs for this repo live as markdown files in `.scratch/`.

## Conventions

- One feature per directory: `.scratch/<feature-slug>/`
- The PRD is `.scratch/<feature-slug>/PRD.md`. Newer versions that supersede it are `PRD-v2.md`, `PRD-v3.md`, etc.
- Implementation issues are `.scratch/<feature-slug>/issues/<NN>-<slug>.md`, numbered from `01`
- Three states only: `ready-for-agent`, `ready-for-human`, `done` (see `triage-labels.md`)
- The state lives on a `Status:` line near the top of each issue file
- Comments and history append to the bottom of the file under a `## Comments` heading

## Two hard rules

**Rule 1 — `done` is immutable.** Once an issue is `done`, never edit its body and never change its `Status`. The git commit is the source of truth for what was done. To revise, create a new issue (`NN-redo-foo.md`); the old one stays as a historical record.

**Rule 2 — Re-running `/to-prd` defaults to supersede.** A new run of `/to-prd` writes a new file `PRD-v2.md` (or v3, v4...) with a `Supersedes:` header pointing at the previous version. The older PRD stays untouched. Append-in-place is reserved for cases where the change only adds detail without invalidating any earlier paragraph; the user must explicitly ask for that mode.

## Quick inspection

```powershell
sls -Path .scratch\**\issues\*.md -Pattern '^Status: ready-for-agent'
sls -Path .scratch\**\issues\*.md -Pattern '^Status: ready-for-human'
sls -Path .scratch\**\issues\*.md -Pattern '^Status: done'
```

Or in VS Code: Ctrl+Shift+F, regex on, search `^Status: ready-for-agent`.

## When a skill says "publish to the issue tracker"

Create a new file under `.scratch/<feature-slug>/` (creating the directory if needed).

## When a skill says "fetch the relevant ticket"

Read the file at the referenced path. The user will normally pass the path or the issue number directly. For PRDs, prefer the highest-numbered non-superseded `PRD*.md` in the feature directory.

