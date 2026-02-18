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

/** 打开清理面板 */
function openCleanerPanel() {
  const overlay = document.getElementById('cleaner-overlay');
  overlay.classList.remove('hidden');
  requestAnimationFrame(() => overlay.classList.add('visible'));

  // 重置状态
  document.getElementById('cleaner-results').innerHTML = '';
  document.getElementById('cleaner-progress').style.display = 'none';
  document.getElementById('cleaner-actions').style.display = 'none';
  document.getElementById('cleaner-start').style.display = '';
  document.getElementById('cleaner-summary').textContent = '';
}

/** 关闭清理面板 */
function closeCleanerPanel() {
  const overlay = document.getElementById('cleaner-overlay');
  overlay.classList.remove('visible');
  setTimeout(() => overlay.classList.add('hidden'), 200);
}

/** 开始扫描 */
async function startScan() {
  const startBtn = document.getElementById('cleaner-start');
  const progressBar = document.getElementById('cleaner-progress');
  const progressFill = document.getElementById('cleaner-progress-fill');
  const progressText = document.getElementById('cleaner-progress-text');
  const resultsList = document.getElementById('cleaner-results');
  const summary = document.getElementById('cleaner-summary');
  const actions = document.getElementById('cleaner-actions');

  startBtn.style.display = 'none';
  progressBar.style.display = '';
  resultsList.innerHTML = '';
  summary.textContent = '正在扫描…';

  let errorCount = 0;
  let timeoutCount = 0;

  const results = await scanBookmarks((scanned, total, item) => {
    const pct = Math.round((scanned / total) * 100);
    progressFill.style.width = pct + '%';
    progressText.textContent = `${scanned} / ${total}`;

    // 只显示有问题的
    if (item.status === 'error' || item.status === 'timeout') {
      if (item.status === 'error') errorCount++;
      if (item.status === 'timeout') timeoutCount++;

      const row = document.createElement('label');
      row.className = 'cleaner-item';
      row.title = '双击在新标签页打开';
      row.innerHTML = `
        <input type="checkbox" checked data-id="${item.id}">
        <img src="${getFaviconUrl(item.url)}" width="16" height="16" alt="">
        <span class="cleaner-item-title" title="${item.url}">${item.title}</span>
        <span class="cleaner-item-status ${item.status}">${
          item.status === 'error'
            ? (item.code ? `HTTP ${item.code}` : '无法连接')
            : '超时'
        }</span>
      `;
      // 双击在新标签页打开（阻止 label 默认行为避免触发 checkbox）
      row.addEventListener('dblclick', (e) => {
        e.preventDefault();
        chrome.tabs.create({ url: item.url });
      });
      resultsList.appendChild(row);
    }
  });

  const problemCount = errorCount + timeoutCount;
  progressBar.style.display = 'none';
  summary.textContent = `扫描完成：共 ${results.length} 个书签，${problemCount} 个异常（${errorCount} 个不可访问，${timeoutCount} 个超时）`;

  if (problemCount > 0) {
    actions.style.display = '';
  } else {
    summary.textContent += '  🎉 所有书签均可正常访问！';
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

  // 全选 / 取消全选
  document.getElementById('cleaner-select-all').addEventListener('click', () => {
    document.querySelectorAll('#cleaner-results input[type=checkbox]').forEach(cb => {
      cb.checked = true;
    });
  });

  document.getElementById('cleaner-deselect-all').addEventListener('click', () => {
    document.querySelectorAll('#cleaner-results input[type=checkbox]').forEach(cb => {
      cb.checked = false;
    });
  });

  // 删除选中
  document.getElementById('cleaner-delete-selected').addEventListener('click', async () => {
    const checkboxes = document.querySelectorAll('#cleaner-results input[type=checkbox]:checked');
    const ids = [...checkboxes].map(cb => cb.dataset.id);
    if (ids.length === 0) {
      showToast('没有选中任何书签');
      return;
    }
    if (!confirm(`确定删除选中的 ${ids.length} 个书签吗？此操作不可撤销。`)) return;

    await batchDeleteBookmarks(ids);
    showToast(`已删除 ${ids.length} 个书签`);

    // 移除已删除的行
    checkboxes.forEach(cb => cb.closest('.cleaner-item').remove());

    // 刷新书签列表
    await loadBookmarks();
  });
}
