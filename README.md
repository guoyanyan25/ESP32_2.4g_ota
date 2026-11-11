# ESP32_2.4g_ota

PY32F003 2.4G 遥控器固件 OTA 仓库。WLED-ESP32 通过这个仓库的 manifest 拉取版本信息，
并通过 UART0 + XMODEM-CRC 协议烧录到 PY32F003。

## 仓库结构

```
ESP32_2.4g_ota/
├── README.md                       # 本文件
├── release.json                    # 历史版本列表（所有版本）
├── release_latest.json             # 最新版本（stable 通道）
├── firmwares/
│   └── py32f003/
│       ├── stable/                 # 稳定版固件
│       │   ├── py32_2_4g_A_1.0.1.bin
│       │   ├── py32_2_4g_A_1.0.2.bin
│       │   ├── py32_2_4g_B_1.0.1.bin
│       │   └── py32_2_4g_B_1.0.2.bin
│       └── beta/                   # 测试版固件（预留）
└── tools/                          # 工具脚本（checksum、发布）
    ├── batch_checksum.ps1
    └── publish_firmware.ps1
```

## 固件命名规则

PY32F003 采用 A/B 双槽位设计（APP_A: 0x08002000, APP_B: 0x08008C00，各 27KB）。
ESP32 从文件名中提取槽位：匹配 `_A_` / `_B_`（或 `-A-`、`.A.`）。

```
py32_2_4g_{slot}_{version}.bin
                   ↑      ↑
                 A or B   版本号 如 1.0.2
```

**每次发版必须同时提供 A 槽和 B 槽两份固件**。ESP32 根据 PY32 当前运行槽位自动选择对端槽位。

## Manifest 格式

两个 JSON 均可被 ESP32 端 `py32_ota.cpp` 直接解析（三种格式都接受）：

| 字段 | 说明 |
|------|------|
| `version` | 版本号，如 `"1.0.2"` |
| `url` | raw.githubusercontent.com 的直链 |
| `slot` | `"A"` 或 `"B"`，仅用于页面展示（实际升级时 ESP32 从 URL 文件名提取） |
| `checksum` | SHA-256（小写），预留字段，当前 ESP32 端未校验 |
| `description` | 更新说明，显示在 WLED 页面 |

### release.json — 所有历史版本

```json
{
  "py32": {
    "stable": [ { "version": "...", "url": "...", "slot": "A", ... } ],
    "beta":   [ ... ]
  }
}
```

### release_latest.json — 最新 stable（版本迭代时 ESP32 页面优先拉这个）

结构同上，但通常只保留最新一个版本的 A/B 条目。

## ESP32 侧配置

在 `wled00/py32_ota.h` 中定义 manifest URL：

```cpp
#define PY32_MANIFEST_URL "https://raw.githubusercontent.com/guoyanyan25/ESP32_2.4g_ota/main/release_latest.json"
```

## 本地验证

推送到 GitHub 后，浏览器打开以下地址能看到 JSON 即为成功：

```
https://raw.githubusercontent.com/guoyanyan25/ESP32_2.4g_ota/main/release.json
https://raw.githubusercontent.com/guoyanyan25/ESP32_2.4g_ota/main/release_latest.json
```

## 计算 SHA-256（Windows PowerShell）

```powershell
Get-FileHash "firmwares\py32f003\stable\py32_2_4g_A_1.0.2.bin" -Algorithm SHA256
```

## 发布新版本流程

```powershell
# 1. 把新的 A/B 槽固件复制到 firmwares\py32f003\stable\
#    （文件名自动带 _A_ / _B_ 即可）

# 2. 用 tools\publish_firmware.ps1 自动算 checksum 并更新 JSON
#    或者手动改 release.json / release_latest.json

# 3. 提交推送
git add .
git commit -m "Release v1.0.3"
git push
```

## 协议参考

升级协议详见：`PY32F003_OTA升级协议设计.md`（上位机升级协议）

## 文件清单

| 文件 | 大小 | SHA-256 |
|------|------|---------|
| py32_2_4g_A_1.0.1.bin | 23,224 B | `76753690...c8fe9e` |
| py32_2_4g_A_1.0.2.bin | 23,224 B | `fbb81242...caca8` |
| py32_2_4g_B_1.0.1.bin | 23,224 B | `e524a296...7550f` |
| py32_2_4g_B_1.0.2.bin | 23,224 B | `e2014dfc...a0f8` |
