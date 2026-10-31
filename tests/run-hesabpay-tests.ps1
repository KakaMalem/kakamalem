param(
  [ValidateRange(1024, 65535)]
  [int]$Port = 55439,
  [string]$PostgresBin = "",
  [string]$TestFile = "hesabpay-webhook.test.ts"
)

# Starts a disposable PostgreSQL cluster. Never reads .env or connects to an
# existing database. The test runner must also require this explicit test URL.
$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$testPath = Join-Path $PSScriptRoot $TestFile
if (-not (Test-Path -LiteralPath $testPath -PathType Leaf)) {
  throw "Test file not found: $testPath"
}

if (-not $PostgresBin) {
  $PostgresBin = $env:POSTGRES_BIN
}
if (-not $PostgresBin) {
  $installation = Get-ChildItem -LiteralPath "$env:ProgramFiles/PostgreSQL" -Directory |
    Where-Object { $_.Name -match '^\d+(\.\d+)*$' } |
    Sort-Object { [version]"$($_.Name).0" } -Descending |
    Where-Object { Test-Path -LiteralPath (Join-Path $_.FullName "bin/initdb.exe") } |
    Select-Object -First 1
  if ($installation) {
    $PostgresBin = Join-Path $installation.FullName "bin"
  }
}
if (-not $PostgresBin) {
  throw "PostgreSQL binaries not found. Pass -PostgresBin or set POSTGRES_BIN."
}
$initdb = Join-Path $PostgresBin "initdb.exe"
$pgctl = Join-Path $PostgresBin "pg_ctl.exe"
$psql = Join-Path $PostgresBin "psql.exe"
foreach ($binary in @($initdb, $pgctl, $psql)) {
  if (-not (Test-Path -LiteralPath $binary -PathType Leaf)) {
    throw "PostgreSQL binary not found: $binary"
  }
}

# Probe by binding, without connecting to any service already using this port.
$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $Port)
try { $listener.Start() } finally { $listener.Stop() }

$tempRoot = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath())
$clusterPath = Join-Path $tempRoot ("kakamalem-hesabpay-test-" + [guid]::NewGuid().ToString("N"))
$clusterPath = [System.IO.Path]::GetFullPath($clusterPath)
$logPath = Join-Path $clusterPath "postgres.log"
$priorTestUrl = $env:HESABPAY_TEST_DATABASE_URL
$started = $false
$testExitCode = 1
New-Item -ItemType Directory -Path $clusterPath | Out-Null

Push-Location $repoRoot
try {
  & $initdb -D $clusterPath --username=hesabpay_test --auth=trust --encoding=UTF8 --locale=C --no-instructions
  if ($LASTEXITCODE -ne 0) { throw "Could not initialize disposable PostgreSQL cluster." }

  # Listen only on loopback; trust authentication is confined to this local test.
  & $pgctl -D $clusterPath -l $logPath -w -t 30 -o "-h 127.0.0.1 -p $Port" start
  if ($LASTEXITCODE -ne 0) { throw "Could not start disposable PostgreSQL cluster. See $logPath" }
  $started = $true

  & $psql -h 127.0.0.1 -p $Port -U hesabpay_test -d postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE kakamalem_hesabpay_test;"
  if ($LASTEXITCODE -ne 0) { throw "Could not create disposable test database." }

  $env:HESABPAY_TEST_DATABASE_URL = "postgresql://hesabpay_test@127.0.0.1:$Port/kakamalem_hesabpay_test"
  & pnpm exec tsx --test $testPath
  $testExitCode = $LASTEXITCODE
}
finally {
  $env:HESABPAY_TEST_DATABASE_URL = $priorTestUrl
  if ($started) {
    & $pgctl -D $clusterPath -m fast -w -t 30 stop
    if ($LASTEXITCODE -ne 0) {
      throw "Could not stop disposable PostgreSQL cluster; retained at $clusterPath"
    }
  }
  Pop-Location

  # Verify the absolute target before recursive removal. It is always the unique
  # directory this invocation created under the system temporary directory.
  $safePrefix = $tempRoot.TrimEnd([char]'\', [char]'/') + [System.IO.Path]::DirectorySeparatorChar
  if (-not $clusterPath.StartsWith($safePrefix, [System.StringComparison]::OrdinalIgnoreCase) -or
      (Split-Path -Leaf $clusterPath) -notmatch '^kakamalem-hesabpay-test-[0-9a-f]{32}$') {
    throw "Refusing to remove unexpected test cluster path: $clusterPath"
  }
  Remove-Item -LiteralPath $clusterPath -Recurse -Force
}

exit $testExitCode
