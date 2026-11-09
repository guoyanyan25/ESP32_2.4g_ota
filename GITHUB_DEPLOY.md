# PY32F003 OTA - GitHub 部署指南

## 概述

本方案使用 GitHub 托管 PY32F003 固件文件和版本清单，ESP32 (WLED) 通过 HTTPS 请求 GitHub 上的 JSON 文件来查询最新版本和历史版本列表，然后下载固件通过串口烧录到 PY32F003。

## 一、创建 GitHub 仓库

### 步骤 1：新建仓库

1. 登录 GitHub: https://github.com
2. 点击右上角 "+" → "New repository"
3. 填写信息：
   - **Repository name**: `py32f003-ota`（或你喜欢的名字）
   - **Description**: PY32F003 OTA firmware repository
   - **Public**（推荐，公开仓库，ESP32 不需要认证）
   - 勾选 "Add a README file"
4. 点击 "Create repository"

### 步骤 2：克隆仓库到本地

```powershell
# 打开 PowerShell，进入你想放代码的目录
cd D:\my_projects

# 克隆仓库（换成你的用户名）
git clone https://github.com/你的用户名/py32f003-ota.git

cd py32f003-ota
```

## 二、上传文件到 GitHub

### 方法 A：使用发布脚本（推荐，全自动）

```powershell
# 1. 把整个 py32f003-ota 文件夹的内容复制到你 clone 的仓库目录
#    （就是本指南所在的这个文件夹的全部内容）

# 2. 首次运行发布脚本，会让你输入 GitHub 用户名和仓库名
.\publish_firmware.ps1 -Channel stable -Version "1.0.0" -FirmwareFile "C:\path\to\your\firmware.bin" -Description "1) 初始版本发布"

# 3. 推送到 GitHub
git add .
git commit -m "发布 PY32F003 stable v1.0.0"
git push
```

### 方法 B：手动上传（适合第一次）

1. 在 GitHub 仓库页面，点击 "Add file" → "Upload files"
2. 拖拽 `release.json` 和 `release_latest.json` 上去
3. 拖拽 `firmwares/` 文件夹上去（包括 README.txt）
4. 点击 "Commit changes"

### 方法 C：使用 Git 命令

```powershell
# 进入仓库目录
cd D:\my_projects\py32f003-ota

# 把文件复制到对应位置后
git add .
git commit -m "Initial commit"
git push
```

## 三、验证文件是否可访问

推送成功后，用浏览器打开以下地址，应该能看到 JSON 内容：

```
https://raw.githubusercontent.com/你的用户名/py32f003-ota/main/release_latest.json
https://raw.githubusercontent.com/你的用户名/py32f003-ota/main/release.json
```

固件文件地址示例：
```
https://raw.githubusercontent.com/你的用户名/py32f003-ota/main/firmwares/py32f003/stable/py32f003_stable_1.0.0_115200.bin
```

> **注意**：GitHub Raw 文件有 CDN 缓存，推送新内容后可能需要 1~5 分钟才能看到最新版本。

## 四、CORS 问题与解决方案

### 问题

如果 WLED 网页（局域网 IP，如 http://192.168.1.100）直接用 fetch 请求 GitHub Raw 地址，会因为浏览器的 **CORS (跨域资源共享)** 策略被拦截。

GitHub Raw 的响应头不包含 `Access-Control-Allow-Origin: *`，所以浏览器会阻止请求。

### 解决方案（推荐：ESP32 代理）

让 ESP32 充当代理服务器：
- 浏览器 → ESP32 (局域网) → GitHub (互联网)
- ESP32 端新增几个 HTTP 接口，转发请求到 GitHub

**优点**：
- 无 CORS 问题
- 固件下载由 ESP32 完成，不占用浏览器资源
- 可以实时显示烧录进度

**ESP32 需要实现的接口**：

| 接口 | 方法 | 功能 |
|------|------|------|
| `/py32f003/api/release_latest.json` | GET | 转发 GitHub 的 release_latest.json |
| `/py32f003/api/release.json` | GET | 转发 GitHub 的 release.json |
| `/py32f003/version` | GET | 返回当前 PY32F003 的固件版本 |
| `/py32f003/ota/start` | POST | 开始 OTA：下载固件 + 串口烧录 |
| `/py32f003/ota/status` | GET | 查询 OTA 进度 |

### 备选方案：使用 jsDelivr CDN

如果不想改 ESP32 代码，可以用 jsDelivr 作为 CDN，它默认支持 CORS：

```
https://cdn.jsdelivr.net/gh/你的用户名/py32f003-ota@main/release_latest.json
https://cdn.jsdelivr.net/gh/你的用户名/py32f003-ota@main/release.json
```

固件文件：
```
https://cdn.jsdelivr.net/gh/你的用户名/py32f003-ota@main/firmwares/py32f003/stable/py32f003_stable_1.0.0_115200.bin
```

> **缺点**：jsDelivr 同步 GitHub 有延迟（几分钟到几小时），而且固件下载经过浏览器再发给 ESP32，多了一次中转。

## 五、发布新版本流程

### 标准发布步骤

```powershell
# 1. 准备好新的固件 .bin 文件
# 2. 进入仓库目录
cd D:\my_projects\py32f003-ota

# 3. 运行发布脚本（自动算校验和、更新 JSON）
.\publish_firmware.ps1 -Channel stable -Version "1.0.1" -FirmwareFile ".\build\py32f003_app.bin" -Description "1) 修复串口通信BUG; 2) 优化OTA写入速度"

# 4. 提交并推送
git add .
git commit -m "发布 PY32F003 stable v1.0.1"
git push
```

### 发布 Beta 测试版

```powershell
.\publish_firmware.ps1 -Channel beta -Version "1.1.0-beta" -FirmwareFile ".\build\py32f003_beta.bin" -Description "1) 测试新功能A; 2) 测试新功能B"
```

### 修改 GitHub 用户名/仓库名

删除 `.publish_config.json` 文件，下次运行脚本会重新提示输入。

## 六、目录结构

```
py32f003-ota/
├── release_latest.json          # 最新版本信息（对象格式）
├── release.json                 # 全部历史版本（数组格式）
├── publish_firmware.ps1         # Windows 发布脚本
├── frontend_reference.js        # 前端 JS 参考代码
├── GITHUB_DEPLOY.md             # 本文档
├── .gitignore
├── .publish_config.json         # 脚本自动生成的配置（git 忽略）
└── firmwares/
    └── py32f003/
        ├── README.txt
        ├── stable/              # 稳定版固件
        │   ├── py32f003_stable_1.0.0_115200.bin
        │   └── py32f003_stable_1.0.1_115200.bin
        └── beta/                # 测试版固件
            └── py32f003_beta_1.1.0-beta_115200.bin
```

## 七、JSON 字段说明

### release_latest.json（单对象，只存最新版）

```json
{
  "py32f003": {
    "stable": {
      "url": "固件下载地址",
      "checksum": "SHA-256 校验和（64位小写十六进制）",
      "version": "版本号，如 1.0.0",
      "sdkVersion": "SDK 版本（可选，PY32F003 可留空）",
      "description": "更新说明，格式见下文",
      "baudRate": 115200
    },
    "beta": null   // null 表示暂无 beta 版
  }
}
```

### release.json（数组，所有历史版本）

结构同上，但每个通道是数组，最新版本在最前面。

### description 格式规范

```
V{版本号} Release Notes: 1) 第一条更新说明; 2) 第二条更新说明; 3) 第三条
```

示例：
```
V1.0.1 Release Notes: 1) 修复串口通信BUG; 2) 优化OTA写入速度; 3) 增加看门狗保护
```

## 八、安全建议

1. **公开仓库 vs 私有仓库**：推荐公开仓库，ESP32 不需要额外认证；如果用私有仓库，需要在 ESP32 上配置 GitHub Personal Access Token
2. **校验和验证**：ESP32 下载固件后必须验证 SHA-256，防止下载过程中出错
3. **版本号规范**：使用语义化版本号 (SemVer)，如 1.0.0, 1.0.1, 1.1.0
4. **备份固件**：重要版本的固件文件建议另外备份
