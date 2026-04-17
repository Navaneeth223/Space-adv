$jsFiles = @(
    "01_constantsAndState.js",
    "02_inputAudio.js",
    "03_particles.js",
    "04_rendererCamera.js",
    "05_collisionIdd.js",
    "06_entities.js",
    "07_zonesAndTiles.js",
    "08_enemiesAndBosses.js",
    "09_scenes.js",
    "10_engine.js"
)

$jsContent = ""
foreach ($file in $jsFiles) {
    if (Test-Path "src\$file") {
        $content = Get-Content "src\$file" -Raw
        $jsContent += $content + "`n"
    } else {
        Write-Host "Warning: File src\$file not found."
    }
}

if (Test-Path "src\index.template.html") {
    $html = Get-Content "src\index.template.html" -Raw
    $html = $html -replace '<!-- GAME_SCRIPT -->', "<script>`n$jsContent`n</script>"
    Set-Content -Path .\index.html -Value $html
    Write-Host "Build complete: index.html"
} else {
    Write-Host "Error: index.template.html not found."
}
