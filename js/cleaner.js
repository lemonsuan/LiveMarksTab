/**
 * cleaner.js — 书签清理模块
 * 扫描所有书签 URL 的可访问性，支持批量删除失效书签
 */

/** 并发数限制 */
const CLEANER_CONCURRENCY = 6;
/** 单个请求超时（ms） */
const CLEANER_TIMEOUT = 8000;

/**
 * 收集所有书签（递归遍历）
 * @returns {Promise<Array<{id, title, url, parentId}>>}
 */
async function collectAllBookmarks() {
  const tree = await chrome.bookmarks.getTree();
  const results = [];

  function walk(nodes) {
    for (const node of nodes) {
      if (node.url) {
        results.push({
          id: node.id,
          title: node.title || '未命名',
          url: node.url,
          parentId: node.parentId,
        });
      }
      if (node.children) walk(node.children);
    }
  }
  walk(tree);
  return results;
}

/**
 * 检测单个 URL 的可访问性
 * @returns {Promise<{status: 'ok'|'error'|'timeout', code: number}>}
 */
async function checkUrl(url) {
  // 跳过非 http(s) 协议
  if (!/^https?:\/\//i.test(url)) {
    return { status: 'skip', code: 0 };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CLEANER_TIMEOUT);

  try {
    const resp = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      redirect: 'follow',
    });
    clearTimeout(timer);
    if (resp.ok || resp.status === 405 || resp.status === 403) {
      // 405 = HEAD not allowed, 403 = forbidden (site exists but blocks)
      return { status: 'ok', code: resp.status };
    }
    return { status: 'error', code: resp.status };
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      return { status: 'timeout', code: 0 };
    }
    // 网络错误 = 不可达
    return { status: 'error', code: 0 };
  }
}

/**
 * 并发扫描所有书签
 * @param {Function} onProgress - 进度回调 (scanned, total, currentItem)
 * @returns {Promise<Array>} 扫描结果
 */
async function scanBookmarks(onProgress) {
  const bookmarks = await collectAllBookmarks();
  const total = bookmarks.length;
  const results = [];
  let scanned = 0;

  // 并发池
  const pool = [];
  for (const bm of bookmarks) {
    const task = checkUrl(bm.url).then(result => {
      scanned++;
      const item = { ...bm, ...result };
      results.push(item);
      if (onProgress) onProgress(scanned, total, item);
    });
    pool.push(task);

    // 控制并发
    if (pool.length >= CLEANER_CONCURRENCY) {
      await Promise.race(pool);
      // 移除已完成的
      for (let i = pool.length - 1; i >= 0; i--) {
        // Promise.race 不能直接知道哪个完成了，用 Promise.allSettled 代替
      }
      // 简化：等待一批完成
      await Promise.all(pool);
      pool.length = 0;
    }
  }
  // 等待剩余
  if (pool.length > 0) await Promise.all(pool);

  return results;
}

/**
 * 批量删除书签
 * @param {string[]} ids - 要删除的书签 ID 数组
 */
async function batchDeleteBookmarks(ids) {
  for (const id of ids) {
    try {
      await chrome.bookmarks.remove(id);
    } catch (err) {
      console.warn('[Cleaner] 删除失败:', id, err);
    }
  }
}

// ========== UI 逻辑 ==========

/** 当前筛选状态：'all' | 'error' | 'timeout' */
let _cleanerFilter = 'all';

/** 打开清理面板 */
function openCleanerPanel() {
  const overlay = document.getElementById('cleaner-overlay');
  overlay.classList.remove('hidden');
  requestAnimationFrame(() => overlay.classList.add('visible'));
  _resetCleanerUI();
}

function _resetCleanerUI() {
  _cleanerFilter = 'all';
  document.getElementById('cleaner-results').innerHTML = '';
  document.getElementById('cleaner-progress').style.display = 'none';
  document.getElementById('cleaner-bottom-bar').style.display = 'none';
  document.getElementById('cleaner-start').style.display = '';
  document.getElementById('cleaner-stats').style.display = 'none';
  document.getElementById('cleaner-filter-bar').style.display = 'none';
  document.getElementById('cleaner-empty').style.display = 'none';
  // 重置统计卡片
  ['cleaner-stat-total','cleaner-stat-ok','cleaner-stat-error','cleaner-stat-timeout']
    .forEach(id => { const el = document.getElementById(id); if(el) el.textContent = '—'; });
}

/** 关闭清理面板 */
function closeCleanerPanel() {
  const overlay = document.getElementById('cleaner-overlay');
  overlay.classList.remove('visible');
  setTimeout(() => overlay.classList.add('hidden'), 200);
}

/** 创建结果行 */
function _createResultRow(item) {
  const row = document.createElement('label');
  row.className = 'cleaner-item';
  row.dataset.status = item.status;
  row.title = '双击在新标签页打开';
  const statusLabel = item.status === 'error'
    ? (item.code ? `HTTP ${item.code}` : '无法连接')
    : '超时';
  row.innerHTML = `
    <input type="checkbox" checked data-id="${item.id}">
    <img class="cleaner-favicon" src="${getFaviconUrl(item.url)}" width="16" height="16" alt="" onerror="this.style.visibility='hidden'">
    <div class="cleaner-item-info">
      <span class="cleaner-item-title">${item.title || '未命名'}</span>
      <span class="cleaner-item-url">${item.url}</span>
    </div>
    <span class="cleaner-item-status ${item.status}">${statusLabel}</span>
  `;
  row.addEventListener('dblclick', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: item.url });
  });
  return row;
}

/** 应用筛选 */
function _applyFilter(filter) {
  _cleanerFilter = filter;
  document.querySelectorAll('.cleaner-filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === filter);
  });
  document.querySelectorAll('#cleaner-results .cleaner-item').forEach(row => {
    if (filter === 'all' || row.dataset.status === filter) {
      row.style.display = '';
    } else {
      row.style.display = 'none';
    }
  });
}

/** 开始扫描 */
async function startScan() {
  const startBtn = document.getElementById('cleaner-start');
  const progressWrap = document.getElementById('cleaner-progress');
  const progressFill = document.getElementById('cleaner-progress-fill');
  const progressText = document.getElementById('cleaner-progress-text');
  const resultsList = document.getElementById('cleaner-results');
  const bottomBar = document.getElementById('cleaner-bottom-bar');
  const statsEl = document.getElementById('cleaner-stats');
  const filterBar = document.getElementById('cleaner-filter-bar');
  const emptyEl = document.getElementById('cleaner-empty');

  startBtn.disabled = true;
  startBtn.textContent = '⏳ 扫描中…';
  progressWrap.style.display = '';
  resultsList.innerHTML = '';
  statsEl.style.display = '';

  let totalCount = 0, okCount = 0, errorCount = 0, timeoutCount = 0;

  const results = await scanBookmarks((scanned, total, item) => {
    totalCount = total;
    const pct = Math.round((scanned / total) * 100);
    progressFill.style.width = pct + '%';
    progressText.textContent = `${scanned} / ${total}`;

    if (item.status === 'ok' || item.status === 'skip') {
      okCount++;
    } else if (item.status === 'error') {
      errorCount++;
      resultsList.appendChild(_createResultRow(item));
    } else if (item.status === 'timeout') {
      timeoutCount++;
      resultsList.appendChild(_createResultRow(item));
    }

    // 实时更新统计卡片
    document.getElementById('cleaner-stat-total').textContent = total;
    document.getElementById('cleaner-stat-ok').textContent = okCount;
    document.getElementById('cleaner-stat-error').textContent = errorCount;
    document.getElementById('cleaner-stat-timeout').textContent = timeoutCount;
  });

  progressWrap.style.display = 'none';
  startBtn.style.display = 'none';

  const problemCount = errorCount + timeoutCount;

  if (problemCount === 0) {
    emptyEl.style.display = '';
  } else {
    filterBar.style.display = '';
    bottomBar.style.display = '';
    // 更新筛选按钮数量
    document.querySelector('[data-filter="all"] .filter-count').textContent = problemCount;
    document.querySelector('[data-filter="error"] .filter-count').textContent = errorCount;
    document.querySelector('[data-filter="timeout"] .filter-count').textContent = timeoutCount;
    _applyFilter('all');
  }
}

/** 初始化清理面板事件 */
function initCleaner() {
  // 关闭
  document.getElementById('cleaner-close-btn').addEventListener('click', closeCleanerPanel);
  document.getElementById('cleaner-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'cleaner-overlay') closeCleanerPanel();
  });

  // 开始扫描
  document.getElementById('cleaner-start').addEventListener('click', startScan);

  // 筛选 Tab
  document.getElementById('cleaner-filter-bar').addEventListener('click', (e) => {
    const btn = e.target.closest('.cleaner-filter-btn');
    if (btn) _applyFilter(btn.dataset.filter);
  });

  // 快捷选择
  document.getElementById('cleaner-select-all').addEventListener('click', () => {
    document.querySelectorAll('#cleaner-results .cleaner-item:not([style*="display: none"]) input[type=checkbox]')
      .forEach(cb => { cb.checked = true; });
  });
  document.getElementById('cleaner-deselect-all').addEventListener('click', () => {
    document.querySelectorAll('#cleaner-results .cleaner-item:not([style*="display: none"]) input[type=checkbox]')
      .forEach(cb => { cb.checked = false; });
  });
  document.getElementById('cleaner-select-error').addEventListener('click', () => {
    _applyFilter('error');
    document.querySelectorAll('#cleaner-results .cleaner-item input[type=checkbox]')
      .forEach(cb => { cb.checked = cb.closest('.cleaner-item').dataset.status === 'error'; });
  });
  document.getElementById('cleaner-select-timeout').addEventListener('click', () => {
    _applyFilter('timeout');
    document.querySelectorAll('#cleaner-results .cleaner-item input[type=checkbox]')
      .forEach(cb => { cb.checked = cb.closest('.cleaner-item').dataset.status === 'timeout'; });
  });

  // 删除选中
  document.getElementById('cleaner-delete-selected').addEventListener('click', async () => {
    const checkboxes = [...document.querySelectorAll('#cleaner-results input[type=checkbox]:checked')];
    const ids = checkboxes.map(cb => cb.dataset.id);
    if (ids.length === 0) { showToast('没有选中任何书签'); return; }
    if (!confirm(`确定删除选中的 ${ids.length} 个书签吗？此操作不可撤销。`)) return;

    await batchDeleteBookmarks(ids);
    showToast(`已删除 ${ids.length} 个书签`);
    checkboxes.forEach(cb => cb.closest('.cleaner-item').remove());

    // 更新统计
    const remaining = document.querySelectorAll('#cleaner-results .cleaner-item').length;
    document.querySelector('[data-filter="all"] .filter-count').textContent = remaining;
    document.querySelector('[data-filter="error"] .filter-count').textContent =
      document.querySelectorAll('#cleaner-results .cleaner-item[data-status="error"]').length;
    document.querySelector('[data-filter="timeout"] .filter-count').textContent =
      document.querySelectorAll('#cleaner-results .cleaner-item[data-status="timeout"]').length;

    if (remaining === 0) {
      document.getElementById('cleaner-filter-bar').style.display = 'none';
      document.getElementById('cleaner-bottom-bar').style.display = 'none';
      document.getElementById('cleaner-empty').style.display = '';
    }

    await loadBookmarks();
  });
}
