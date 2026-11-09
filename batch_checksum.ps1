# 批量计算 firmwares/py32f003 下所有 .bin 文件的 SHA-256
# 用法: .\batch_checksum.ps1

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$FwDir = Join-Path $ScriptDir "firmwares\py32f003"

if (-not (Test-Path $FwDir)) {
    Write-Host "错误: 固件目录不存在: $FwDir" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  PY32F003 固件 SHA-256 校验和" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

$files = Get-ChildItem -Path $FwDir -Filter "*.bin" -Recurse | Sort-Object FullName

if ($files.Count -eq 0) {
    Write-Host "未找到 .bin 文件" -ForegroundColor Yellow
    exit 0
}

foreach ($file in $files) {
    $hash = Get-FileHash -Path $file.FullName -Algorithm SHA256
    $relPath = $file.FullName.Substring($ScriptDir.Length + 1)
    Write-Host "  $relPath" -ForegroundColor White
    Write-Host "    $($hash.Hash.ToLower())" -ForegroundColor Gray
}

Write-Host ""
Write-Host "共 $($files.Count) 个文件" -ForegroundColor Green
Write-Host ""
