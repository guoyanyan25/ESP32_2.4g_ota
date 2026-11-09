# ============================================================
# PY32F003 固件一键发布脚本 (Windows PowerShell 版本)
# ============================================================
# 功能：
#   1. 自动计算固件 SHA-256 校验和
#   2. 复制固件到对应目录 (stable/ 或 beta/)
#   3. 自动更新 release_latest.json（只保留最新版）
#   4. 自动更新 release.json（历史版本列表，最新在前）
#
# 用法（在 PowerShell 中运行）:
#   .\publish_firmware.ps1 -Channel stable -Version "1.0.1" -FirmwareFile ".\py32f003_stable_1.0.1_115200.bin" -Description "1) 修复xxx; 2) 优化xxx"
#   .\publish_firmware.ps1 -Channel beta -Version "1.0.2" -FirmwareFile ".\py32f003_beta_1.0.2_115200.bin" -Description "1) 测试新功能"
#
# 参数说明:
#   -Channel       发布通道: stable 或 beta
#   -Version       版本号，如 "1.0.0"
#   -FirmwareFile  固件 .bin 文件路径
#   -SdkVersion    SDK 版本（可选，PY32F003 一般留空）
#   -Description   更新说明，格式: "1) 第一条; 2) 第二条"
#   -BaudRate      波特率，默认 115200
#   -GithubUser    GitHub 用户名（首次运行会提示，之后自动保存）
#   -GithubRepo    GitHub 仓库名（首次运行会提示，之后自动保存）
# ============================================================

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("stable","beta")]
    [string]$Channel,

    [Parameter(Mandatory=$true)]
    [string]$Version,

    [Parameter(Mandatory=$true)]
    [string]$FirmwareFile,

    [string]$SdkVersion = "",
    [string]$Description = "",
    [int]$BaudRate = 115200,
    [string]$GithubUser = "",
    [string]$GithubRepo = ""
)

$ErrorActionPreference = "Stop"

# 脚本所在目录
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$LatestFile = Join-Path $ScriptDir "release_latest.json"
$ReleaseFile = Join-Path $ScriptDir "release.json"
$ConfigFile = Join-Path $ScriptDir ".publish_config.json"

# ============================================================
# 1. 读取/保存 GitHub 配置
# ============================================================
if (Test-Path $ConfigFile) {
    $config = Get-Content $ConfigFile -Raw | ConvertFrom-Json
    if ([string]::IsNullOrEmpty($GithubUser)) { $GithubUser = $config.GithubUser }
    if ([string]::IsNullOrEmpty($GithubRepo)) { $GithubRepo = $config.GithubRepo }
}

if ([string]::IsNullOrEmpty($GithubUser) -or [string]::IsNullOrEmpty($GithubRepo)) {
    Write-Host "=== 首次运行配置 ===" -ForegroundColor Cyan
    if ([string]::IsNullOrEmpty($GithubUser)) {
        $GithubUser = Read-Host "请输入 GitHub 用户名"
    }
    if ([string]::IsNullOrEmpty($GithubRepo)) {
        $GithubRepo = Read-Host "请输入 GitHub 仓库名 (例如 py32f003-ota)"
    }
    # 保存配置
    @{ GithubUser = $GithubUser; GithubRepo = $GithubRepo } | ConvertTo-Json | Set-Content $ConfigFile
    Write-Host "配置已保存到 $ConfigFile" -ForegroundColor Green
}

# 基础 URL（GitHub Raw 地址）
$BaseUrl = "https://raw.githubusercontent.com/$GithubUser/$GithubRepo/main/firmwares/py32f003"

# ============================================================
# 2. 检查文件
# ============================================================
if (-not (Test-Path $FirmwareFile)) {
    Write-Host "错误: 固件文件不存在: $FirmwareFile" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $LatestFile)) {
    Write-Host "错误: $LatestFile 不存在，请先初始化仓库" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $ReleaseFile)) {
    Write-Host "错误: $ReleaseFile 不存在，请先初始化仓库" -ForegroundColor Red
    exit 1
}

# ============================================================
# 3. 计算 SHA-256
# ============================================================
$fileInfo = Get-Item $FirmwareFile
$fileSize = $fileInfo.Length
$hash = Get-FileHash -Path $FirmwareFile -Algorithm SHA256
$checksum = $hash.Hash.ToLower()

# 目标文件名
$fileName = "py32f003_${Channel}_${Version}_${BaudRate}.bin"
$targetDir = Join-Path $ScriptDir "firmwares\py32f003\$Channel"
$targetPath = Join-Path $targetDir $fileName

# 远程 URL
$remoteUrl = "$BaseUrl/$Channel/$fileName"

# ============================================================
# 4. 显示信息
# ============================================================
Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  PY32F003 固件发布" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  通道:       $Channel"
Write-Host "  版本:       $Version"
Write-Host "  SDK版本:    $SdkVersion"
Write-Host "  波特率:     $BaudRate"
Write-Host "  源文件:     $FirmwareFile"
Write-Host "  文件大小:   $fileSize bytes"
Write-Host "  SHA-256:    $checksum"
Write-Host "  目标文件:   firmwares/py32f003/$Channel/$fileName"
Write-Host "  远程 URL:   $remoteUrl"
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# ============================================================
# 5. 复制固件到目标目录
# ============================================================
if (-not (Test-Path $targetDir)) {
    New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
}
Copy-Item -Path $FirmwareFile -Destination $targetPath -Force
Write-Host "已复制固件到: $targetPath" -ForegroundColor Green

# ============================================================
# 6. 构建新条目
# ============================================================
if ([string]::IsNullOrEmpty($Description)) {
    $Description = "V$Version Release Notes: 1) 待补充更新说明"
} elseif (-not $Description.StartsWith("V")) {
    $Description = "V$Version Release Notes: $Description"
}

$entry = @{
    url         = $remoteUrl
    checksum    = $checksum
    version     = $Version
    sdkVersion  = $SdkVersion
    description = $Description
    baudRate    = $BaudRate
}

# ============================================================
# 7. 更新 release_latest.json
# ============================================================
$latestData = Get-Content $LatestFile -Raw | ConvertFrom-Json

# 确保 py32f003 节点存在
if (-not $latestData.PSObject.Properties.Name -contains "py32f003") {
    $latestData | Add-Member -MemberType NoteProperty -Name "py32f003" -Value @{}
}
if (-not $latestData.py32f003.PSObject.Properties.Name -contains $Channel) {
    $latestData.py32f003 | Add-Member -MemberType NoteProperty -Name $Channel -Value $null
}

# 更新对应通道
$latestData.py32f003.$Channel = $entry

$latestData | ConvertTo-Json -Depth 10 | Set-Content $LatestFile -Encoding UTF8
Write-Host "已更新 release_latest.json" -ForegroundColor Green

# ============================================================
# 8. 更新 release.json
# ============================================================
$releaseData = Get-Content $ReleaseFile -Raw | ConvertFrom-Json

# 确保结构存在
if (-not $releaseData.PSObject.Properties.Name -contains "py32f003") {
    $releaseData | Add-Member -MemberType NoteProperty -Name "py32f003" -Value @{}
}
if (-not $releaseData.py32f003.PSObject.Properties.Name -contains $Channel) {
    $releaseData.py32f003 | Add-Member -MemberType NoteProperty -Name $Channel -Value @()
}

# 获取现有数组
$existingList = @($releaseData.py32f003.$Channel)

# 去重：删除同版本号的旧条目
$newList = @()
foreach ($item in $existingList) {
    if ($item.version -ne $Version) {
        $newList += $item
    }
}

# 最新版本插到最前面
$newList = @($entry) + $newList

# 赋值回去（PowerShell 的 JSON 处理有点绕）
$releaseData.py32f003.$Channel = $newList

$releaseData | ConvertTo-Json -Depth 10 | Set-Content $ReleaseFile -Encoding UTF8
Write-Host "已更新 release.json（共 $($newList.Count) 个版本）" -ForegroundColor Green

# ============================================================
# 9. 完成提示
# ============================================================
Write-Host ""
Write-Host "==========================================" -ForegroundColor Green
Write-Host "  发布完成！" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""
Write-Host "接下来请执行以下命令推送到 GitHub："
Write-Host ""
Write-Host "  cd $ScriptDir"
Write-Host "  git add ."
Write-Host "  git commit -m ""发布 PY32F003 $Channel v$Version"""
Write-Host "  git push"
Write-Host ""
Write-Host "推送成功后，ESP32 端约 1~2 分钟后可检测到新版本（GitHub Raw CDN 缓存）。"
Write-Host ""
