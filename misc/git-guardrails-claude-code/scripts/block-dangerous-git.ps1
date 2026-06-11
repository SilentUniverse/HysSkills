# Claude Code PreToolUse hook — blocks dangerous git commands on Windows (PowerShell).
# Reads the tool-call JSON from stdin, inspects tool_input.command, and exits 2
# (with a message on stderr) if the command matches a dangerous pattern.

$ErrorActionPreference = 'Stop'

$raw = [Console]::In.ReadToEnd()
try {
    $payload = $raw | ConvertFrom-Json
    $command = [string]$payload.tool_input.command
} catch {
    # Malformed / empty input — don't block.
    exit 0
}

if ([string]::IsNullOrWhiteSpace($command)) {
    exit 0
}

$dangerousPatterns = @(
    'git push',
    'git reset --hard',
    'git clean -fd',
    'git clean -f',
    'git branch -D',
    'git checkout \.',
    'git restore \.',
    'push --force',
    'reset --hard'
)

foreach ($pattern in $dangerousPatterns) {
    if ($command -match $pattern) {
        [Console]::Error.WriteLine("BLOCKED: '$command' matches dangerous pattern '$pattern'. The user has prevented you from doing this.")
        exit 2
    }
}

exit 0
