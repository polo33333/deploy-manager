# Quick Download Script for Google Fonts

# Run this PowerShell script to download Google Fonts

$fontsDir = "e:\Dev\deploy-manager\dashboard\assets\css\fonts\fonts"

# Inter Font URLs (from Google Fonts)
$fonts = @{
    "Inter-Regular.woff2" = "https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiA.woff2"
    "Inter-Medium.woff2" = "https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuI6fAZ9hiA.woff2"
    "Inter-SemiBold.woff2" = "https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuGKYAZ9hiA.woff2"
    "Inter-Bold.woff2" = "https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuFuYAZ9hiA.woff2"
    "RobotoMono-Regular.woff2" = "https://fonts.gstatic.com/s/robotomono/v23/L0xuDF4xlVMF-BfR8bXMIhJHg45mwgGEFl0_3vq_ROW4.woff2"
    "RobotoMono-Medium.woff2" = "https://fonts.gstatic.com/s/robotomono/v23/L0xuDF4xlVMF-BfR8bXMIhJHg45mwgGEFl0_gPu_ROW4.woff2"
}

Write-Host "Downloading Google Fonts..." -ForegroundColor Green

foreach ($font in $fonts.GetEnumerator()) {
    $outFile = Join-Path $fontsDir $font.Key
    Write-Host "Downloading $($font.Key)..." -ForegroundColor Yellow
    try {
        Invoke-WebRequest -Uri $font.Value -OutFile $outFile
        Write-Host "Downloaded $($font.Key)" -ForegroundColor Green
    } catch {
        Write-Host "Failed to download $($font.Key)" -ForegroundColor Red
    }
}

Write-Host "All fonts downloaded!" -ForegroundColor Green

