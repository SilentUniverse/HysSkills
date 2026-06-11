---
name: git-guardrails-claude-code
description: Set up Claude Code hooks to block dangerous git commands (push, reset --hard, clean, branch -D, etc.) before they execute. Use when user wants to prevent destructive git operations, add git safety hooks, or block git push/reset in Claude Code.
---

# Setup Git Guardrails

Sets up a PreToolUse hook that intercepts and blocks dangerous git commands before Claude executes them.

> Windows default: use the bundled `.ps1` script invoked via `pwsh`. Unix/WSL users use the `.sh` script.

## What Gets Blocked

- `git push` (all variants including `--force`)
- `git reset --hard`
- `git clean -f` / `git clean -fd`
- `git branch -D`
- `git checkout .` / `git restore .`

When blocked, Claude sees a message telling it that it does not have authority to access these commands.

## Steps

### 1. Ask scope

Ask the user: install for **this project only** (`.claude/settings.json`) or **all projects** (`~/.claude/settings.json`)?

### 2. Copy the hook script

Two versions are bundled:

- **Windows (default):** [scripts/block-dangerous-git.ps1](scripts/block-dangerous-git.ps1)
- **Unix / WSL:** [scripts/block-dangerous-git.sh](scripts/block-dangerous-git.sh)

Copy the one matching the user's shell to the target location based on scope:

- **Project**: `.claude/hooks/block-dangerous-git.ps1` (or `.sh`)
- **Global**: `~/.claude/hooks/block-dangerous-git.ps1` (or `.sh`)

On Unix, make the `.sh` executable with `chmod +x`. The `.ps1` needs no chmod; it is invoked through `pwsh`.

### 3. Add hook to settings

Add to the appropriate settings file. **Windows / PowerShell** invokes the script through `pwsh`:

**Project** (`.claude/settings.json`):

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "pwsh -NoProfile -File \"$CLAUDE_PROJECT_DIR/.claude/hooks/block-dangerous-git.ps1\""
          }
        ]
      }
    ]
  }
}
```

**Global** (`~/.claude/settings.json`):

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "pwsh -NoProfile -File \"$HOME/.claude/hooks/block-dangerous-git.ps1\""
          }
        ]
      }
    ]
  }
}
```

On Unix/WSL, point `command` at the `.sh` script instead (e.g. `"$CLAUDE_PROJECT_DIR"/.claude/hooks/block-dangerous-git.sh`).

If the settings file already exists, merge the hook into existing `hooks.PreToolUse` array — don't overwrite other settings.

### 4. Ask about customization

Ask if user wants to add or remove any patterns from the blocked list. Edit the copied script accordingly.

### 5. Verify

Run a quick test.

**Windows / PowerShell:**

```powershell
'{"tool_input":{"command":"git push origin main"}}' | pwsh -NoProfile -File <path-to-script.ps1>
$LASTEXITCODE   # expect 2
```

**Unix / WSL:**

```bash
echo '{"tool_input":{"command":"git push origin main"}}' | <path-to-script.sh>
```

Should exit with code 2 and print a BLOCKED message to stderr.
