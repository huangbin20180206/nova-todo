param(
  [int]$Port = 4173
)

$root = "C:\Users\huang\Documents\Codex\2026-07-18\he\outputs\todo-app"
Set-Location $root

Write-Host "Nova Todo local share server"
Write-Host "Root: $root"
Write-Host "Local: http://localhost:$Port"
Write-Host ""
Write-Host "Open another terminal and run ONE of these for a temporary public URL:"
Write-Host "  npx --yes localtunnel --port $Port"
Write-Host "  cloudflared tunnel --url http://localhost:$Port"
Write-Host ""
Write-Host "Press Ctrl+C to stop the local server."
Write-Host ""

if (Get-Command py -ErrorAction SilentlyContinue) {
  py -m http.server $Port
} elseif (Get-Command python -ErrorAction SilentlyContinue) {
  python -m http.server $Port
} else {
  npx --yes serve -l $Port .
}
