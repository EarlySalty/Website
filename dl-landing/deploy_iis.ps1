param(
    [string]$SiteRoot = "C:\sites\dl-landing",
    [switch]$SkipBuild,
    [switch]$OpenBrowser
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$websiteTarget = $SiteRoot
$browserUrl = "https://earlysalty.de/"

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

# robots.txt and sitemap.xml are already in the dist root via Vite public folder

Write-Host "IIS deploy finished."
Write-Host "Source: $repoRoot\\dist"
Write-Host "Target: $websiteTarget"
Write-Host "URL:    $browserUrl"

if ($OpenBrowser) {
    Start-Process $browserUrl | Out-Null
}
