Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Resolve-GitBash {
  $candidates = New-Object System.Collections.Generic.List[string]

  if (-not [string]::IsNullOrWhiteSpace($env:OPENCLAW_GIT_BASH)) {
    $candidates.Add($env:OPENCLAW_GIT_BASH)
  }

  $gitCommand = Get-Command git -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($null -ne $gitCommand -and -not [string]::IsNullOrWhiteSpace($gitCommand.Source)) {
    $gitBinDir = Split-Path -Parent $gitCommand.Source
    $candidates.Add((Join-Path $gitBinDir "bash.exe"))
  }

  $bashCommands = @(Get-Command bash -CommandType Application -ErrorAction SilentlyContinue)
  foreach ($bashCommand in $bashCommands) {
    if ($null -ne $bashCommand -and -not [string]::IsNullOrWhiteSpace($bashCommand.Source)) {
      $candidates.Add($bashCommand.Source)
    }
  }

  $blockedCandidates = @(
    [System.IO.Path]::Combine($env:WINDIR, "System32", "bash.exe"),
    [System.IO.Path]::Combine($env:LOCALAPPDATA, "Microsoft", "WindowsApps", "bash.exe")
  ) | ForEach-Object { $_.ToLowerInvariant() }

  $seen = @{}
  foreach ($candidate in $candidates) {
    if ([string]::IsNullOrWhiteSpace($candidate) -or -not (Test-Path -LiteralPath $candidate -PathType Leaf)) {
      continue
    }

    $resolvedPath = (Get-Item -LiteralPath $candidate).FullName
    $normalizedPath = $resolvedPath.ToLowerInvariant()
    if ($seen.ContainsKey($normalizedPath)) {
      continue
    }
    $seen[$normalizedPath] = $true

    if ($blockedCandidates -contains $normalizedPath) {
      continue
    }

    return $resolvedPath
  }

  throw "Could not locate Git Bash. Install Git for Windows or set OPENCLAW_GIT_BASH to bash.exe."
}

$scriptDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
$bashScriptPath = Join-Path $scriptDirectory "committer"
if (-not (Test-Path -LiteralPath $bashScriptPath -PathType Leaf)) {
  throw "Missing bash helper: $bashScriptPath"
}

$bashPath = Resolve-GitBash
& $bashPath $bashScriptPath @args
$exitCode = $LASTEXITCODE

if ($exitCode -ne 0) {
  throw "scripts/committer failed with exit code $exitCode."
}
