---
name: handoff
description: Compact the current conversation into a handoff document for another agent to pick up. Use before /clear, when context is nearly full, or to checkpoint a long multi-session task.
argument-hint: "What will the next session be used for?"
---

Write a minimal recoverable snapshot so the next session can continue from the current node by reading this one file. This is **not** a conversation summary — extract current state, key decisions, and next actions. Discard exploration; preserve decisions.

## Where to save

Save to `docs/handoffs/<date>-<topic>.md` in the current repo (e.g. `docs/handoffs/2026-06-12-auth-refactor.md`). Do **not** use the OS temp directory — it gets cleared between sessions. If not inside a git repo, fall back to the working directory root.

## What not to duplicate

Content already captured elsewhere (PRDs, plans, ADRs, issues, commits, diffs) — reference by path or URL, do not copy the body.

## Redact

Remove any sensitive information: API keys, passwords, tokens, PII.

## Output structure (6 fixed sections)

```markdown
# Handoff: <topic> (<date>)

## 1. 当前状态
Where we are + key artifact paths and their status. One sentence that tells someone "how far we got".

## 2. 基线
git HEAD (commit hash), working directory cleanliness, key file list relevant to this work.

## 3. 下一步分叉
Candidate options for the user / next session to decide (A / B / C) with tradeoffs. If the path is already decided, state the next concrete step.

## 4. 关键口径清单 ⭐
Decisions and invariants that must survive across sessions. Each entry includes a "why".
This is the core value of the document — exploration can be discarded, decisions cannot.
- Decision: … | Why: …
- Invariant: … | Why: …

## 5. 开机动作序列
First ordered actions after /clear (which files to read, which command to run, what to confirm first).

## 6. 明确不写的
What was actively discarded (dead-end explorations, failed approaches) — let the user do a final scan to confirm nothing critical was dropped.

## Suggested skills
Skills appropriate for the next session (e.g. `/tdd`, `/diagnose`, `/grill-with-docs`), one sentence each on why.
```

Section 4 is the core. If the user passed arguments, treat them as the focus of the next session and tailor the document accordingly.
