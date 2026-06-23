---
name: tdd
description: Test-driven development with red-green-refactor loop. Four invocation forms — `/tdd <issue-path>` runs one issue (mode chosen by frontmatter `status:`); bare `/tdd` drains every ready-for-agent issue serially in dependency order; `/tdd <feat>` drains just that feature; a natural-language ask without an issue falls back to interview-driven flow. Use when user wants to build features or fix bugs using TDD, mentions "red-green-refactor", wants integration tests, or asks for test-first development.
argument-hint: "Issue path, feature slug, or nothing to drain all ready issues"
---

# Test-Driven Development

## Invocation

- `/tdd <issue-path>` — run that one issue. Read its frontmatter `status:` first (per [ARTIFACT-FORMAT.md](../ARTIFACT-FORMAT.md)) and obey the guard below. Fully visible, one slice.
- `/tdd` (bare) — **drain mode**: run *every* `ready-for-agent` issue across `.scratch/`, serially, in dependency order, to completion. This is the simple batch path — no worktrees, no parallelism, no tidy, all in the current session so you can watch each one. See "Drain mode" below.
- `/tdd <feat>` — drain mode scoped to one feature's `issues/` directory.
- `/tdd --full` — run build + the whole suite now (the manual full-suite check, §5); combine with any form above.
- Natural-language ask without an issue (e.g. "write tests for the parser") — fall back to **interview mode** (jump to Workflow §1).

> **`/tdd` drain vs `/ship`.** Both finish the `ready-for-agent` backlog. Use **bare `/tdd`** for a
> small backlog you want to supervise serially in this session. Use **`/ship`** when you want
> parallel worktree builds, merge-back, deferred-issue handling, and auto-tidy — i.e. volume or
> unattended runs. Same issues, same verification gate; drain is the no-ceremony serial version.

### Drain mode (bare `/tdd` or `/tdd <feat>`)

1. Enumerate candidates: bare scans `.scratch/*/issues/*.md` (top level, never `archive/`); `<feat>` scans only `.scratch/<feat>/issues/*.md`. Read each one's `status:` and `blocked_by:` with `yq --front-matter=extract`.
2. Keep only `status: ready-for-agent`. Order them so every issue runs after its `blocked_by` blockers. Skip (don't fail) any issue still blocked by a `ready-for-human` or unfinished issue — report it as deferred at the end.
3. Run each, **one at a time**, through the autonomous-mode loop below (§Workflow). Per-issue gate: mark `status: done` only if build + the touched module's **scoped** tests pass (not the whole suite); on failure leave it `ready-for-agent`, note why, and **continue** to the next (a red issue doesn't abort the drain unless others depend on it).
4. After the last issue takes the active set to empty, run the **full suite + build once** as the batch's closing check (§5) and regenerate `.scratch/INDEX.md`. Report: shipped, failed (with reasons), deferred (still blocked / `ready-for-human`), and the full-suite result. If a feature's `done` count crossed ~8, suggest `/tidy`.

Drain mode never spawns worktrees or parallel subagents — that's `/ship`'s job. It's deliberately the dumb-but-legible serial path.

### Status guard (issue-driven invocation)

| Status            | Action                                                                                              |
| ----------------- | --------------------------------------------------------------------------------------------------- |
| `ready-for-agent` | **Autonomous mode** — skip "confirm with user" prompts. Run the loop unattended.                    |
| `ready-for-human` | **Interactive mode** — pause at every "confirm with user" point. Before writing the completion record, prompt the user to perform whatever hands-on check makes this slice `ready-for-human` (real-device run, design review, etc). |
| `done`            | **Refuse.** Print: "this issue is `done`; create a redo issue or set `status:` back to `ready-for-X` first." Stop. |
| anything else     | Refuse with the same guidance.                                                                      |

Edge case — `status: ready-for-X` AND `## Comments` already contains a `### 完成` block from a prior run: pause and ask the user "(a) iterate on existing code, or (b) start over?" before proceeding.

Edge case — issue `category` is `redo` / `fix` (or filename matches `*-redo-*` / `*-fix-*`): the parent slice is named by the `refines:` frontmatter field (fall back to stripping the prefix, e.g. `05-redo-balance-api.md` → `02-balance-api.md`). Read the parent's `### 完成` block and list the test files it added. Show the user:

> "This redoes `02-balance-api.md`. That issue added these tests:
> - `tests/test_balance_rest.py` (4 cases)
>
> The new spec changes the API shape. These tests will likely break. Want me to (a) update them in place / (b) delete them and write fresh / (c) leave them and let red signals guide you?"

Wait for the user's choice before starting the red-green loop. This avoids leaving zombie tests after a redo.

### Existing-test scan (before writing any new test)

Identify the project's test convention from `docs/agents/domain.md`. If not specified there, infer from project config files (`pytest.ini` / `pyproject.toml`, `package.json` test script, `build.gradle` `testOptions`, etc.) and ask the user to confirm — then suggest writing it into `domain.md` so future runs skip this step.

For each AC in the issue, search the project's test files for existing coverage. Report briefly: AC already covered (skip; append a one-line note like `AC #3 covered by tests/auth.test.ts:45` to the issue's `## Comments`) vs uncovered (will write new tests).

## Completion record

When all AC pass — and for `ready-for-human`, hands-on verification is confirmed — set the frontmatter `status:` to `done` and append to `## Comments`:

```markdown
### 完成 — YYYY-MM-DD (commit <short-hash>)

- 新增测试：<list of test files + case counts>
- 验收：N/M ✅
- 跳过的 AC：#X 由 <existing test path> 已覆盖（如有）
- 备注：<optional one-liner — e.g. real-device check passed on Pixel 6>
```

Then regenerate `.scratch/INDEX.md` so the feature's state counts reflect the new `done` (per [ARTIFACT-FORMAT.md](../ARTIFACT-FORMAT.md)). The issue file itself stays in `issues/` — `/tidy` moves it to `issues/archive/` later, not `/tdd`.

If the run is aborted (test framework broken, environment unfixable), revert `status:` to its original value and append a brief failure note to `## Comments`.

## Philosophy

**Core principle**: Tests should verify behavior through public interfaces, not implementation details. Code can change entirely; tests shouldn't.

**Good tests** are integration-style: they exercise real code paths through public APIs. They describe _what_ the system does, not _how_ it does it. A good test reads like a specification - "user can checkout with valid cart" tells you exactly what capability exists. These tests survive refactors because they don't care about internal structure.

**Bad tests** are coupled to implementation. They mock internal collaborators, test private methods, or verify through external means (like querying a database directly instead of using the interface). The warning sign: your test breaks when you refactor, but behavior hasn't changed. If you rename an internal function and tests fail, those tests were testing implementation, not behavior.

See [tests.md](tests.md) for examples and [mocking.md](mocking.md) for mocking guidelines.

## Anti-Pattern: Horizontal Slices

**DO NOT write all tests first, then all implementation.** This is "horizontal slicing" - treating RED as "write all tests" and GREEN as "write all code."

This produces **crap tests**:

- Tests written in bulk test _imagined_ behavior, not _actual_ behavior
- You end up testing the _shape_ of things (data structures, function signatures) rather than user-facing behavior
- Tests become insensitive to real changes - they pass when behavior breaks, fail when behavior is fine
- You outrun your headlights, committing to test structure before understanding the implementation

**Correct approach**: Vertical slices via tracer bullets. One test → one implementation → repeat. Each test responds to what you learned from the previous cycle. Because you just wrote the code, you know exactly what behavior matters and how to verify it.

```
WRONG (horizontal):
  RED:   test1, test2, test3, test4, test5
  GREEN: impl1, impl2, impl3, impl4, impl5

RIGHT (vertical):
  RED→GREEN: test1→impl1
  RED→GREEN: test2→impl2
  RED→GREEN: test3→impl3
  ...
```

## Workflow

### 1. Planning

When exploring the codebase, use the project's domain glossary so that test names and interface vocabulary match the project's language, and respect ADRs in the area you're touching.

Before writing any code:

- [ ] Confirm with user what interface changes are needed *(autonomous mode: skip — issue's 实现决策 is the spec)*
- [ ] Confirm with user which behaviors to test *(autonomous mode: skip — AC are the priority)*
- [ ] Identify opportunities for [deep modules](deep-modules.md) (small interface, deep implementation)
- [ ] Design interfaces for [testability](interface-design.md)
- [ ] List the behaviors to test (not implementation steps)
- [ ] Get user approval on the plan *(autonomous mode: skip)*

Ask: "What should the public interface look like? Which behaviors are most important to test?"

**You can't test everything.** Confirm with the user exactly which behaviors matter most. Focus testing effort on critical paths and complex logic, not every possible edge case.

### 2. Tracer Bullet

Write ONE test that confirms ONE thing about the system:

```
RED:   Write test for first behavior → test fails
GREEN: Write minimal code to pass → test passes
```

This is your tracer bullet - proves the path works end-to-end.

### 3. Incremental Loop

For each remaining behavior:

```
RED:   Write next test → fails
GREEN: Minimal code to pass → passes
```

Rules:

- One test at a time
- Only enough code to pass current test
- Don't anticipate future tests
- Keep tests focused on observable behavior

**What to run each cycle.** Run only the test you just wrote, plus the tests of the module you're
touching — not the whole suite (`pytest path/test_x.py`, `vitest run src/x`, `go test ./x/...`). A
seconds-long loop is the point. Run the full suite + build only when you want a wider check — see
§5. Cache the project's full-suite / scoped / build commands in `docs/agents/domain.md` so neither
this run nor the next has to re-derive them.

### 4. Refactor

After all tests pass, look for [refactor candidates](refactoring.md):

- [ ] Extract duplication
- [ ] Deepen modules (move complexity behind simple interfaces)
- [ ] Apply SOLID principles where natural
- [ ] Consider what new code reveals about existing code
- [ ] Run tests after each refactor step

**Never refactor while RED.** Get to GREEN first.

### 5. Full-suite check

Per-cycle and per-issue runs stay scoped (§3) for speed, so they can't see cross-module
regressions. The full suite + build (commands cached in `docs/agents/domain.md`) runs at two points:

- **Automatic, once per batch.** When a drain / ship run takes its **last** issue to `done` — i.e.
  the active set is empty — run the full suite + build one time as the batch's closing check. Not
  per issue; per batch. Report a wider failure rather than letting it pass silently.
- **Manual, on demand.** `/tdd --full` (or "run the full suite") runs build + the whole suite now,
  for an interactive session that wants the wide signal without finishing a batch.

## Checklist Per Cycle

```
[ ] Test describes behavior, not implementation
[ ] Test uses public interface only
[ ] Test would survive internal refactor
[ ] Code is minimal for this test
[ ] No speculative features added
```
