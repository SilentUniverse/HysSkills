# HysSkills（本地化版）

Matt Pocock 工程方法论的本地化改造，面向 **Claude Code + 单人开发 + 中文输出**。

- **英文思考，中文输出**：思考/代码/标识符/检索用英文；与你对话用中文；落盘文档（CONTEXT.md、ADR、PRD、issue）中文正文 + 英文术语名（与代码标识符对齐）。
- **纯本地 issue tracker**：需求/任务/PRD 全部以 markdown 存在仓库 `.scratch/` 下，零网络、零账号。
- **Windows 优先**：脚本提供 PowerShell 版（git 守卫、HITL 循环、检索命令、开 HTML），Unix/WSL 版同时保留。
- **3 状态最小工作流**：`ready-for-agent` / `ready-for-human` / `done`，没有 inbox / blocked / shelved 等协作场景遗留物。

> 全局语言约定与文档布局表写在 `~/.claude/CLAUDE.md`，所有 skill 继承，**SKILL.md 自身不再重复**。

---

## 全局配置（一次性，写进 `~/.claude/CLAUDE.md`）

下面整段直接复制到 `~/.claude/CLAUDE.md`（Windows 是 `C:\Users\<你>\.claude\CLAUDE.md`）。所有 skill 都会继承这两节，**因此各 skill 内不再重复语言约定和路径布局**——这是省 context 的关键。

````markdown
## 1. Think in English, respond in Chinese

- **Thinking, code, identifiers, file names, search queries:** English
- **All responses to the user:** Chinese
- **Written artifacts** (CONTEXT.md, ADR, PRD, `.scratch/` issues, handoffs): Chinese body + English term names. Term names must match code identifiers exactly. Example: `Reconciliation（对账）：指…`

## 6. Local document layout

Standard artifact locations. Skills read/write these paths — do not invent alternatives.

| Artifact | Path | Producer |
|---|---|---|
| Domain glossary | `CONTEXT.md` (repo root) | `/grill-with-docs` |
| Architecture decisions | `docs/adr/NNNN-slug.md` | `/grill-with-docs`, `/improve-codebase-architecture` |
| Requirements snapshot (PRD) | `.scratch/<feat>/PRD.md` (revisions: `PRD-v2.md`, ...) | `/to-prd` |
| Implementation tasks | `.scratch/<feat>/issues/NN-slug.md` | `/to-issues` |
| Session handoffs | `docs/handoffs/<date>-<topic>.md` | `/handoff` |
| Skill config | `docs/agents/` | `/hys-setup` |

**Immutability rules:**

- An issue with `Status: done` is **immutable** — never edit its body or change its `Status`. The git commit is the source of truth. To revise, create a new redo issue (`NN-redo-<slug>.md`).
- An ADR superseded by another ADR is **immutable** — never edit its body. Mark it superseded; the new ADR carries the change.
- Re-running `/to-prd` defaults to writing a new `PRD-vN.md` with a `Supersedes:` header; the older PRD stays untouched. Append-in-place is reserved for purely additive changes the user explicitly asks for.
````

如果你的 `CLAUDE.md` 还有别的章节（如 "2. Think Before Coding"、"3. Simplicity First" 等），保留即可——这两节按编号插进去就行。

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
   │  ├─ 默认 Status: ready-for-agent                              │
   │  └─ 重跑时给"对账报告"：留 / 改 / redo / 删 / 新增            │
   └────────────────────────────┬─────────────────────────────────┘
                                ↓
   ┌──────────────────────────────────────────────────────────────┐
   │ /tdd <issue-path>          按 Status: 自动选模式               │
   │  ├─ ready-for-agent → 闷头跑红绿循环（可批量丢 subagent 并行）│
   │  ├─ ready-for-human → 每个决策点停下问你                       │
   │  └─ 跑完写 done + commit hash + 完工记录到 ## Comments         │
   └──────────────────────────────────────────────────────────────┘
```

需求又变 → 回到 `/grill-with-docs` 写新 ADR（标 `Supersedes:` 旧决策）→ `/to-prd` 写 `PRD-v2.md` → `/to-issues` 给对账报告。`done` 的 issue 永远不动；要改的话新建 `redo-X.md`。

---

## 状态机（3 状态，仅此而已）

| 状态 | 意思 |
|---|---|
| `ready-for-agent` | 写清楚了，丢给 subagent 后台跑 |
| `ready-for-human` | 写清楚了，需要你坐键盘前判断 / 设计 / 真机验 |
| `done` | 完工，**不可改**——git 已有 commit，要返工就新建 redo |

**不存在的状态**：inbox（写下来就要么是 ready-for-X 要么删）、blocked（卡了就直接备注在 issue 里继续做或新开一刀）、shelved（不做就直接删文件，理由进 commit message 或 ADR）。

### 怎么看状态

VS Code：`Ctrl+Shift+F` → 勾正则 → 搜 `^Status: ready-for-agent`，按文件分组查看。

PowerShell 一行命令：

```powershell
sls -Path .scratch\**\issues\*.md -Pattern '^Status: ready-for-agent'    # 可丢 agent 的
sls -Path .scratch\**\issues\*.md -Pattern '^Status: ready-for-human'    # 我亲自做的
sls -Path .scratch\**\issues\*.md -Pattern '^Status: done'               # 完工清单
```

---

## 三条核心规则（不要破坏）

1. **`done` 不可改**。要修订 done 的 issue → 新建 `NN-redo-X.md`，旧的保留。事实和 git 必须一致。
2. **重跑 `/to-prd` 默认写 PRD-v2.md**。旧 PRD 不动。除非你明说"补充到现有 PRD"，那才追加 `## 修订` 段。
3. **AC 只写本切片新加的行为**。前置条件靠 `前置依赖:` 串联，不要把上一刀已经测过的内容（schema、auth、validation）复述在下一刀的 AC 里。tdd 跑之前会扫已有测试，已覆盖的 AC 会自动跳过并备注。

---

## 单人 + agent 的实操模式

**周一上午**：开 IDE，搜 `^Status: ready-for-human`，挑一条坐下来做。
**周五下午**：搜 `^Status: ready-for-agent`，对主对话框说："并行丢这 3 条给 subagent 跑"，然后下班——主 agent 会 fan-out 三个 subagent，每个独立走 `/tdd <path>`，完工自动写回。

不需要为"批量"专门做新工具。Claude Code 自带的 subagent 编排能力 + 每个 issue 独立的 `Status:` 行就够了。

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

1. 方案不清楚 → `/grill-me`（轻量）或 `/grill-with-docs`（同步写 ADR/CONTEXT.md）
2. 方案有不确定的设计点 → `/prototype` 造一次性原型验证（用完扔）
3. `/to-prd` 写 `.scratch/<feat>/PRD.md`——**显式写明"涉及 `<具体路径>`"**，给后续 skill 留路标
4. `/to-issues` 拆成 `.scratch/<feat>/issues/NN-*.md`，默认 `Status: ready-for-agent`
5. `/tdd <issue-path>` 跑实现；或对主对话框说"并行跑这几个 ready-for-agent 的 issue"批量分发

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

大项目先跑一次自动 bootstrap，把"该去哪看"的索引一次性建出来：

```
/map-codebase
```

它**只读**扫全仓，自动产出根目录 `CONTEXT-MAP.md`（模块清单 + 推断的关系，每条标 `(draft — verify)`）和每个模块的 `CONTEXT.md` stub（带代码路径）。这一步替代了过去"`/zoom-out` 看完再手动粘进文档"的体力活。

地图是 **draft**，边界（bounded context）不一定等于文件夹。接着对你**即将动工**的模块逐个跑：

```
/grill-with-docs   # 填这块的术语 + 修正边界，写进该模块的 CONTEXT.md，每个术语带代码路径
```

> **第一遍别被逐条打断**：CONTEXT.md 还空着（或只有 map-codebase 的 stub）时，`/grill-with-docs` 自动进 **draft 模式**——一次性起草整份术语表、全用推荐答案、标 `(draft)`，只摆给你**审一次**，不逐个术语问。只有"代码自相矛盾 / 它确实没把握"的少数才回头问你。第二遍起才回到逐条 relentless 模式。

（单个陌生模块临时想看懂、不落盘 → 用 `/zoom-out <path>`。）

终点是一张 `CONTEXT-MAP.md` 索引 + 多个小而稳的模块 `CONTEXT.md`，agent 每个 session 只载入相关那一小片，不再全仓扫。

**第 2 步 — 接入工具链**

```
/hys-setup
```

它的 step 2 会自动检测旧状态：

- **Case 3 — 旧 `mattpocock/skills` 状态**（5 状态或 6 状态）：选 (a) 切换到 3 状态，逐条问你怎么处理已有 issue
- **Case 4 — PRD/issue 在非默认路径**（`docs/prd/`、`requirements/` 等）：默认选 (i) 配置指向现有路径，**不动文件**

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
| 上一 session 留了 handoff | `读 docs/handoffs/<file>.md，按"开机动作序列"继续` |
| 不记得做到哪了 | 终端跑 `sls -Path .scratch\**\issues\*.md -Pattern '^Status:'`（眼睛看，**不**让 agent 看） |
| 全新需求 | 见 [新需求来了](#新需求来了) |
| 修改老需求 | 见 [修改已有需求](#修改已有需求) |

> **省 token tip**：能传具体路径（`<issue-path>`）就别让 agent 探索仓库；眼睛能看清的清单别让 agent 帮你看。

### 新需求来了

1. **方案够清楚吗？** 不清楚 → `/grill-me` 或 `/grill-with-docs` 拷问；清楚 → 直奔 `/to-prd`
2. **设计点不确定？** → `/prototype` 验证完再写 PRD
3. `/to-prd` 写 PRD（重跑会先扫匹配的旧 PRD，三选项让你确认）
4. `/to-issues` 拆 issue
5. `/tdd <issue-path>` 实现

> **省 token tip**：讨论方案不要在主对话框来回——上下文会爆。要么走 grill 系列拷问（结构化），要么写进 ADR（持久化）。三天后回头看，主对话框的讨论已经被 compact 没了，ADR 还在。

### 修改已有需求

第一步永远先问：**老 issue 的 Status 是 ready 还是 done？**

| 状态 | 怎么改 |
|---|---|
| `ready-for-agent` / `ready-for-human` | 直接编辑文件 / 加新文件 / 删文件——还没承诺过，没历史包袱 |
| `done` | **不可改**。流程：`/to-prd` 重跑（默认写 `PRD-v2.md`） → `/to-issues` 重跑给对账报告（哪些留 / 哪些 redo / 哪些删 / 哪些新增）→ `/tdd <new-redo-issue>` 跑新切片 |

**架构整体反转**（不只一个 feature 变了，是底层决策反转）：先 `/grill-with-docs` 写新 ADR 标 `Supersedes:` 旧 ADR，再走"老 issue 已完工"流程。

> **省 token tip**：tdd 跑 redo 类 issue（文件名 `*-redo-*` 或 `*-revert-*`）时会**自动找原 issue 的完工记录**，列出当时新增的测试文件让你决定改 / 删 / 留——避免留下僵尸测试。

### 发现 bug

`/diagnose` 走 6 阶段。如果是已完工 issue 的回归，在原 feature 目录新建 `NN-fix-X.md` 走 `/tdd` 流程；如果是基础架构 bug，独立处理不挂任何 PRD。

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

写 6 段骨架的交接文档到 `docs/handoffs/<日期>-<主题>.md`。**第 4 段"关键口径清单"是核心**——决策可以丢，决策的"为什么"不能丢。新 session 只读这一个文件就能续上。

**下一个 session 怎么续**：直接在新 session 第一句敲（不需要任何前置仪式）：

```
读 docs/handoffs/<file>.md，按"开机动作序列"继续
```

这是一句到位的指令。如果记不清是哪份 handoff，先在终端跑 `Get-ChildItem docs\handoffs | Sort LastWriteTime -Desc | Select -First 5` 用眼睛挑（不让 agent 帮你挑，省 token）。

> **频率建议**：长任务每天结束前留一份；快跑的小任务做完直接关；多 session 跨越的 epic 在每次切换前都留一份。
>
> **反例**：上一 session 工作已完整结束（issue 已 `Status: done`）→ **不要写 handoff**，也不要 handoff 续上。下个 session 直接 `/tdd <next-issue-path>` 进下一条。handoff 是给"半截工作"留的桥，不是切 session 的仪式。

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
| `/map-codebase` 建总索引 | 接手大项目时跑一次 | 自动产出 `CONTEXT-MAP.md` + 模块 stub（带代码路径）；agent 知道"去哪看"，不全仓扫 |
| 写好 `CONTEXT.md`（**带代码路径**） | 跑 `/grill-with-docs` 时附上文件路径 | 之后所有 skill 直接定位文件，省 80% 探索 |
| PRD 写明涉及模块 | `/to-prd` 时显式说"涉及 `src/services/balance/`" | `/to-issues`、`/tdd` 接力时直接读 PRD 里写好的，不再扫 |
| `/zoom-out` 临时看懂单模块 | `/zoom-out <path>` 即用即走（只读不落盘） | 快速理解一块陌生代码；要长期保留改用 `/map-codebase` + `/grill-with-docs` |

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
adb logcat -c; <trigger>; adb logcat -d | sls "Tag"     # 清→触发→抓日志
adb exec-out screencap -p > screenshot.png              # 截图（写进 ready-for-human 的 AC）
adb logcat -b crash -d                                  # 抓 crash / ANR
```

更多快反馈循环类型（HITL 脚本、UI 自动化、录制回放）见 [diagnose](engineering/diagnose/SKILL.md) 的 phase 1。

---

## skill 一览

### 主流程（按使用顺序）

| skill | 何时用 |
|---|---|
| [hys-setup](engineering/setup-hys-skills/SKILL.md) | 项目首次接入跑一次，配置 issue tracker / 状态 / 文档布局 |
| [grill-me](productivity/grill-me/SKILL.md) / [grill-with-docs](engineering/grill-with-docs/SKILL.md) | 拷问方案逼出决策（后者同步写 ADR / CONTEXT.md） |
| [map-codebase](engineering/map-codebase/SKILL.md) | 接手大项目时跑一次，自动产出 `CONTEXT-MAP.md` + 模块 stub（draft，再用 grill 细化） |
| [prototype](engineering/prototype/SKILL.md) | 写代码前造一次性原型验证方案（用在 `/to-prd` **之前**） |
| [to-prd](engineering/to-prd/SKILL.md) | 对话变 PRD（重跑默认 supersede） |
| [to-issues](engineering/to-issues/SKILL.md) | PRD 拆 issue（重跑给对账报告） |
| [tdd](engineering/tdd/SKILL.md) | 跑红绿循环（Status-aware 双模式） |
| [diagnose](engineering/diagnose/SKILL.md) | 6 阶段诊断硬 bug |
| [zoom-out](engineering/zoom-out/SKILL.md) | 不熟的代码请求"地图视角" |
| [improve-codebase-architecture](engineering/improve-codebase-architecture/SKILL.md) | 阶段性回顾找架构深化机会 |

### 元工作流

- [handoff](productivity/handoff/SKILL.md) — 交接文档，跨 session 续命（6 段骨架）
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
