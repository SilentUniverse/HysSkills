---
name: triage
description: Triage issues through a state machine for solo-dev workflow. Use when user wants to scan the issue inbox, prepare an item for an AFK agent or for hands-on work, or move items between states.
---

# Triage

Move issues through a 6-state machine. This skill assumes a **solo-dev** workflow — there is no maintainer/reporter split. The states distinguish what the dev needs to do next, not who's waiting on whom.

## Reference docs

- [AGENT-BRIEF.md](AGENT-BRIEF.md) — how to write durable agent briefs
- [OUT-OF-SCOPE.md](OUT-OF-SCOPE.md) — how the `.out-of-scope/` knowledge base works

## States

Two **category** roles:

- `bug` — something is broken
- `enhancement` — new feature or improvement

Six **state** roles:

- `inbox` — captured but not yet specified (default for new items)
- `ready-for-agent` — fully specified, fire-and-forget OK (AFK agent can run it)
- `ready-for-human` — fully specified, but needs hands-on judgment / design taste / manual testing
- `doing` — in progress (only one item should be `doing` at a time)
- `blocked` — stuck on something the dev needs to figure out themselves
- `shelved` — decided not to do; reason recorded in `.out-of-scope/<concept>.md`

Every triaged issue carries exactly one category role and one state role. The actual label strings may differ — the mapping should have been provided to you, run `/hys-setup` if not.

State transitions: a new item starts at `inbox`. From there it moves to `ready-for-agent`, `ready-for-human`, `blocked`, or `shelved`. `blocked` returns to `inbox` once the blocker is resolved. The dev can override at any time.

## Invocation

The dev invokes `/triage` and describes what they want in natural language. Examples:

- "Show me everything in inbox"
- "Let's look at #42"
- "Move #42 to ready-for-agent"
- "What's ready for an agent to pick up?"
- "What can I do hands-on right now?"

## Show what needs attention

Query the issue tracker and present three buckets, oldest first:

1. **`inbox`** — not yet specified.
2. **`blocked`** — stuck; revisit to see if anything unblocked since last look.
3. **`ready-for-agent`** and **`ready-for-human`** — ready piles, so the dev can pick what to do next.

Show counts and a one-line summary per issue. Let the dev pick.

## Triage a specific issue

1. **Gather context.** Read the full issue (body, comments, dates). Parse any prior triage notes so you don't re-derive resolved questions. Explore the codebase using the project's domain glossary, respecting ADRs in the area. Read `.out-of-scope/*.md` and surface any prior shelving that resembles this issue.

2. **Recommend.** Tell the dev your category and state recommendation with reasoning, plus a brief codebase summary relevant to the issue. Wait for direction.

3. **Reproduce (bugs only).** Before any grilling, attempt reproduction: read the steps, trace the relevant code, run tests or commands. Report what happened — successful repro with code path, failed repro, or insufficient detail (a `blocked` signal). A confirmed repro makes a much stronger agent brief.

4. **Grill (if needed).** If the issue needs fleshing out, run a `/grill-with-docs` session.

5. **Apply the outcome:**
   - `ready-for-agent` — append an agent brief to the issue file's `## Comments` section ([AGENT-BRIEF.md](AGENT-BRIEF.md)).
   - `ready-for-human` — same structure as an agent brief, but note why it can't be fire-and-forgot (judgment calls, design decisions, manual testing).
   - `blocked` — append blocked notes (template below).
   - `shelved` (bug) — short rationale appended to `## Comments`, set `Status: shelved`.
   - `shelved` (enhancement) — write to `.out-of-scope/<concept>.md`, link to it from a comment, set `Status: shelved` ([OUT-OF-SCOPE.md](OUT-OF-SCOPE.md)).
   - `inbox` — leave the state. Optional partial-progress note in comments.

## Quick state override

If the dev says "move #42 to ready-for-agent", trust them and apply the role directly. Confirm what you're about to do (state change, comment, close), then act. Skip grilling. If moving to `ready-for-agent` without a grilling session, ask whether they want to write an agent brief.

## Blocked template

```markdown
## Blocked Notes

**已确认（established so far）:**

- point 1
- point 2

**卡住点（what I need to figure out）:**

- question 1
- question 2
```

Capture everything resolved during grilling under "已确认" so the work isn't lost on the next pass. Questions must be specific and actionable.

## Resuming a previous session

If prior triage notes exist on the issue, read them first. Don't re-derive things already resolved. Present an updated picture before continuing.
