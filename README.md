# HysSkills（本地化版）

Matt Pocock 工程方法论的本地化改造，面向 **Claude Code + 单人开发 + 中文输出**。

- **英文思考，中文输出**：思考/代码/标识符/检索用英文；与你对话用中文；落盘文档（CONTEXT.md、ADR、PRD、issue）中文正文 + 英文术语名（与代码标识符对齐）。
- **纯本地 issue tracker**：需求/任务/PRD 全部以 markdown 存在仓库 `.scratch/` 下，零网络、零账号。
- **Windows 优先**：脚本提供 PowerShell 版（git 守卫、HITL 循环、检索命令、开 HTML），Unix/WSL 版同时保留。
- **3 状态最小工作流**：`ready-for-agent` / `ready-for-human` / `done`，没有 inbox / blocked / shelved 等协作场景遗留物。

> 全局语言约定与文档布局表写在 `~/.claude/CLAUDE.md`，所有 skill 继承，**SKILL.md 自身不再重复**。

---

## 全局配置（一次性，写进 `~/.claude/CLAUDE.md`）

完整模板就是本仓库根目录的 [`CLAUDE.md`](CLAUDE.md)（7 节：语言约定 / Think Before Coding / Simplicity First / Surgical Changes / Goal-Driven / 文档布局 / CLI 工具链）。直接整份拷到 `~/.claude/CLAUDE.md`（Windows 是 `C:\Users\<你>\.claude\CLAUDE.md`）。所有 skill 都继承这几节，**各 skill 内不再重复语言约定和路径布局**——这是省 context 的关键。

一行拉取（raw 链接，按需替换分支）：

```powershell
irm https://raw.githubusercontent.com/SilentUniverse/HysSkills/main/CLAUDE.md | Set-Content "$env:USERPROFILE\.claude\CLAUDE.md"
```

```bash
curl -fsSL https://raw.githubusercontent.com/SilentUniverse/HysSkills/main/CLAUDE.md -o ~/.claude/CLAUDE.md
```

已有自定义 `CLAUDE.md` 就别整覆盖——只把缺的节按编号补进去即可。

---

## 环境配置（现代 CLI 工具链）

这些 skill 假定本机装了一组现代命令行工具。它们让 agent 能**确定性地**读写产物（尤其 `yq` 解析 frontmatter、`ast-grep` 按代码结构搜索），而不是靠脆弱的正则猜。

### 装哪些 + 干啥

| 工具 | 替代 | 在本工作流里的作用 |
|---|---|---|
| `rg`（ripgrep） | grep / Select-String | 扫 `^status:` 等 frontmatter 行、文本搜索 |
| `fd` | find | shell 管道里找文件 |
| `bat` | cat | 终端看文件（脚本里用 `bat -pp`） |
| `eza` | ls / dir | 终端列目录 |
| `jq` | — | JSON 查询/改写 |
| `yq` | sed/awk 处理 yaml | **抽取 issue frontmatter 的 status / blocked_by / refines** —— `/ship`、`/tidy` 读 DAG 靠它 |
| `ast-grep`（命令 `sg`） | grep 找代码 | 按语法树结构搜索/改写（如找 `as Type` 断言） |
| `sd` | sed 替换 | 批量 find-replace |

> **`jq` 只吃 JSON，处理 YAML frontmatter 必须用 `yq`**（mikefarah 版，jq 语法）。这是最容易踩的坑。

### Windows 一键装（winget + 一个 cargo 备选）

```powershell
winget install -e --id BurntSushi.ripgrep.MSVC --id sharkdp.fd --id sharkdp.bat `
  --id eza-community.eza --id MikeFarah.yq --id ast-grep.ast-grep --id chmln.sd `
  --accept-package-agreements --accept-source-agreements
# jq 通常已随其他工具进来；没有就： winget install -e --id jqlang.jq
```

装完**重开终端**让 PATH 生效，然后自检：

```powershell
foreach ($t in 'rg','fd','bat','jq','yq','sg','eza','sd') { "$t -> $((Get-Command $t -ErrorAction SilentlyContinue).Source)" }
```

> macOS：`brew install ripgrep fd bat eza jq yq ast-grep sd`
> Linux：用发行版包管理器或 `cargo install`（需 Rust ≥ 支持 edition2024，否则 `ast-grep` / `sd` 走二进制发行版）。

### 把工具约定写进 `~/.claude/CLAUDE.md`

全局 `CLAUDE.md` 已加 **`## 7. Modern CLI tooling`** 一节，定下「内置 Grep/Glob/Read 工具优先，落到 shell 才用 rg/fd/bat；frontmatter 用 yq、代码结构用 ast-grep」的分层规则。要点直接复制：

````markdown
## 7. Modern CLI tooling

Prefer modern tools, but respect the layering — the harness already exposes ripgrep-backed
`Grep` / `Glob` / `Read` tools with permission integration. Use those for routine search/read;
drop to a shell tool only when the built-in can't express the need.

- `grep`/`Select-String` → `rg`（只在内置 Grep 表达不了时，如管道）
- `find` → `fd`；`cat` → `bat`；`ls` → `eza`；`sed` 替换 → `sd`
- JSON → `jq`；**YAML frontmatter → `yq --front-matter=extract '.status' <file>`**
- 找代码结构 → `ast-grep`（`sg`），不是文本匹配

`jq` 只吃 JSON，YAML 必须 `yq`。`rg` 匹配文本行、`ast-grep` 匹配语法树，互补不互替。
````

---

## 安装

```powershell
# 预览
pwsh -NoProfile -File install.ps1 -DryRun

# 安装到 ~/.claude/skills（默认）
pwsh -NoProfile -File install.ps1
```

机制：扫每个 SKILL.md 的 `name` 作为软链接名，建 junction 指向源目录。**目录名保持原样**方便和原版对比；命令名由 `name` 决定。原版同名真实目录会先被备份到 `_backup-<时间戳>/`，绝不直接删。改源文件后链接立即生效。

唯一改名：`setup-hys-skills/` 的 `name` 是 `hys-setup`，所以安装后是 `/hys-setup`。其余 17 个保持原名 → **同名覆盖**原版 Matt Pocock skill。

```powershell
pwsh -NoProfile -File install.ps1 -Target "D:\custom\skills"   # 自定义目标
pwsh -NoProfile -File install.ps1 -Force                       # 跳过备份直接覆盖（慎用）
```

---

## 核心工作流（一图）

```
   ┌──────────────────────────────────────────────────────────────┐
   │ /grill-me 或 /grill-with-docs   把方案谈清楚 → CONTEXT.md/ADR│
   └────────────────────────────┬─────────────────────────────────┘
                                ↓
   ┌──────────────────────────────────────────────────────────────┐
   │ /to-prd                    .scratch/<feat>/PRD.md            │
   │  └─ 重跑默认写 PRD-v2.md（带 Supersedes 头），旧的不动        │
   └────────────────────────────┬─────────────────────────────────┘
                                ↓
   ┌──────────────────────────────────────────────────────────────┐
   │ /to-issues                 .scratch/<feat>/issues/NN-*.md     │
   │  ├─ 默认 status: ready-for-agent，带 frontmatter + 依赖 DAG   │
   │  ├─ 重跑时给"对账报告"：留 / 改 / redo / 删 / 新增            │
   │  └─ 加细节：/to-issues "在 NN 上加 X" → detail 类，refines 指回 │
   └────────────────────────────┬─────────────────────────────────┘
                                ↓
   ┌──────────────────────────────────────────────────────────────┐
   │ /ship <feat>   编排：拓扑分波 → 派 subagent 跑 /tdd → 验证门  │
   │  ├─ 同波次各自 git worktree 并行跑，跑完串行 merge-back        │
   │  ├─ ready-for-agent 自动跑完，ready-for-human 汇成人工清单     │
   │  └─ done 攒够 → 提示 /tidy；context 紧 → 自动 /handoff         │
   │  · 三种跑法：/ship（会话内）· /ship-wf（后台编排 workflow）    │
   │             · /loop ship（跨 context 自驱）                    │
   └────────────────────────────┬─────────────────────────────────┘
                                ↓
   ┌──────────────────────────────────────────────────────────────┐
   │ /tidy <feat>   垃圾回收（done≈8+ 触发）                │
   │  ├─ done issue 移进 issues/archive/（git mv，不改 body）       │
   │  ├─ 重生成 SUMMARY.md（聚合完成记录 = 已建成现实视图）        │
   │  └─ 审计僵尸/重复测试 + 孤儿 issue 检测                        │
   └──────────────────────────────────────────────────────────────┘
```

需求又变 → 回到 `/grill-with-docs` 写新 ADR（标 `Supersedes:` 旧决策）→ `/to-prd` 写 `PRD-v2.md` → `/to-issues` 给对账报告。`done` 的 issue 永远不动；要改的话新建 `redo-X.md`。

> **三个新环节解决三个老痛点**：`/ship` 把"口头派发 subagent"固化成带验证门的编排器；`/tidy` 给膨胀的 issue/测试做垃圾回收，PRD 不再需要时刻保鲜（现实视图交给自动重生成的 `SUMMARY.md`）；`/resume` 是 `/handoff` 的逆操作，一句话跨 session 续命。所有产物的 frontmatter / 索引 / 目录契约统一在 [`engineering/ARTIFACT-FORMAT.md`](engineering/ARTIFACT-FORMAT.md)。

---

## 状态机（3 状态，仅此而已）

| 状态 | 意思 |
|---|---|
| `ready-for-agent` | 写清楚了，丢给 subagent 后台跑 |
| `ready-for-human` | 写清楚了，需要你坐键盘前判断 / 设计 / 真机验 |
| `done` | 完工，**不可改**——git 已有 commit，要返工就新建 redo |

**不存在的状态**：inbox（写下来就要么是 ready-for-X 要么删）、blocked（卡了就直接备注在 issue 里继续做或新开一刀）、shelved（不做就直接删文件，理由进 commit message 或 ADR）。

### 怎么看状态

VS Code：`Ctrl+Shift+F` → 勾正则 → 搜 `^status: ready-for-agent`，按文件分组查看。

终端一行命令（`-g` glob 天然排除 `archive/`，只扫活跃集）：

```bash
rg '^status: ready-for-agent' -g '**/issues/*.md' .scratch    # 可丢 agent 的
rg '^status: ready-for-human' -g '**/issues/*.md' .scratch    # 我亲自做的
```

想确定性读某 issue 的单个字段（状态 / 依赖 / refines），用 `yq --front-matter=extract '.status' <file>`，别手撸正则。要看 done / archived 的计数与全局花名册，读 `.scratch/INDEX.md`（自动维护）；要看某 feature「已建成什么」，读 `.scratch/<feat>/SUMMARY.md`（自动重生成）。

---

## 三条核心规则（不要破坏）

1. **`done` 不可改**。要修订 done 的 issue → 新建 `NN-redo-X.md`，旧的保留。事实和 git 必须一致。
2. **重跑 `/to-prd` 默认写 PRD-v2.md**。旧 PRD 不动。除非你明说"补充到现有 PRD"，那才追加 `## 修订` 段。
3. **AC 只写本切片新加的行为**。前置条件靠 `前置依赖:` 串联，不要把上一刀已经测过的内容（schema、auth、validation）复述在下一刀的 AC 里。tdd 跑之前会扫已有测试，已覆盖的 AC 会自动跳过并备注。

---

## 自动化阶梯（手动 → 全自动，全保留）

同一批 `ready-for-agent` issue、同一道验证门，从全程手动到无人值守有五个层级。按"量有多大、你想盯多紧"挑，没有哪个取代哪个：

| 层级 | 命令 | 形态 | 何时用 |
|---|---|---|---|
| 单条手动 | `/tdd <issue-path>` | 跑指定一条，全程可见 | 想盯着做某一条 |
| 串行排空 | `/tdd`（裸跑）/ `/tdd <feat>` | 按依赖顺序**串行**跑完所有 ready，无 worktree、无并行、无 tidy | 少量收尾，想在本会话逐条看着排空 |
| 会话内编排 | `/ship <feat>` | 分波、**各自 worktree 并行**、串行 merge-back、自动 tidy | 量大或想要并行，但仍想盯着、随时打断 |
| 后台编排 | `/ship-wf` | 同 `/ship`，后台 workflow、结构化 agent、不占主 context | 一次无人值守把一个 feature 跑完 |
| 跨 context 自驱 | `/loop ship` | 每轮自唤醒、读盘续命，串行但抗 context 爆 | 跨多个 context 窗口的大 epic |

**两条易混的线：**

- **裸 `/tdd` vs `/ship`** —— 都排空 backlog。裸 `/tdd` 是"笨而清晰的串行"（无并行、无收拢、无清理，全在当前会话）；`/ship` 是"聪明的编排"（worktree 并行 + merge-back + 自动 tidy）。同样的 issue、同样的验证门。
- **`/ship` vs `/ship-wf` vs `/loop ship`** —— 同一套编排逻辑的三种运行时：会话内 skill（看得见、可打断）、后台 workflow（不占主 context）、自驱（跨 context 续命）。`/ship-wf` 是把 `.claude/workflows/ship-wf.js` 自动注册成的原生动态命令（直接敲 `/ship-wf`，不是 `/workflow ship-wf`；`/workflows` 复数是浏览运行记录）。命名 `ship-wf` 是为了不和 `/ship` skill 撞车。

**典型节奏：** 周一上午搜 `^status: ready-for-human` 挑一条手动做；周五下午 `/ship <feat>`（或量特别大时 `/ship-wf`）然后下班；少量零散收尾直接裸 `/tdd` 串行排空。

> 所有层级都只碰 `ready-for-agent`。定方向（`grill` / `to-prd` / `to-issues`）和每个 `ready-for-human` 门永远留给你。

---

## 两种入场场景

按你接手项目的姿势挑一条线。两条线的结局都汇入"持续开发"。

### 场景 A：从 0 到 1 新建项目

**第 1 步 — 项目骨架（跑一次，10 分钟）**

```
/hys-setup
```

回答三个问题：issue tracker（默认本地 markdown 直接选）/ 状态词汇（默认 3 状态直接选）/ 文档布局（一般 single-context）。完事后仓库多了 `docs/agents/`、`CLAUDE.md` 里多了 `## Agent skills` 块。

按需配两个一次性 skill：

- 用 git？跑 [`git-guardrails-claude-code`](misc/git-guardrails-claude-code/SKILL.md) 拦 `git push --force` 等危险命令
- 用 npm/pnpm？跑 [`setup-pre-commit`](misc/setup-pre-commit/SKILL.md) 装 commit 钩子

**第 2 步 — 第一个 feature**

1. 方案不清楚 → `/grill-me`（只拷问，不落盘）或 `/grill-with-docs`（拷问 + 把术语/决策落进 CONTEXT.md/ADR）。口诀：结论要长期留档用后者，临时想清楚用前者
2. 方案有不确定的设计点 → `/prototype` 造一次性原型验证（用完扔）
3. `/to-prd` 写 `.scratch/<feat>/PRD.md`——**显式写明"涉及 `<具体路径>`"**，给后续 skill 留路标
4. `/to-issues` 拆成 `.scratch/<feat>/issues/NN-*.md`，默认 `status: ready-for-agent`（带 frontmatter + 依赖 DAG）
5. `/ship <feat>` 一次跑完所有 ready-for-agent 的；或 `/tdd <issue-path>` 单跑一条

**第 3 步 — 维护好 `CONTEXT.md`**

每次 `/grill-with-docs` 把决策落进 `CONTEXT.md` 时，**带上代码路径**：

```markdown
## Account（账户）
持有余额的实体。代码：`src/domain/account.py` 的 `Account` 类。
不变量：余额非负；冻结状态下禁止 debit。
```

这一份的回报随项目增大而指数增长——后面 skill 不再从根目录扫代码。

→ 之后进入 [持续开发](#持续开发)。

---

### 场景 B：接收已有成熟项目

老项目的最大坑是 **agent 会反复扫代码**。第一次接入花一个小时建"代码地图"，省后续无数次 token。

**第 1 步 — 建立代码地图（最高杠杆的投入）**

针对核心 2-3 个模块，逐个跑：

```
/grill-with-docs   # 谈这块的术语，写进 CONTEXT.md，每个术语带代码路径
```

> **第一遍别被逐条打断**：CONTEXT.md 还空着时，`/grill-with-docs` 自动进 **draft 模式**——一次性起草整份术语表、全用推荐答案、标 `(draft)`，只摆给你**审一次**，不逐个术语问。只有"代码自相矛盾 / 它确实没把握"的少数才回头问你。第二遍起才回到逐条 relentless 模式。

（想先看懂某块陌生代码、不落盘 → 用 `/zoom-out <path>` 拿"地图视角"，即用即走。）

终点是一份 `CONTEXT.md`（多 context 仓库则是多份 + 根目录一张 `CONTEXT-MAP.md` 索引），agent 看一眼就知道哪个概念对应哪个文件，每个 session 只载入相关那一小片。

**第 2 步 — 接入工具链**

```
/hys-setup
```

它的 step 2 会自动检测旧状态：

- **Case 3 — 旧 `mattpocock/skills` 状态**（5 状态或 6 状态）：选 (a) 切换到 3 状态，逐条问你怎么处理已有 issue
- **Case 4 — PRD/issue 在非默认路径**（`docs/prd/`、`requirements/` 等）：默认选 (i) 配置指向现有路径，**不动文件**
- **Case 5 — 旧 issue 只有 bare `Status:` 行、没 frontmatter**：先给你一张 dry-run 迁移计划（哪些加 frontmatter、哪些 done 移进 archive、生成哪些索引），确认后才落盘。幂等，可反复重跑。

按需配 [`git-guardrails`](misc/git-guardrails-claude-code/SKILL.md) 和 [`setup-pre-commit`](misc/setup-pre-commit/SKILL.md)。

**第 3 步 — 第一个动作**

- 要做改动 → 走 [持续开发 - 修改已有需求](#持续开发)
- 要修 bug → `/diagnose` 走 6 阶段诊断
- 要重构架构 → `/improve-codebase-architecture`（基于刚写好的 CONTEXT.md 找深化机会）

→ 之后进入 [持续开发](#持续开发)。

---

## 持续开发

A、B 两条线都流到这里。下面按真实场景排，**每节末尾标注哪些是省 token 的关键 tips**。

### 新 session 怎么开始

**没有"开机仪式"**。skill 按需触发，你不点它就不进 context。新 session 直接说要干啥：

| 场景 | 第一句敲什么 |
|---|---|
| 继续做某条已有 issue | `/tdd <issue-path>` |
| 一次跑完某 feature 的 ready-for-agent issue | `/ship <feat>` |
| 上一 session 留了 handoff | `/resume`（自动找最近 active handoff、校验 baseline、按"开机动作序列"续） |
| 不记得做到哪了 | 终端跑 `rg '^status:' -g '**/issues/*.md' .scratch` 或读 `.scratch/INDEX.md`（眼睛看，**不**让 agent 看） |
| 全新需求 | 见 [新需求来了](#新需求来了) |
| 修改老需求 | 见 [修改已有需求](#修改已有需求) |

> **省 token tip**：能传具体路径（`<issue-path>`）就别让 agent 探索仓库；眼睛能看清的清单别让 agent 帮你看。

### 新需求来了

1. **方案够清楚吗？** 不清楚 → 拷问；清楚 → 直奔 `/to-prd`
   - `/grill-me` —— 只拷问，不落盘。临时捋顺思路、一次性决策用。
   - `/grill-with-docs` —— 同样的拷问，**外加**把术语写进 `CONTEXT.md`、架构决策写进 `docs/adr/`。结论要长期留档时用。
   - 口诀：**聊完三天后还需要有人知道"为什么这么定"→ `grill-with-docs`；只是当下想清楚 → `grill-me`**。两者拷问过程完全一样（同一个 `grilling` 引擎），只差落不落盘。
2. **设计点不确定？** → `/prototype` 验证完再写 PRD
3. `/to-prd` 写 PRD（重跑会先扫匹配的旧 PRD，三选项让你确认）
4. `/to-issues` 拆 issue（自动带 frontmatter + 依赖 DAG）
5. `/ship <feat>` 一次跑完 ready-for-agent 的；或 `/tdd <issue-path>` 单跑一条

> **省 token tip**：讨论方案不要在主对话框来回——上下文会爆。要么走 grill 系列拷问（结构化），要么写进 ADR（持久化）。三天后回头看，主对话框的讨论已经被 compact 没了，ADR 还在。

> **加小细节不要污染 PRD**：临时想给某切片加个子行为，别重写 PRD——`/to-issues "在 03-balance-api 上加 X"` 建一个 `category: detail` 的 issue，`refines:` 指回父切片。它仍可追溯、不会变成孤儿。攒多了 `/tidy` 会把它折进 `SUMMARY.md`。PRD 只在**意图真的变了**时才出新版本。

### 修改已有需求

第一步永远先问：**老 issue 的 status 是 ready 还是 done？**

| 状态 | 怎么改 |
|---|---|
| `ready-for-agent` / `ready-for-human` | 直接编辑文件 / 加新文件 / 删文件——还没承诺过，没历史包袱 |
| `done` | **不可改**。流程：`/to-prd` 重跑（默认写 `PRD-v2.md`） → `/to-issues` 重跑给对账报告（哪些留 / 哪些 redo / 哪些删 / 哪些新增）→ `/ship` 或 `/tdd <new-redo-issue>` 跑新切片 |

**架构整体反转**（不只一个 feature 变了，是底层决策反转）：先 `/grill-with-docs` 写新 ADR 标 `Supersedes:` 旧 ADR，再走"老 issue 已完工"流程。

> **省 token tip**：tdd 跑 redo / fix 类 issue 时会**靠 `refines:` 字段找原 issue 的完工记录**，列出当时新增的测试文件让你决定改 / 删 / 留——避免留下僵尸测试。周期性兜底交给 `/tidy` 的测试审计。

### ADR 什么时候会写

`docs/adr/NNNN-slug.md` **不是任何一步自动产出的**，而是两个 skill 在特定条件下**主动提议**写，且故意克制——不轻易写。

**两个产出点：**

1. **`/grill-with-docs`（拷问方案时）** —— 只有三个条件**同时成立**才提议：
   - **难以反悔** —— 以后改主意代价很大
   - **脱离上下文会让人困惑** —— 未来读代码的人会问"为啥这么搞"
   - **是真实权衡的结果** —— 当时确实有别的选项，你为具体理由选了这个

   缺一个就跳过。例：「用 camelCase 命名」不写（可逆、不意外）；「改用事件溯源存订单」才写（难反悔、会困惑、有取舍）。

2. **`/improve-codebase-architecture`（架构回顾时）** —— 当你**否决一个重构建议、且理由有分量**时，它会问要不要记成 ADR，用来**钉住一个"不要这么做"的决定**，免得以后的回顾重复建议。临时理由（"现在没空"）不写。

**什么时候不会写：** `/to-prd`、`/to-issues`、`/tdd`、`/ship` 都不写 ADR；可逆、显而易见、或纯属当下偷懒的理由也跳过。

**和 `CONTEXT.md` 的分工（别混）：**

| 文件 | 记什么 | 触发 |
|---|---|---|
| `CONTEXT.md` | 术语 / 概念定义（**是什么**） | grill 时术语一确定就**立即**写，不攒着 |
| `docs/adr/` | 架构决策（**为什么这么选**） | 满足上面三条件时**提议**写 |

`docs/adr/` 目录懒创建——第一次真要写 ADR 时才建，不会预先生成。**被新 ADR 取代的旧 ADR 不可改**，只标 superseded，新决策由新 ADR 承载（和 issue `done` 不可改同一套规矩）。

### 发现 bug

`/diagnose` 走 6 阶段。如果是已完工 issue 的回归，在原 feature 目录新建 `NN-fix-X.md`（`category: fix`，`refines:` 指回原切片）走 `/tdd` 流程；如果是基础架构 bug，独立处理不挂任何 PRD。

### Context 快满 / 准备切 session

**触发条件**：你感觉模型回答开始变慢、变笨、复述早期对话、或对话历史已经卷起来看不见底了。

**两个真解法 + 一个伪解法**：

| 情况 | 用什么 | 原理 |
|---|---|---|
| 任务还没收尾，但 5 轮内能完 | `/compact` | 机械压缩，凑合用 |
| 任务还有半天的活 | `/handoff` + `/clear` | 主动丢弃探索过程，只留决策——信息密度比 compact 高 |
| 接下来要读大文件 / 探索陌生模块 | 让 agent 开 subagent 做，只回报结论 | 大消耗在 subagent 自己的 context 里，不进主对话框 |
| 任务做了一半发现要做另一件 | `/handoff` 当前的 → `/clear` → 新 session 做新的 | 别让两件事的 context 混在一起 |

```
/handoff <下个 session 要干啥>
```

写 6 段骨架的交接文档：**feature 相关**的滚动写到 `.scratch/<feat>/handoff.md`（带 frontmatter，和该 feature 的 PRD/issue 同处，永远不散落）；**跨 feature** 的才进 `docs/handoffs/<日期>-<主题>.md`。每次写都会刷新 `docs/handoffs/LATEST.md` 指针。**第 4 段"关键口径清单"是核心**——决策可以丢，决策的"为什么"不能丢。

**下一个 session 怎么续**：直接敲一句（不需要任何前置仪式、不用记路径）：

```
/resume
```

`/resume` 读 `LATEST.md` 找到最近 `status: active` 的 handoff，**校验它的 `git_base` 和当前 HEAD 是否一致**（HEAD 动过会警告并列出 `git log`），然后执行它的"开机动作序列"。续指定 feature 用 `/resume <feat>`。工作收尾后它把 handoff 标 `consumed`。

> **频率建议**：长任务每天结束前留一份；快跑的小任务做完直接关；多 session 跨越的 epic 在每次切换前都留一份。
>
> **反例**：上一 session 工作已完整结束（issue 已 `status: done`）→ **不要写 handoff**，也不要 `/resume` 续上。下个 session 直接 `/tdd <next-issue-path>` 或 `/ship <feat>` 进下一条。handoff 是给"半截工作"留的桥，不是切 session 的仪式。

### 让 token 缓存效率最大化

Claude Code 用 prompt caching：**对话前缀稳定不变的内容不重复算钱**。前缀越稳 + 越长，缓存越值钱，频繁修改的内容（issue 文件、PRD）放在对话靠后。4 条具体姿势：

1. **保持 CLAUDE.md / SKILL.md 不变** — 这就是为什么全局规则只放 `~/.claude/CLAUDE.md` 一处，各 skill 不重复语言约定。CLAUDE.md 整段进缓存，几乎免费。
2. **同 session 内别中途插大块陕生内容** — 比如做着 issue 01 中途让 agent 把 `docs/architecture-overview.md` 整篇读一下聊聊——50KB 进 context 后，**之后所有调用的前缀都变长了**。聊大文档另开 session 或用 subagent 隔离。
3. **不要把 PRD / issue 内容粘贴到对话里** — 让 agent 用 file read 工具读。粘贴会插在对话开头之后，**破坏前缀稳定性**。直接说"读 `.scratch/balance/issues/02-foo.md`" 比把内容复制过来好得多。
4. **整文件读 > 多次 grep 摸索** — 当你已经知道哪个文件相关时，让 agent 一次读完，比 5 次 grep 更省。**整文件读会进缓存，下次再读几乎免费**；散乱 grep 缓存利用率低且工具调用本身贵。这就是 `CONTEXT.md` 写明代码路径价值最大的地方——它让 agent 跳过 grep 阶段，直接整文件读。

### 避免每次都重新扫代码仓

主流程 skill 都有 "explore codebase" 一步。**真正的浪费不是它扫，而是它每次都从零开始扫**。三层解：

| 法子 | 一次投入 | 长期收益 |
|---|---|---|
| 写好 `CONTEXT.md`（**带代码路径**） | 跑 `/grill-with-docs` 时附上文件路径 | 之后所有 skill 直接定位文件，省 80% 探索 |
| PRD 写明涉及模块 | `/to-prd` 时显式说"涉及 `src/services/balance/`" | `/to-issues`、`/tdd` 接力时直接读 PRD 里写好的，不再扫 |
| `/zoom-out` 临时看懂单模块 | `/zoom-out <path>` 即用即走（只读不落盘） | 快速理解一块陌生代码；要长期保留改用 `/grill-with-docs` 落盘 |

最简单的一条：**别说"做一下 X 功能"，直接说"在 `<file>` 实现 X，按 CONTEXT.md 里的 Y 概念扩展"**。给 agent 越具体的入手点，它探索范围越小。

### 两条经验法则

- **新需求第一步永远问"方案够清楚吗"**。不清楚走 grill 系列；清楚就直奔 `/to-prd`。
- **改需求第一步永远问"老 issue 是 ready 还是 done"**。ready 直接编辑；done 必须新建 redo，永不修改原文件。

---

## 栈适配（极简）

skill 本身栈无关。项目级把这三件事固化到自己的 `docs/agents/domain.md`：

- **测试发现规则**：pytest.ini / `package.json` scripts / `build.gradle` 之类
- **常用命令**：跑测试 / 跑 lint / 启动 dev server / 部署
- **栈特定环境**：Android ADB 食谱、Web e2e 配置等

固化一次后所有 skill 引用同一套词汇。**仓库级 README 不展开栈细节**——那会让仓库越用越臃肿。

### ADB 速查（Android 项目）

把以下命令记进项目的 `domain.md`：

```powershell
adb logcat -c; <trigger>; adb logcat -d | rg "Tag"     # 清→触发→抓日志
adb exec-out screencap -p > screenshot.png             # 截图（写进 ready-for-human 的 AC）
adb logcat -b crash -d                                 # 抓 crash / ANR
```

更多快反馈循环类型（HITL 脚本、UI 自动化、录制回放）见 [diagnose](engineering/diagnose/SKILL.md) 的 phase 1。

---

## skill 一览

### 主流程（按使用顺序）

| skill | 何时用 |
|---|---|
| [hys-setup](engineering/setup-hys-skills/SKILL.md) | 项目首次接入跑一次，配置 issue tracker / 状态 / 文档布局；Case 5 迁移旧文件到 frontmatter |
| [grill-me](productivity/grill-me/SKILL.md) / [grill-with-docs](engineering/grill-with-docs/SKILL.md) | 拷问方案逼出决策。`grill-me` 只拷问不落盘（临时想清楚）；`grill-with-docs` 拷问 + 把术语/决策写进 CONTEXT.md/ADR（要长期留档）。底层同一个 [grilling](productivity/grilling/SKILL.md) 引擎 |
| [prototype](engineering/prototype/SKILL.md) | 写代码前造一次性原型验证方案（用在 `/to-prd` **之前**） |
| [to-prd](engineering/to-prd/SKILL.md) | 对话变 PRD（版本化意图快照，重跑默认 supersede） |
| [to-issues](engineering/to-issues/SKILL.md) | PRD 拆 issue（frontmatter + 依赖 DAG，重跑给对账报告，支持 detail 子切片） |
| [ship](engineering/ship/SKILL.md) | 编排一个 feature 的 ready-for-agent issue 跑完（拓扑排序 + 验证门，tdd 之上的一层） |
| [tdd](engineering/tdd/SKILL.md) | 跑红绿循环：`<path>` 单条 · 裸跑串行排空所有 ready · `<feat>` 排空单 feature |
| [tidy](engineering/tidy/SKILL.md) | 垃圾回收：归档 done、重生成 SUMMARY、审计测试 + 孤儿 issue |
| [diagnose](engineering/diagnose/SKILL.md) | 6 阶段诊断硬 bug |
| [zoom-out](engineering/zoom-out/SKILL.md) | 不熟的代码请求"地图视角" |
| [improve-codebase-architecture](engineering/improve-codebase-architecture/SKILL.md) | 阶段性回顾找架构深化机会（架构词汇调 [codebase-design](engineering/codebase-design/SKILL.md)） |

> 所有产物的 frontmatter / 索引 / 目录契约见 [ARTIFACT-FORMAT.md](engineering/ARTIFACT-FORMAT.md)。

### 共享引擎（通常被上面的 skill 调用，也可单独喊）

这三个是把重复内容抽出来的「单一事实源」。`grill-*`、`improve-codebase-architecture` 都是薄壳，运行时 `/调用` 它们。好处：词汇/纪律只定义一处，改一处全仓生效；SKILL.md 更短，prompt cache 命中更好。它们没设 `disable-model-invocation`，所以**你也能单独喊**——当只想用其中一块能力、不必启动整个工作流时。

| skill | 承载什么 | 工作流里谁调它 | 你单独喊它的场景 |
|---|---|---|---|
| [grilling](productivity/grilling/SKILL.md) | 裸采访循环（逐条走决策树，一次一问）。auto-invoke | grill-me / grill-with-docs / improve-codebase-architecture | 等价 `/grill-me`：临时拷问想清楚一件事，不落盘 |
| [domain-modeling](engineering/domain-modeling/SKILL.md) | CONTEXT.md/ADR 维护纪律 + **draft 模式**（首次空仓一次性起草术语表）+ 格式约定 | grill-with-docs（拷问时落盘 / 老项目建术语表走 draft）；improve-codebase-architecture（定新模块名、否决建议记 ADR） | 只想补/整理术语表或补一条 ADR，不必走完整拷问 |
| [codebase-design](engineering/codebase-design/SKILL.md) | deep-module 词汇表（module/interface/depth/seam/adapter/leverage/locality）+ 深化纪律 + design-it-twice | improve-codebase-architecture（全程用其词汇；探索接口时调 design-it-twice 并行起 subagent） | 设计单个新模块的接口、纠结 seam 放哪、想让代码更可测，但不必走完整架构回顾 |

> **使用时**：走完整工作流就不用管这些引擎——喊 `/grill-with-docs`、`/improve-codebase-architecture` 即可，它们内部调谁是它们的事。只想用单块能力时，按上表最后一列单独喊。
>
> **维护/扩展这套 skill 时**才需要知道：内容只在引擎里定义一次，要改就改引擎那一处——
> - 改架构词汇（给 `seam` 补定义、加新术语）→ 只改 `codebase-design/SKILL.md`
> - 改术语 / ADR 纪律（如"何时该写 ADR"的判据）→ 只改 `domain-modeling/SKILL.md`
> - **别在消费方（`improve-codebase-architecture` 等）里再抄一份词汇定义**——那会让两处漂移，正是这次重构要消灭的老问题。

### 元工作流

- [handoff](productivity/handoff/SKILL.md) — 交接文档，跨 session 续命（6 段骨架 + frontmatter + LATEST 指针）
- [resume](productivity/resume/SKILL.md) — handoff 的逆操作：找最近 active handoff、校验 baseline、按开机序列续上
- [caveman](productivity/caveman/SKILL.md) — 中文极简输出模式（省 ~70% token）
- [teach](productivity/teach/SKILL.md) — 多 session 教学（不限编码场景）
- [write-a-skill](productivity/write-a-skill/SKILL.md) — 写新 skill 的元规范

### 一次性配置（项目首次接入时配一次，之后忘掉）

| skill | 干啥 |
|---|---|
| [git-guardrails-claude-code](misc/git-guardrails-claude-code/SKILL.md) | Claude Code 钩子，拦 `git push --force` / `reset --hard` / `clean -fd` 等危险命令，**防 agent 闯祸** |
| [setup-pre-commit](misc/setup-pre-commit/SKILL.md) | Husky + lint-staged，commit 时自动跑 prettier / typecheck / test |
| [migrate-to-shoehorn](misc/migrate-to-shoehorn/SKILL.md) | TS 测试 codemod：`as Type` → `fromPartial({})`，类型安全。**仅限 TS 项目** |

> ~~triage~~ 已删除 — 单人开发不需要"维护者评估 issue"那套状态机。
