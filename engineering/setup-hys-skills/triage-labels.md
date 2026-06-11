# Issue States

This project uses a minimal 3-state workflow tuned for **solo dev + agent assistance**. There is no triage, no inbox, no blocked. Every issue is either ready to do, ready to do hands-on, or done. Issues that turn out unwanted are deleted; superseded work is recorded by creating new redo issues, never by editing old ones.

| Canonical role    | String in our tracker | Meaning                                                                |
| ----------------- | --------------------- | ---------------------------------------------------------------------- |
| `ready-for-agent` | `ready-for-agent`     | Fully specified, fire-and-forget OK — dispatch to a subagent in parallel |
| `ready-for-human` | `ready-for-human`     | Fully specified, but needs hands-on judgment / design taste / manual / device testing |
| `done`            | `done`                | Completed. **Immutable** — git has the commit. To revise, create a new redo issue. |

The state lives on a `Status:` line near the top of each issue file under `.scratch/<feat>/issues/`, e.g. `Status: ready-for-agent`.

## How to inspect / change state

```powershell
# Inspect (PowerShell)
sls -Path .scratch\**\issues\*.md -Pattern '^Status: ready-for-agent'
sls -Path .scratch\**\issues\*.md -Pattern '^Status: ready-for-human'
sls -Path .scratch\**\issues\*.md -Pattern '^Status: done'

# Or VS Code: Ctrl+Shift+F, regex on, search '^Status: ready-for-agent'
```

State changes are usually automatic:
- `/to-issues` writes new issues at `ready-for-agent` (default) or `ready-for-human`.
- `/tdd` flips the issue to `done` and appends a completion record when all acceptance criteria pass.

Manual changes are rare — only when toggling between `ready-for-agent` and `ready-for-human`, or (rarely) reverting a `done` to `ready-for-X` to acknowledge that this issue needs revision (in which case `/tdd` will pause and ask whether you intend incremental edit or full rework).

## Migrating from older vocabularies

If this repo previously used a richer state machine, drop these states:

| Old              | What to do                                                |
| ---------------- | --------------------------------------------------------- |
| `inbox`          | Either flesh out to `ready-for-agent`/`ready-for-human` or delete |
| `needs-triage`   | Same as `inbox`                                           |
| `needs-info` / `blocked` | Either resolve and promote to ready, or delete    |
| `doing`          | Set back to `ready-for-X` (state was a transient pointer) |
| `wontfix` / `shelved` | Delete the file (reason can live in a commit message or ADR) |

