param(
    [string]$SiteRoot = "C:\sites\dl-landing",
    [switch]$SkipBuild,
    [switch]$OpenBrowser
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$websiteTarget = Join-Path $SiteRoot "website"
$browserUrl = "http://127.0.0.1:4888/website/"

if (-not $SkipBuild) {
    Push-Location $repoRoot
    try {
        npm run build
    } finally {
        Pop-Location
    }
}

if (-not (Test-Path $websiteTarget)) {
    New-Item -ItemType Directory -Path $websiteTarget -Force | Out-Null
}

robocopy (Join-Path $repoRoot "dist") $websiteTarget /MIR /NFL /NDL /NJH /NJS /NP /R:1 /W:1 | Out-Null
if ($LASTEXITCODE -gt 7) {
    throw "robocopy failed with exit code $LASTEXITCODE"
}

Copy-Item -Path (Join-Path $repoRoot "dist\\robots.txt") -Destination (Join-Path $SiteRoot "robots.txt") -Force
Copy-Item -Path (Join-Path $repoRoot "dist\\sitemap.xml") -Destination (Join-Path $SiteRoot "sitemap.xml") -Force

Write-Host "IIS deploy finished."
Write-Host "Source: $repoRoot\\dist"
Write-Host "Target: $websiteTarget"
Write-Host "URL:    $browserUrl"

if ($OpenBrowser) {
    Start-Process $browserUrl | Out-Null
}
