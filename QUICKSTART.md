# PY32F003 OTA 快速上手指南

## 整体架构

```
┌─────────────┐    局域网HTTP     ┌─────────────┐    HTTPS    ┌──────────┐
│  用户浏览器  │ ───────────────▶ │  ESP32 WLED │ ──────────▶ │  GitHub  │
│ (手机/电脑)  │ ◀─────────────── │   (服务器)   │ ◀────────── │  (OTA源) │
└─────────────┘    返回页面/数据   └─────────────┘   固件数据   └──────────┘
                                        │
                                        │ 串口(UART)
                                        ▼
                                 ┌─────────────┐
                                 │  PY32F003   │
                                 │  (待升级芯片)│
                                 └─────────────┘
```

**工作流程**：
1. ESP32 连接家里的 WiFi 路由器
2. 用户手机/电脑连同一个 WiFi，访问 ESP32 的 IP 地址
3. 进入 PY32F003 OTA 页面，ESP32 后台去 GitHub 拉取版本信息
4. 页面显示最新版本、更新说明、历史版本列表
5. 用户点击"烧录"，ESP32 从 GitHub 下载固件
6. ESP32 通过串口把固件烧录到 PY32F003

---

## 第一步：创建 GitHub 仓库

1. 打开 https://github.com 登录你的账号
2. 右上角 **+** → **New repository**
3. 仓库名填：`py32f003-ota`（可以自定义）
4. 选择 **Public**（公开，ESP32 不需要 token）
5. 勾选 **Add a README file**
6. 点击 **Create repository**

---

## 第二步：上传 OTA 文件到 GitHub

### 2.1 准备文件

把本文件夹（`py32f003-ota`）里的所有文件复制到你的本地仓库目录。

### 2.2 修改配置

打开 `release_latest.json` 和 `release.json`，把里面的：
- `你的GitHub用户名` → 改成你真实的 GitHub 用户名
- `py32f003-ota` → 如果你仓库名不同，改成你的仓库名

示例：
```
https://raw.githubusercontent.com/zhangsan/py32f003-ota/main/firmwares/...
```

### 2.3 准备第一个固件

把你编译好的 PY32F003 固件 `.bin` 文件放到：
```
firmwares/py32f003/stable/py32f003_stable_1.0.0_115200.bin
```

### 2.4 计算 SHA-256 校验和

打开 PowerShell，运行：
```powershell
Get-FileHash "firmwares\py32f003\stable\py32f003_stable_1.0.0_115200.bin" -Algorithm SHA256
```

把输出的 Hash 值（64个字符）填到两个 JSON 文件的 `checksum` 字段里。

### 2.5 推送到 GitHub

```powershell
cd 你的仓库目录
git add .
git commit -m "Initial release v1.0.0"
git push
```

### 2.6 验证

浏览器打开：
```
https://raw.githubusercontent.com/你的用户名/py32f003-ota/main/release_latest.json
```

如果能看到 JSON 内容，说明成功了！

---

## 第三步：WLED 后端（ESP32 端）需要实现的功能

你已经对 WLED 做了二次开发，新增了 PY32F003 OTA 页面。下面是 ESP32 端需要实现的 HTTP 接口：

### 3.1 查询当前 PY32F003 版本

```
GET /py32f003/version
```

返回：
```json
{
  "version": "1.0.0",
  "chipId": "xxxxxx"
}
```

**实现思路**：ESP32 通过串口发指令给 PY32F003 读取版本号。

### 3.2 获取最新版本信息（代理 GitHub）

```
GET /py32f003/api/release_latest.json
```

**实现思路**：ESP32 用 HTTPClient 去请求 GitHub 的 release_latest.json，然后把内容原样返回给浏览器。这样可以绕过浏览器的 CORS 限制。

示例代码（Arduino 框架）：
```cpp
#include <HTTPClient.h>

String GITHUB_RAW = "https://raw.githubusercontent.com/你的用户名/py32f003-ota/main";

void handlePy32f003Latest() {
  HTTPClient http;
  String url = GITHUB_RAW + "/release_latest.json?t=" + String(millis());
  http.begin(url);

  // 跳过证书验证（简单方案，生产环境建议配置证书）
  http.setInsecure();

  int httpCode = http.GET();
  if (httpCode == HTTP_CODE_OK) {
    String payload = http.getString();
    server.send(200, "application/json", payload);
  } else {
    server.send(500, "application/json", "{\"error\":\"获取失败\"}");
  }
  http.end();
}
```

### 3.3 获取历史版本列表

```
GET /py32f003/api/release.json
```

同上，代理 GitHub 的 release.json。

### 3.4 开始 OTA 升级

```
POST /py32f003/ota/start
Content-Type: application/json

{
  "url": "https://raw.githubusercontent.com/.../firmware.bin",
  "checksum": "abc123...",
  "baudRate": 115200
}
```

返回：
```json
{
  "success": true,
  "taskId": "ota_001"
}
```

**实现思路**：
1. ESP32 收到请求后，启动一个后台任务
2. 任务用 HTTPClient 从 GitHub 下载固件（流式下载，边下边写串口）
3. 或者先下载到 SPIFFS/LittleFS，校验 SHA-256 通过后再烧录
4. 通过串口发送固件给 PY32F003（按你的 bootloader 协议来）

### 3.5 查询 OTA 进度

```
GET /py32f003/ota/status?taskId=ota_001
```

返回：
```json
{
  "state": "downloading",   // downloading / flashing / completed / error
  "stage": "下载固件中",
  "progress": 45,           // 百分比 0-100
  "error": null
}
```

**实现思路**：OTA 任务在全局变量里更新进度，HTTP 接口读取并返回。

---

## 第四步：WLED 前端页面

参考 `frontend_reference.js`，在 WLED 的 PY32F003 OTA 页面中添加以下功能：

### 页面元素建议

```html
<!-- 当前版本 -->
<div class="info-card">
  <h3>当前版本</h3>
  <p id="py32f003-current-version">读取中...</p>
</div>

<!-- 最新版本 -->
<div class="info-card">
  <h3>最新稳定版 <span id="py32f003-update-badge" style="display:none" class="badge">有更新</span></h3>
  <p>版本号: <strong id="py32f003-latest-version">--</strong></p>
  <div id="py32f003-release-notes"></div>
  <button id="py32f003-update-btn" class="btn btn-primary" disabled onclick="flashLatest()">升级到最新版</button>
</div>

<!-- 进度条 -->
<div id="py32f003-progress-container" style="display:none">
  <div class="progress-bar">
    <div id="py32f003-progress-bar" style="width: 0%"></div>
  </div>
  <p id="py32f003-progress-text">准备中...</p>
</div>

<!-- 通道切换 -->
<div class="tabs">
  <button class="tab active" onclick="switchChannel('stable')">稳定版</button>
  <button class="tab" onclick="switchChannel('beta')">测试版</button>
</div>

<!-- 历史版本列表 -->
<div id="py32f003-firmware-list" class="firmware-list">
  <p>加载中...</p>
</div>
```

### 核心 JS 函数

直接使用 `frontend_reference.js` 里的函数即可，主要包括：

| 函数 | 功能 |
|------|------|
| `initPy32f003Page()` | 页面初始化，加载所有数据 |
| `getLatestFirmware(channel)` | 获取指定通道的最新版本 |
| `getFirmwareList(channel)` | 获取指定通道的历史版本列表 |
| `flashFirmware(version)` | 烧录指定版本 |
| `switchChannel(channel)` | 切换 stable/beta 通道 |
| `compareVersions(v1, v2)` | 比较版本号大小 |
| `renderReleaseNotes(desc)` | 把 description 解析成 HTML 列表 |

---

## 第五步：发布新版本

以后每次发布新固件，只需要：

```powershell
# 1. 进入仓库目录
cd D:\my_projects\py32f003-ota

# 2. 运行发布脚本（自动算 SHA-256，自动更新 JSON）
.\publish_firmware.ps1 -Channel stable -Version "1.0.2" -FirmwareFile ".\build\py32f003_v102.bin" -Description "1) 修复xxx; 2) 优化xxx"

# 3. 推送
git add .
git commit -m "发布 v1.0.2"
git push
```

等 1~5 分钟（GitHub CDN 缓存），ESP32 端就能检测到新版本了。

---

## 常见问题

### Q1: 浏览器访问 ESP32 页面，版本信息加载不出来？

**排查步骤**：
1. 确认 ESP32 能连上网（在 WLED 设置里检查 WiFi 状态）
2. 确认 GitHub 仓库是 Public 的
3. 用浏览器直接访问 `https://raw.githubusercontent.com/你的用户名/py32f003-ota/main/release_latest.json` 看能不能打开
4. 看 ESP32 的串口日志，有没有 HTTPS 请求错误

### Q2: 固件下载很慢？

- GitHub Raw 在国内访问速度可能不稳定，可以考虑用 jsDelivr CDN 加速
- 或者把固件托管到国内的 Gitee（码云）上

### Q3: SHA-256 校验失败怎么办？

1. 确认 JSON 里的 checksum 是小写的
2. 重新计算校验和：`Get-FileHash 文件名 -Algorithm SHA256`
3. 可能是下载过程中数据损坏，重试一次

### Q4: 能不能用私有仓库？

可以，但需要在 ESP32 上配置 GitHub Personal Access Token。
HTTPClient 请求时加上请求头：`Authorization: token 你的token`

### Q5: ESP32 的 Flash 不够大，存不下固件怎么办？

可以用**流式烧录**：边从 GitHub 下载，边通过串口发给 PY32F003，不需要存到本地 Flash。
需要你的 PY32F003 bootloader 支持流式写入。

---

## 文件清单

| 文件 | 用途 |
|------|------|
| `release_latest.json` | 最新版本信息（ESP32 页面加载时必拉） |
| `release.json` | 所有历史版本列表（"查看更多版本"用） |
| `publish_firmware.ps1` | Windows 一键发布脚本（推荐使用） |
| `frontend_reference.js` | 前端 JS 参考代码（集成到 WLED 网页用） |
| `GITHUB_DEPLOY.md` | GitHub 部署详细指南 |
| `firmwares/py32f003/stable/` | 稳定版固件存放目录 |
| `firmwares/py32f003/beta/` | 测试版固件存放目录 |
| `firmwares/py32f003/README.txt` | 命名规范说明 |
