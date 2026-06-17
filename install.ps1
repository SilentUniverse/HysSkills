<#
.SYNOPSIS
    Install skills from this repo into Claude Code skills folder using junctions.

.DESCRIPTION
    The script scans every <category>/<skill>/SKILL.md under repo root, reads
    frontmatter field `name`, and creates a directory junction in target folder:
    <target>/<name> -> <repo>/<category>/<skill>

    Behavior:
    - Existing link: recreate it.
    - Existing real directory: backup to _backup-<timestamp> unless -Force.
    - No admin needed (uses mklink /J).

.PARAMETER Target
    Target skills folder. Default: ~/.claude/skills

.PARAMETER DryRun
    Preview only.

.PARAMETER Force
    Remove existing real directory directly instead of backup.

.EXAMPLE
    powershell -NoProfile -ExecutionPolicy Bypass -File .\install.ps1 -DryRun
    powershell -NoProfile -ExecutionPolicy Bypass -File .\install.ps1
#>

[CmdletBinding()]
param(
    [string]$Target = (Join-Path $HOME ".claude/skills"),
    [switch]$DryRun,
    [switch]$Force
)

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot

function New-JunctionCompat {
    param(
        [string]$LinkPath,
        [string]$TargetPath
    )

    & cmd.exe /c "mklink /J `"$LinkPath`" `"$TargetPath`"" | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to create junction: $LinkPath -> $TargetPath"
    }
}

function Get-SkillName {
    param([string]$SkillMdPath)

    $lines = Get-Content -LiteralPath $SkillMdPath -Encoding utf8
    if ($lines.Count -lt 2 -or $lines[0].Trim() -ne "---") { return $null }

    for ($i = 1; $i -lt $lines.Count; $i++) {
        if ($lines[$i].Trim() -eq "---") { break }
        if ($lines[$i] -match "^\s*name:\s*(.+?)\s*$") {
            return $matches[1].Trim().Trim('"').Trim([char]39)
        }
    }
    return $null
}

function Get-DuplicatePreference {
    param(
        [string]$ExistingPath,
        [string]$CandidatePath
    )

    $existingIsHys = $ExistingPath -match "[\\/]setup-hys-skills$"
    $candidateIsHys = $CandidatePath -match "[\\/]setup-hys-skills$"
    $existingIsMatt = $ExistingPath -match "[\\/]setup-matt-pocock-skills$"
    $candidateIsMatt = $CandidatePath -match "[\\/]setup-matt-pocock-skills$"

    if ($candidateIsHys -and $existingIsMatt) { return "candidate" }
    if ($existingIsHys -and $candidateIsMatt) { return "existing" }
    return "conflict"
}

$skillMds = Get-ChildItem -LiteralPath $root -Recurse -Filter "SKILL.md" -File
if (-not $skillMds) {
    Write-Error "No SKILL.md found under $root. Put install.ps1 at repository root."
    exit 1
}

$seen = @{}
foreach ($md in $skillMds) {
    $name = Get-SkillName $md.FullName
    $dir = $md.Directory.FullName

    if (-not $name) {
        Write-Warning "Skip (frontmatter has no name): $($md.FullName)"
        continue
    }
    if ($seen.ContainsKey($name)) {
        $existing = $seen[$name]
        $preference = Get-DuplicatePreference -ExistingPath $existing -CandidatePath $dir

        if ($preference -eq "candidate") {
            Write-Warning "Duplicate name '$name': prefer $dir, skip $existing"
            $seen[$name] = $dir
            continue
        }
        if ($preference -eq "existing") {
            Write-Warning "Duplicate name '$name': keep $existing, skip $dir"
            continue
        }

        Write-Error "Duplicate name '$name' in $existing and $dir"
        exit 1
    }

    $seen[$name] = $dir
}

$skills = @(
    foreach ($k in ($seen.Keys | Sort-Object)) {
        [pscustomobject]@{ Name = $k; Source = $seen[$k] }
    }
)

Write-Host ("Found {0} skills, target: {1}" -f $skills.Count, $Target) -ForegroundColor Cyan
if ($DryRun) { Write-Host "[DryRun] Preview only." -ForegroundColor Yellow }

if (-not (Test-Path -LiteralPath $Target)) {
    if ($DryRun) { Write-Host "[DryRun] Create folder: $Target" }
    else { New-Item -ItemType Directory -Path $Target -Force | Out-Null }
}

$backupDir = Join-Path $Target ("_backup-" + (Get-Date -Format "yyyyMMdd-HHmmss"))

$linked = 0
$backedUp = 0

foreach ($s in $skills) {
    $linkPath = Join-Path $Target $s.Name

    if (Test-Path -LiteralPath $linkPath) {
        $item = Get-Item -LiteralPath $linkPath -Force
        $isLink = ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0

        if ($isLink) {
            if ($DryRun) { Write-Host ("[DryRun] Recreate link {0}" -f $s.Name) }
            else { [System.IO.Directory]::Delete($linkPath) }
        }
        elseif ($Force) {
            if ($DryRun) { Write-Host ("[DryRun] -Force remove real folder {0}" -f $linkPath) -ForegroundColor Red }
            else { Remove-Item -LiteralPath $linkPath -Recurse -Force }
        }
        else {
            if (-not $DryRun -and -not (Test-Path -LiteralPath $backupDir)) {
                New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
            }

            $dest = Join-Path $backupDir $s.Name
            if ($DryRun) { Write-Host ("[DryRun] Backup {0} -> {1}, then relink" -f $s.Name, $dest) -ForegroundColor Yellow }
            else {
                Move-Item -LiteralPath $linkPath -Destination $dest
                $backedUp++
            }
        }
    }

    if ($DryRun) {
        Write-Host ("[DryRun] Link {0,-26} -> {1}" -f $s.Name, $s.Source)
    }
    else {
        New-JunctionCompat -LinkPath $linkPath -TargetPath $s.Source
        Write-Host ("Linked {0,-26} -> {1}" -f $s.Name, $s.Source) -ForegroundColor Green
        $linked++
    }
}

Write-Host ""

# --- Distribute ARTIFACT-FORMAT.md to the skills root so engineering skills' `../ARTIFACT-FORMAT.md`
#     links resolve. On Windows `..` is normalized textually (it does not traverse the junction),
#     so `<skills>/ship/../ARTIFACT-FORMAT.md` -> `<skills>/ARTIFACT-FORMAT.md`. Put the file there. ---
$afSource = Join-Path $root "engineering/ARTIFACT-FORMAT.md"
if (Test-Path -LiteralPath $afSource) {
    $afTarget = Join-Path $Target "ARTIFACT-FORMAT.md"
    if ($DryRun) {
        Write-Host ("[DryRun] Copy ARTIFACT-FORMAT.md -> {0}" -f $afTarget) -ForegroundColor Yellow
    }
    else {
        Copy-Item -LiteralPath $afSource -Destination $afTarget -Force
        Write-Host ("Contract: copied ARTIFACT-FORMAT.md -> {0}" -f $afTarget) -ForegroundColor Green
    }
}

# --- Distribute workflow scripts to ~/.claude/workflows so `/workflow <name>` resolves globally ---
$wfSource = Join-Path $root ".claude/workflows"
if (Test-Path -LiteralPath $wfSource) {
    $wfTarget = Join-Path (Split-Path $Target -Parent) "workflows"
    # $Target is ~/.claude/skills by default, so its parent is ~/.claude -> ~/.claude/workflows
    $wfFiles = Get-ChildItem -LiteralPath $wfSource -Filter "*.js" -File
    if ($wfFiles) {
        if ($DryRun) {
            Write-Host ("[DryRun] Copy {0} workflow script(s) -> {1}" -f $wfFiles.Count, $wfTarget) -ForegroundColor Yellow
        }
        else {
            if (-not (Test-Path -LiteralPath $wfTarget)) { New-Item -ItemType Directory -Path $wfTarget -Force | Out-Null }
            foreach ($wf in $wfFiles) {
                Copy-Item -LiteralPath $wf.FullName -Destination (Join-Path $wfTarget $wf.Name) -Force
            }
            Write-Host ("Workflows: copied {0} script(s) -> {1}" -f $wfFiles.Count, $wfTarget) -ForegroundColor Green
            Write-Host "  (workflow scripts are copied, not linked; re-run install after editing them in the repo)" -ForegroundColor DarkGray
        }
    }
}

if ($DryRun) {
    Write-Host "Dry run done. Remove -DryRun to apply." -ForegroundColor Yellow
}
else {
    Write-Host ("Done: {0} links created." -f $linked) -ForegroundColor Cyan
    if ($backedUp -gt 0) {
        Write-Host ("Backed up {0} existing folders to: {1}" -f $backedUp, $backupDir) -ForegroundColor Yellow
    }
    Write-Host "Use /<name> in Claude Code. hys-setup is the project bootstrap entry."
}
