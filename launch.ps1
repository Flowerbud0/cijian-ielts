$ErrorActionPreference = 'Stop'
$localUrl = 'http://127.0.0.1:4173/'
try {
    $running = Invoke-WebRequest -Uri $localUrl -UseBasicParsing -TimeoutSec 2
    if ($running.Content -notmatch 'cijian|app.js') { throw 'Port 4173 is used by another application.' }
    Start-Process $localUrl
    exit
} catch {
    if ($_.Exception.Message -eq 'Port 4173 is used by another application.') { throw }
}
$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
$nodePath = if ($nodeCommand) { $nodeCommand.Source } else { Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe' }
if (-not (Test-Path -LiteralPath $nodePath)) { throw 'Please install Node.js 22 or newer, then try again.' }
Start-Process -FilePath $nodePath -ArgumentList 'scripts/serve.mjs' -WorkingDirectory $PSScriptRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $PSScriptRoot 'server.log') -RedirectStandardError (Join-Path $PSScriptRoot 'server-error.log')
for ($attempt=0; $attempt -lt 20; $attempt++) {
    Start-Sleep -Milliseconds 250
    try { $ready = Invoke-WebRequest -Uri $localUrl -UseBasicParsing -TimeoutSec 1; if ($ready.StatusCode -eq 200) { Start-Process $localUrl; exit } } catch {}
}
throw 'The local preview did not start. Check server-error.log.'
