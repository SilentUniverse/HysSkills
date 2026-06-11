---
name: hys-setup
description: Sets up an `## Agent skills` block in AGENTS.md/CLAUDE.md and `docs/agents/` so the engineering skills know this repo's issue tracker (local markdown by default), triage label vocabulary, and domain doc layout. Run before first use of `to-issues`, `to-prd`, `triage`, `diagnose`, `tdd`, `improve-codebase-architecture`, or `zoom-out` — or if those skills appear to be missing context about the issue tracker, triage labels, or domain docs.
disable-model-invocation: true
---

# Setup (hys-setup)

Scaffold the per-repo configuration that the engineering skills assume:

- **Issue tracker** — where issues live (local markdown by default; see below)
- **Triage labels** — the strings used for the five canonical triage roles
- **Domain docs** — where `CONTEXT.md` and ADRs live, and the consumer rules for reading them

This is a prompt-driven skill, not a deterministic script. Explore, present what you found, confirm with the user, then write.

## Process

### 1. Explore

Look at the current repo to understand its starting state. Read whatever exists; don't assume:

- `AGENTS.md` and `CLAUDE.md` at the repo root — does either exist? Is there already an `## Agent skills` section in either?
- `CONTEXT.md` and `CONTEXT-MAP.md` at the repo root
- `docs/adr/` and any `src/*/docs/adr/` directories
- `docs/agents/` — does this skill's prior output already exist?
- `.scratch/` — sign that the local-markdown issue tracker convention is already in use

### 2. Present findings and ask

Summarise what's present and what's missing. Then walk the user through the three decisions **one at a time** — present a section, get the user's answer, then move to the next. Don't dump all three at once.

Assume the user does not know what these terms mean. Each section starts with a short explainer (what it is, why these skills need it, what changes if they pick differently). Then show the choices and the default.

**Section A — Issue tracker（issue 追踪位置）.**

> 中文说明："issue tracker" 是本仓库存放需求/任务（issue）和 PRD 的地方。`to-issues`、`triage`、`to-prd` 会从这里读、往这里写——它们需要知道是该写一个 `.scratch/` 下的 markdown 文件，还是按你描述的其他流程。

默认且推荐：**本地 markdown**。这套 skill 已默认全部以纯本地文件形式运行，不依赖任何网络服务或账号。直接采用本地方案，除非用户主动要求别的：

- **Local markdown（默认）** — issue 以 `.scratch/<feature>/` 下的文件形式存在，纯本地、零外部依赖。
- **Other**（GitHub / GitLab / Jira / Linear 等）— 仅当用户明确要求时才用。让用户用一段话描述工作流，技能把它原样记录为自由文本写进 `docs/agents/issue-tracker.md`。注意：选这类会引入外部 CLI/账号依赖，与"纯本地"目标冲突，需用户自行承担相应环境配置。

**Section B — Triage label vocabulary（分诊状态词汇）.**

> 中文说明：`triage` 处理一条 issue 时，会让它走一个状态机——待评估、等报告人补充信息、可交给 AFK agent、需人工实现、不修复。本地 markdown 模式下，状态记在每个 issue 文件顶部的 `Status:` 行。下面是五个规范角色名；你可以改成自己习惯的字符串。

The five canonical roles:

- `needs-triage` — maintainer needs to evaluate
- `needs-info` — waiting on reporter
- `ready-for-agent` — fully specified, AFK-ready (an agent can pick it up with no human context)
- `ready-for-human` — needs human implementation
- `wontfix` — will not be actioned

Default: each role's string equals its name. Ask the user if they want to override any.

**Section C — Domain docs（领域文档布局）.**

> 中文说明：部分 skill（`improve-codebase-architecture`、`diagnose`、`tdd`）会读 `CONTEXT.md` 学习项目的领域语言，读 `docs/adr/` 了解过去的架构决策。它们需要知道仓库是单上下文还是多上下文（比如 monorepo 里前后端各一份），才能去对的地方找。

Confirm the layout:

- **Single-context** — one `CONTEXT.md` + `docs/adr/` at the repo root. Most repos are this.
- **Multi-context** — `CONTEXT-MAP.md` at the root pointing to per-context `CONTEXT.md` files (typically a monorepo).

### 3. Confirm and edit

Show the user a draft of:

- The `## Agent skills` block to add to whichever of `CLAUDE.md` / `AGENTS.md` is being edited (see step 4 for selection rules)
- The contents of `docs/agents/issue-tracker.md`, `docs/agents/triage-labels.md`, `docs/agents/domain.md`

Let them edit before writing.

### 4. Write

**Pick the file to edit:**

- If `CLAUDE.md` exists, edit it.
- Else if `AGENTS.md` exists, edit it.
- If neither exists, ask the user which one to create — don't pick for them.

Never create `AGENTS.md` when `CLAUDE.md` already exists (or vice versa) — always edit the one that's already there.

If an `## Agent skills` block already exists in the chosen file, update its contents in-place rather than appending a duplicate. Don't overwrite user edits to the surrounding sections.

The block:

```markdown
## Agent skills

> 语言约定：思考/代码/标识符用英文；与用户对话用中文；落盘文档（CONTEXT.md、ADR、PRD、issue）用中文正文 + 英文术语名。

### Issue tracker

[one-line summary of where issues are tracked]. See `docs/agents/issue-tracker.md`.

### Triage labels

[one-line summary of the label vocabulary]. See `docs/agents/triage-labels.md`.

### Domain docs

[one-line summary of layout — "single-context" or "multi-context"]. See `docs/agents/domain.md`.
```

Then write the three docs files using the seed templates in this skill folder as a starting point:

- [issue-tracker-local.md](./issue-tracker-local.md) — local-markdown issue tracker（默认）
- [triage-labels.md](./triage-labels.md) — label mapping
- [domain.md](./domain.md) — domain doc consumer rules + layout

For a non-default issue tracker (the user explicitly chose "Other"), write `docs/agents/issue-tracker.md` from scratch using the user's description.

### 5. Done

Tell the user the setup is complete and which engineering skills will now read from these files. Mention they can edit `docs/agents/*.md` directly later — re-running this skill is only necessary if they want to switch issue trackers or restart from scratch.
