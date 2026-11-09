/**
 * ============================================================
 * PY32F003 OTA - 前端调用参考 (WLED 网页集成)
 * ============================================================
 *
 * 这个文件是给 WLED 二次开发的前端参考代码。
 * 功能：
 *   1. 从 GitHub Raw 拉取最新版本信息 (release_latest.json)
 *   2. 拉取全部历史版本列表 (release.json)
 *   3. 下载固件并通过 WebSocket/HTTP 发送给 ESP32
 *   4. ESP32 通过串口烧录到 PY32F003
 *
 * 重要：由于浏览器的 CORS 限制，直接从 WLED 网页 (局域网IP)
 * 请求 GitHub Raw 可能会被跨域拦截。
 *
 * 解决方案（任选其一）：
 *   A. ESP32 做代理：网页请求 ESP32，ESP32 转发请求到 GitHub
 *   B. 使用 GitHub Pages 托管 JSON（Pages 默认支持 CORS）
 *   C. 使用 jsdelivr CDN (https://cdn.jsdelivr.net/gh/user/repo@main/)
 *
 * 推荐方案 A：ESP32 代理请求，这样也能节省浏览器端的复杂度，
 * 而且固件下载可以直接由 ESP32 完成，不需要经过浏览器中转。
 * ============================================================
 */

// ============================================================
// 配置：改成你的 GitHub 信息
// ============================================================
var GITHUB_USER = '你的GitHub用户名';
var GITHUB_REPO = 'py32f003-ota';
var GITHUB_BRANCH = 'main';

// 方案 A：通过 ESP32 代理（推荐，无 CORS 问题）
// ESP32 端需要实现 /py32f003/api/latest 和 /py32f003/api/list 接口
var API_BASE = '/py32f003/api';

// 方案 B/C：直连 GitHub（有 CORS 问题，需配合代理或 Pages）
var GITHUB_RAW_BASE = 'https://raw.githubusercontent.com/' + GITHUB_USER + '/' + GITHUB_REPO + '/' + GITHUB_BRANCH;
var JSDELIVR_BASE = 'https://cdn.jsdelivr.net/gh/' + GITHUB_USER + '/' + GITHUB_REPO + '@' + GITHUB_BRANCH;

// 当前使用的基础 URL（默认走 ESP32 代理）
var BASE_URL = API_BASE;

// ============================================================
// 1. 缓存破坏器（防止浏览器缓存旧版本）
// ============================================================
function addCacheBuster(url) {
  var sep = url.indexOf('?') >= 0 ? '&' : '?';
  return url + sep + 't=' + Date.now();
}

// ============================================================
// 2. 获取最新版本信息 (release_latest.json)
// ============================================================
function getLatestFirmware(channel) {
  channel = channel || 'stable';
  var url = addCacheBuster(BASE_URL + '/release_latest.json');

  return fetch(url)
    .then(function(r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(function(data) {
      if (data.py32f003 && data.py32f003[channel]) {
        return data.py32f003[channel];
      }
      throw new Error('未找到 ' + channel + ' 版本信息');
    });
}

// ============================================================
// 3. 获取全部历史版本列表 (release.json)
// ============================================================
function getFirmwareList(channel) {
  channel = channel || 'stable';
  var url = addCacheBuster(BASE_URL + '/release.json');

  return fetch(url)
    .then(function(r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(function(data) {
      if (data.py32f003 && data.py32f003[channel]) {
        return data.py32f003[channel]; // 数组，最新在前
      }
      return [];
    });
}

// ============================================================
// 4. 解析 Release Notes 为 HTML 列表
// ============================================================
function renderReleaseNotes(description) {
  if (!description) return '';

  var parts = description.split('Release Notes:');
  var title = parts[0].trim();  // "V1.0.0"
  var body = parts[1] || '';

  // 按分号分割成多条
  var items = body.split(/;\s*/).filter(function(s) { return s.trim(); });

  var html = '<div class="py32f003-release-notes">';
  html += '<strong>' + title + ' Release Notes</strong>';
  html += '<ul>';
  items.forEach(function(item) {
    var text = item.replace(/^\d+\)\s*/, '').trim();
    if (text) html += '<li>' + text + '</li>';
  });
  html += '</ul></div>';
  return html;
}

// ============================================================
// 5. 版本比较 (判断是否有新版本)
// ============================================================
function compareVersions(v1, v2) {
  var a = v1.split('.').map(Number);
  var b = v2.split('.').map(Number);
  for (var i = 0; i < Math.max(a.length, b.length); i++) {
    var x = a[i] || 0;
    var y = b[i] || 0;
    if (x > y) return 1;
    if (x < y) return -1;
  }
  return 0;
}

// ============================================================
// 6. 开始 OTA 升级（通过 ESP32 代理）
// ============================================================
// ESP32 端实现 /py32f003/ota/start 接口
// 请求体: { url: "固件URL", checksum: "sha256", baudRate: 115200 }
// ESP32 收到后自己去 GitHub 下载固件，然后通过串口烧录 PY32F003
function startOtaUpdate(firmwareInfo) {
  return fetch('/py32f003/ota/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: firmwareInfo.url,
      checksum: firmwareInfo.checksum,
      baudRate: firmwareInfo.baudRate || 115200
    })
  })
  .then(function(r) { return r.json(); })
  .then(function(result) {
    if (result.success) {
      console.log('OTA 开始，任务ID:', result.taskId);
      return result.taskId;
    }
    throw new Error(result.error || '启动 OTA 失败');
  });
}

// ============================================================
// 7. 查询 OTA 进度
// ============================================================
function getOtaProgress(taskId) {
  return fetch('/py32f003/ota/status?taskId=' + encodeURIComponent(taskId))
    .then(function(r) { return r.json(); });
}

// ============================================================
// 8. 页面初始化示例（WLED PY32F003 页面加载时调用）
// ============================================================
function initPy32f003Page() {
  // 1. 显示当前 PY32F003 版本（从 ESP32 读取）
  fetch('/py32f003/version')
    .then(function(r) { return r.json(); })
    .then(function(info) {
      document.getElementById('py32f003-current-version').textContent = info.version || '未知';
    })
    .catch(function() {
      document.getElementById('py32f003-current-version').textContent = '读取失败';
    });

  // 2. 拉取最新稳定版，检查是否有更新
  getLatestFirmware('stable')
    .then(function(latest) {
      var currentEl = document.getElementById('py32f003-current-version');
      var currentVer = currentEl.textContent;

      document.getElementById('py32f003-latest-version').textContent = latest.version;
      document.getElementById('py32f003-release-notes').innerHTML = renderReleaseNotes(latest.description);

      // 比较版本
      if (currentVer && currentVer !== '未知' && currentVer !== '读取失败') {
        if (compareVersions(latest.version, currentVer) > 0) {
          document.getElementById('py32f003-update-badge').style.display = 'inline-block';
          document.getElementById('py32f003-update-btn').disabled = false;
        }
      }

      // 保存最新版信息，点击升级时用
      window._py32f003_latest = latest;
    })
    .catch(function(err) {
      console.error('获取最新版本失败:', err);
      document.getElementById('py32f003-latest-version').textContent = '获取失败';
    });

  // 3. 加载历史版本列表
  getFirmwareList('stable')
    .then(function(list) {
      var html = '';
      list.forEach(function(item) {
        html += '<div class="py32f003-fw-item" data-version="' + item.version + '">';
        html += '<div class="fw-version">v' + item.version + '</div>';
        html += '<div class="fw-notes">' + renderReleaseNotes(item.description) + '</div>';
        html += '<button class="btn flash-btn" onclick="flashFirmware(\'' + item.version + '\')">烧录此版本</button>';
        html += '</div>';
      });
      document.getElementById('py32f003-firmware-list').innerHTML = html;
      window._py32f003_list = list;
    })
    .catch(function(err) {
      console.error('获取版本列表失败:', err);
      document.getElementById('py32f003-firmware-list').innerHTML = '<p>加载失败，请检查网络</p>';
    });
}

// ============================================================
// 9. 烧录指定版本
// ============================================================
function flashFirmware(version) {
  var list = window._py32f003_list || [];
  var fw = list.find(function(item) { return item.version === version; });
  if (!fw) {
    alert('未找到版本: ' + version);
    return;
  }

  if (!confirm('确定要烧录 PY32F003 固件 v' + version + ' 吗？\n烧录过程中请勿断电！')) {
    return;
  }

  startOtaUpdate(fw)
    .then(function(taskId) {
      // 开始轮询进度
      pollOtaProgress(taskId);
    })
    .catch(function(err) {
      alert('启动升级失败: ' + err.message);
    });
}

// ============================================================
// 10. 轮询 OTA 进度
// ============================================================
function pollOtaProgress(taskId) {
  var progressBar = document.getElementById('py32f003-progress-bar');
  var progressText = document.getElementById('py32f003-progress-text');

  function poll() {
    getOtaProgress(taskId)
      .then(function(status) {
        // 更新进度条
        var pct = status.progress || 0;
        progressBar.style.width = pct + '%';
        progressText.textContent = status.stage + ' (' + pct + '%)';

        if (status.state === 'completed') {
          progressText.textContent = '升级完成！';
          alert('PY32F003 固件升级成功！');
        } else if (status.state === 'error') {
          progressText.textContent = '升级失败: ' + status.error;
          alert('升级失败: ' + status.error);
        } else {
          // 继续轮询
          setTimeout(poll, 1000);
        }
      })
      .catch(function() {
        setTimeout(poll, 2000); // 网络错误，稍等重试
      });
  }

  poll();
}

// ============================================================
// 11. 切换通道 (stable / beta)
// ============================================================
function switchChannel(channel) {
  getLatestFirmware(channel)
    .then(function(latest) {
      document.getElementById('py32f003-latest-version').textContent = latest.version;
      document.getElementById('py32f003-release-notes').innerHTML = renderReleaseNotes(latest.description);
      window._py32f003_latest = latest;
    });

  getFirmwareList(channel)
    .then(function(list) {
      var html = '';
      list.forEach(function(item) {
        html += '<div class="py32f003-fw-item">';
        html += '<div class="fw-version">v' + item.version + '</div>';
        html += '<div class="fw-notes">' + renderReleaseNotes(item.description) + '</div>';
        html += '<button class="btn flash-btn" onclick="flashFirmware(\'' + item.version + '\')">烧录此版本</button>';
        html += '</div>';
      });
      document.getElementById('py32f003-firmware-list').innerHTML = html;
      window._py32f003_list = list;
    });
}
