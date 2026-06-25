# Token Budget Reference

Concrete cost levers for Claude Code. Complements the prompt-caching *structure* advice (keep the
prefix stable, read files instead of pasting, one codebase scan reused) — this file is the runtime
**numbers**. All defaults are sensible; reach for these when a session runs long or a workflow fans
out many subagents.

## Model routing

| Tier | Use for |
|---|---|
| `haiku` | mechanical, well-specified work — INDEX/SUMMARY regen, format/lint fixes, file moves |
| `sonnet` | the ~80% middle — most implementation, integration, ordinary review |
| `opus` | architecture, hard debugging, final whole-branch review, anything irreversible |

- In `/ship-wf` and other workflows, set per-agent `model` / `effort` explicitly — an unset agent
  inherits the session's (often most expensive) model. The bundled `ship-wf` already routes the
  pure-mechanical "refresh INDEX" stage to `effort: 'low'`; keep judgment stages (tidy, merge-back,
  the §3b review) at default.
- **Turn count beats unit price.** A cheap model that needs 2–3× the turns on a task it keeps
  failing is more expensive than the right model once. Route by task difficulty, not by reflex.

## Session env vars

Set in the shell before launching Claude Code. Windows / PowerShell syntax:

```powershell
$env:MAX_THINKING_TOKENS = "10000"            # default 31999; caps extended-thinking spend (~70% less on thinking-heavy turns)
$env:CLAUDE_AUTOCOMPACT_PCT_OVERRIDE = "50"   # compact earlier; long sessions stay sharper than letting context fill
$env:CLAUDE_CODE_SUBAGENT_MODEL = "haiku"     # default model for spawned subagents (override per-agent when judgment is needed)
```

bash/zsh: `export MAX_THINKING_TOKENS=10000` etc.

These are session-wide knobs; the per-agent `model`/`effort` options inside a workflow override the
subagent default for that one call.

## MCP servers

Each connected MCP server's tool list sits in the context prefix. Keeping more than ~10 enabled can
inflate a 200k window toward 70k of pure tool definitions before any work starts. Enable only the
servers a session actually needs.
