export const meta = {
  name: 'ship-wf',
  description:
    "Workflow variant of /ship — orchestrate a feature's ready-for-agent issues to completion: plan dependency-ordered waves, run one TDD subagent per issue in isolated worktrees (parallel), merge back serially, gate each on build+test before commit, then tidy when done piles up.",
  phases: [
    { title: 'Plan', detail: 'read issues, extract DAG with yq, group disjoint work into parallel waves' },
    { title: 'Build', detail: 'one TDD subagent per ready-for-agent issue; waves respect deps' },
    { title: 'Tidy', detail: 'archive done + regenerate SUMMARY when done count is high' },
  ],
}

// args: a feature slug string, or { feature: "<slug>" }
const feat = typeof args === 'string' ? args : args?.feature
if (!feat) throw new Error('ship workflow needs a feature slug: pass args "<slug>" or { feature: "<slug>" }')
const ISSUES = `.scratch/${feat}/issues`

// ---- Phase 1: Plan -------------------------------------------------------
phase('Plan')

const PLAN_SCHEMA = {
  type: 'object',
  required: ['waves', 'deferred', 'doneCount'],
  properties: {
    waves: {
      type: 'array',
      description:
        'Ordered waves. Issues inside one wave touch DISJOINT modules and are parallel-safe; waves run in sequence (later waves depend on earlier ones).',
      items: {
        type: 'array',
        items: {
          type: 'object',
          required: ['file', 'modules'],
          properties: {
            file: { type: 'string', description: 'issue filename, e.g. 02-balance-api.md' },
            modules: { type: 'array', items: { type: 'string' }, description: 'modules/paths this issue touches' },
          },
        },
      },
    },
    deferred: {
      type: 'array',
      items: {
        type: 'object',
        required: ['file', 'reason'],
        properties: { file: { type: 'string' }, reason: { type: 'string' } },
      },
    },
    doneCount: { type: 'number', description: 'issues already status: done in issues/ (excluding archive/)' },
  },
}

const plan = await agent(
  `Plan a ship run for feature "${feat}". Working dir is the repo root.

1. List active issues: \`fd -e md . ${ISSUES} -d 1\` (depth 1 only — never touch ${ISSUES}/archive/).
2. For each, read frontmatter deterministically:
   - status:      \`yq --front-matter=extract '.status' <file>\`
   - blocked_by:  \`yq --front-matter=extract '.blocked_by | join(",")' <file>\`
   Read the body's "做什么"/"实现决策" to infer which modules/paths it touches (consult CONTEXT.md code paths if present).
3. Keep only status: ready-for-agent issues. An issue is runnable only when every blocker is already done OR scheduled in an earlier wave. If a blocker is ready-for-human, DEFER the dependent (can't auto-run past a human gate) — list it under deferred with that reason.
4. Build ordered waves: issues in the SAME wave must touch DISJOINT modules (parallel-safe). When unsure whether two issues share a module, put them in different waves — a wrong parallelization corrupts work, a wrong serialization only costs time.
5. doneCount = number of status: done issues in ${ISSUES} (exclude archive/).

Return the plan. Do NOT modify any file.`,
  { schema: PLAN_SCHEMA, phase: 'Plan' },
)

const totalRunnable = plan.waves.reduce((n, w) => n + w.length, 0)
log(`Plan: ${plan.waves.length} wave(s), ${totalRunnable} runnable issue(s), ${plan.deferred.length} deferred, ${plan.doneCount} already done`)
if (totalRunnable === 0) {
  log('Nothing to ship. Deferred: ' + (plan.deferred.map((d) => d.file).join(', ') || 'none'))
}

// ---- Phase 2: Build ------------------------------------------------------
phase('Build')

const BUILD_SCHEMA = {
  type: 'object',
  required: ['file', 'result'],
  properties: {
    file: { type: 'string' },
    result: { type: 'string', enum: ['done', 'failed'] },
    branch: { type: 'string', description: 'the worktree branch name the commit lives on (empty if failed)' },
    commit: { type: 'string', description: 'short hash committed in the worktree (empty if failed)' },
    note: { type: 'string', description: 'one line: tests added, or why it failed the gate' },
  },
}

const buildIssue = (issue, waveNo) =>
  agent(
    `Implement issue ${ISSUES}/${issue.file} for feature "${feat}" using strict TDD, autonomous mode.
You are running in an ISOLATED git worktree on your own branch — your commits do not touch other agents. Do NOT switch branches, do NOT merge to main, do NOT push.

This issue is status: ready-for-agent — the issue body is the spec. Do NOT ask for confirmation; the AC are the priority.

Follow the /tdd skill discipline:
- Existing-test scan first: for each AC, skip if already covered (note it), else write a test.
- Vertical tracer bullets: one test -> minimal code -> repeat. Never write all tests then all code.
- Each red-green cycle runs ONLY the test you just wrote + the touched module's tests (seconds-long loop), NOT the whole suite.
- Tests verify behavior through public interfaces, not implementation details.

VERIFICATION GATE (hard): commands are cached in docs/agents/domain.md (infer from project config if absent, then write them back). Run build + the touched modules' tests — scoped, NOT the whole suite (the orchestrator runs the full suite once after merge-back). You may commit ONLY if they pass.
- On pass: in THIS worktree, commit the code + tests + the issue file with frontmatter status: done and a "### 完成 — <date> (commit <hash>)" record appended to ## Comments (test files + case counts). Then report your branch (\`git branch --show-current\`) and short hash (\`git rev-parse --short HEAD\`). Return result "done".
- On fail: do NOT commit. Return result "failed" with a short reason. Leave branch/commit empty.

**Do NOT modify .scratch/INDEX.md** — the orchestrator regenerates it once after merge-back, so per-worktree edits would collide.

Touched modules (do not stray outside without reason): ${issue.modules.join(', ') || 'infer from the issue'}.
Return only the structured result.`,
    { schema: BUILD_SCHEMA, phase: 'Build', label: `${issue.file} (wave ${waveNo})`, isolation: 'worktree' },
  )

const MERGE_SCHEMA = {
  type: 'object',
  required: ['merged', 'conflicted'],
  properties: {
    merged: { type: 'array', items: { type: 'string' }, description: 'branches merged cleanly to main' },
    conflicted: {
      type: 'array',
      items: {
        type: 'object',
        required: ['branch', 'file'],
        properties: { branch: { type: 'string' }, file: { type: 'string' }, reason: { type: 'string' } },
      },
      description: 'branches that hit a merge conflict and were aborted, leaving main clean',
    },
    suiteFailure: {
      type: 'string',
      description: 'one line if the full suite/build failed on main after merge-back (cross-module regression the scoped gates missed); empty if green',
    },
  },
}

// Merge a wave's worktree branches back to the main branch, SERIALLY (one at a time) so the
// collection step never races. Disjoint modules shouldn't conflict; if the plan mis-grouped two
// issues, the conflicting merge is aborted and that issue is reported failed — main stays clean.
const mergeWave = (toMerge, waveNo) =>
  agent(
    `Merge these feature-"${feat}" worktree branches back onto the current main working branch, ONE AT A TIME, in the given order. For each:
${toMerge.map((b) => `  - branch ${b.branch}  (issue ${b.file}, commit ${b.commit})`).join('\n')}

For each branch in order: \`git merge --no-ff <branch>\`. If it merges cleanly, keep it and move on. If it CONFLICTS, run \`git merge --abort\` immediately (leave the working tree clean), record it under conflicted with the conflicting file/reason, and continue with the next branch. Never force a conflicted merge. Do not touch .scratch/INDEX.md.

After all merges, run the full suite + build once against main (commands cached in docs/agents/domain.md) to catch cross-module regressions the scoped per-issue gates missed. If it fails, set suiteFailure to a one-line reason; if green, leave it empty. Do not revert the merges.

Return which branches merged, which conflicted, and any suite failure.`,
    { schema: MERGE_SCHEMA, phase: 'Build', label: `merge-back wave ${waveNo}` },
  )

const built = []
const mergedOk = []
const mergeFailed = []
const waveStats = []
const tokensAtStart = budget.spent()
// Each wave: parallel build in isolated worktrees, then SERIAL merge-back before the next wave —
// so wave N+1's worktrees branch from a main that already contains wave N's work (blocked_by holds).
for (let i = 0; i < plan.waves.length; i++) {
  const wave = plan.waves[i]
  const waveStart = Date.now()
  const tokensBefore = budget.spent()
  log(`Wave ${i + 1}/${plan.waves.length}: building ${wave.map((w) => w.file).join(', ')} in parallel`)
  const results = (await parallel(wave.map((issue) => () => buildIssue(issue, i + 1)))).filter(Boolean)
  built.push(...results)

  const toMerge = results.filter((r) => r.result === 'done' && r.branch)
  if (toMerge.length) {
    log(`Wave ${i + 1}: merging ${toMerge.length} branch(es) back serially`)
    const m = await mergeWave(toMerge, i + 1)
    mergedOk.push(...(m?.merged ?? []))
    mergeFailed.push(...(m?.conflicted ?? []))
  }
  waveStats.push({
    wave: i + 1,
    issues: wave.length,
    seconds: Math.round((Date.now() - waveStart) / 1000),
    tokens: budget.spent() - tokensBefore,
  })
}

const conflictedFiles = new Set(mergeFailed.map((c) => c.file))
const shipped = built.filter((b) => b.result === 'done' && b.branch && !conflictedFiles.has(b.file))
const failed = [
  ...built.filter((b) => b.result === 'failed').map((b) => ({ file: b.file, note: b.note })),
  ...mergeFailed.map((c) => ({ file: c.file, note: `merge conflict on ${c.reason || c.branch} — aborted, main left clean` })),
]
log(`Build complete: ${shipped.length} shipped, ${failed.length} failed (gate or merge)`)

// ---- Phase 3: Tidy -------------------------------------------------------
phase('Tidy')

const doneAfter = plan.doneCount + shipped.length
let tidied = false
if (doneAfter >= 8) {
  log(`done count is ${doneAfter} (>= 8) — running tidy pass`)
  await agent(
    `Run the /tidy skill for feature "${feat}". Archive status: done issues into ${ISSUES}/archive/ with \`git mv\` (never edit their bodies), regenerate .scratch/${feat}/SUMMARY.md from the 完成 records, audit zombie/duplicate tests, flag orphan issues, and regenerate .scratch/INDEX.md. Report what moved and any orphans left for the user.`,
    { phase: 'Tidy', label: 'tidy ' + feat },
  )
  tidied = true
} else if (shipped.length) {
  // No tidy, but worktrees were forbidden from touching INDEX.md — refresh it once now.
  log(`done count is ${doneAfter} (< 8) — skipping tidy, regenerating INDEX only`)
  await agent(
    `Regenerate .scratch/INDEX.md from the current state of .scratch/*/issues/ per ARTIFACT-FORMAT.md (per-feature counts of ready-for-agent / ready-for-human / done / archived; active columns count only top-level issues/*.md, not archive/). Commit it. Do nothing else.`,
    { phase: 'Tidy', label: 'refresh INDEX' },
  )
} else {
  log(`Nothing shipped — INDEX unchanged`)
}

// ---- Report --------------------------------------------------------------
// Run metrics — the only place "did parallel actually pay off / how good was the plan" is observable.
// gateFailRate + conflictRate are direct signals of plan quality (wrong wave grouping shows up here).
const attempted = totalRunnable
const metrics = {
  waves: waveStats,
  totalSeconds: waveStats.reduce((n, w) => n + w.seconds, 0),
  totalTokens: budget.spent() - tokensAtStart,
  attempted,
  shipped: shipped.length,
  gateFailures: built.filter((b) => b.result === 'failed').length,
  mergeConflicts: mergeFailed.length,
  gateFailRate: attempted ? +(built.filter((b) => b.result === 'failed').length / attempted).toFixed(2) : 0,
  conflictRate: attempted ? +(mergeFailed.length / attempted).toFixed(2) : 0,
}
log(
  `Metrics: ${metrics.totalSeconds}s, ~${metrics.totalTokens} tok, ` +
    `${metrics.shipped}/${attempted} shipped, ` +
    `gate-fail ${metrics.gateFailures} (${metrics.gateFailRate}), merge-conflict ${metrics.mergeConflicts} (${metrics.conflictRate})` +
    (metrics.conflictRate > 0 ? ' — conflicts mean the plan mis-grouped a wave; tighten module disjointness next run' : ''),
)

return {
  feature: feat,
  shipped: shipped.map((b) => ({ file: b.file, commit: b.commit, note: b.note })),
  failed,
  deferred: plan.deferred,
  mergedBranches: mergedOk,
  tidied,
  metrics,
}
