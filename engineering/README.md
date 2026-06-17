# Engineering

Skills I use daily for code work.

- **[diagnose](./diagnose/SKILL.md)** — Disciplined diagnosis loop for hard bugs and performance regressions: reproduce → minimise → hypothesise → instrument → fix → regression-test.
- **[tidy](./tidy/SKILL.md)** — Garbage-collect a feature: archive `done` issues, regenerate `SUMMARY.md` from completion records, audit zombie/duplicate tests, flag orphan issues. Keeps the working set small as detail work accumulates.
- **[grill-with-docs](./grill-with-docs/SKILL.md)** — Grilling session that challenges your plan against the existing domain model, sharpens terminology, and updates `CONTEXT.md` and ADRs inline.
- **[improve-codebase-architecture](./improve-codebase-architecture/SKILL.md)** — Find deepening opportunities in a codebase, informed by the domain language in `CONTEXT.md` and the decisions in `docs/adr/`.
- **[setup-hys-skills](./setup-hys-skills/SKILL.md)** — （命令名 `/hys-setup`）Scaffold the per-repo config (issue tracker, state vocabulary, domain doc layout) that the other engineering skills consume. 默认本地 markdown tracker。Case 5 迁移把旧 `Status:` 行升级成 frontmatter。
- **[ship](./ship/SKILL.md)** — Orchestrate a feature's `ready-for-agent` issues to completion: topo-sort the dependency DAG, parallelize disjoint work / serialize same-module work, dispatch each through `/tdd`, enforce a build+test gate, collect `ready-for-human` into a checklist. The layer above `/tdd`.
- **[tdd](./tdd/SKILL.md)** — Test-driven development with a red-green-refactor loop. Four ways to invoke: `/tdd <issue-path>` runs one issue; bare `/tdd` drains every ready-for-agent issue serially in dependency order; `/tdd <feat>` drains one feature; a natural-language ask falls back to interview mode.
- **[to-issues](./to-issues/SKILL.md)** — Break any plan or PRD into independently-grabbable issues (默认本地 `.scratch/`, frontmatter + dependency DAG) using vertical slices. Reconciles against existing issues on re-runs.
- **[to-prd](./to-prd/SKILL.md)** — Turn the current conversation context into a versioned PRD under `.scratch/<feat>/`. Defaults to writing a superseding `PRD-vN.md` when an existing PRD matches.
- **[zoom-out](./zoom-out/SKILL.md)** — Tell the agent to zoom out and give broader context or a higher-level perspective on an unfamiliar section of code.
- **[prototype](./prototype/SKILL.md)** — Build a throwaway prototype to flesh out a design — either a runnable terminal app for state/business-logic questions, or several radically different UI variations toggleable from one route.

The artifact contract every skill reads/writes (frontmatter schemas, index files, directory layout) lives in **[ARTIFACT-FORMAT.md](./ARTIFACT-FORMAT.md)**.
