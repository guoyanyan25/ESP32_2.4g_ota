=====================================================
PY32F003 固件目录
=====================================================

命名规则: py32f003_{通道}_{版本号}_{波特率}.bin

通道:
  - stable  稳定版
  - beta    测试版

示例文件:
  - py32f003_stable_1.0.0_115200.bin
  - py32f003_beta_1.0.1_115200.bin

发布步骤:
  1. 编译生成 .bin 文件
  2. 使用 publish_firmware.ps1 脚本（Windows）自动计算 SHA-256 并更新 JSON
  3. 手动发布: 用 PowerShell 计算: Get-FileHash xxx.bin -Algorithm SHA256
  4. 将 .bin 文件放到 stable/ 或 beta/ 子目录
  5. 更新根目录 release_latest.json 和 release.json
  6. git push 到 GitHub

GitHub 原始文件 URL 格式:
  https://raw.githubusercontent.com/{用户名}/{仓库名}/main/firmwares/py32f003/stable/py32f003_stable_1.0.0_115200.bin

=====================================================
