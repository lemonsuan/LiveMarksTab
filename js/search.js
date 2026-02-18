/**
 * search.js — 搜索栏功能：引擎切换 + 书签过滤 + 跳转搜索
 */

// 搜索引擎预设列表
const SEARCH_ENGINES = [
  { id: 'google',    name: 'Google',     url: 'https://www.google.com/search?q=',       icon: 'https://www.google.com/favicon.ico' },
  { id: 'bing',      name: 'Bing',       url: 'https://www.bing.com/search?q=',         icon: 'https://www.bing.com/favicon.ico' },
  { id: 'baidu',     name: '百度',       url: 'https://www.baidu.com/s?wd=',            icon: 'https://www.baidu.com/favicon.ico' },
  { id: 'duckduckgo', name: 'DuckDuckGo', url: 'https://duckduckgo.com/?q=',            icon: 'https://duckduckgo.com/favicon.ico' },
  { id: 'github',    name: 'GitHub',     url: 'https://github.com/search?q=',           icon: 'https://github.com/favicon.ico' },
];

let currentEngineId = 'google';
// 多引擎搜索：用户勾选的引擎 ID 列表，默认全选
let multiEngineIds = SEARCH_ENGINES.map(e => e.id);

/**
 * 初始化搜索栏
 */
function initSearch() {
  const input = document.getElementById('search-input');
  const engineBtn = document.getElementById('engine-btn');
  const engineList = document.getElementById('engine-list');

  // 加载保存的搜索引擎偏好
  chrome.storage.local.get(['searchEngine', 'multiEngines'], (data) => {
    currentEngineId = data.searchEngine || 'google';
    if (data.multiEngines && Array.isArray(data.multiEngines)) {
      multiEngineIds = data.multiEngines;
    }
    updateEngineUI();
  });

  // 渲染引擎下拉列表
  renderEngineList();

  // 切换引擎下拉
  engineBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    engineList.classList.toggle('hidden');
  });

  // 点击其他区域关闭下拉
  document.addEventListener('click', () => {
    engineList.classList.add('hidden');
  });

  // 搜索框输入 → 实时过滤书签
  input.addEventListener('input', debounce(() => {
    const query = input.value.trim();
    if (query) {
      filterBookmarks(query);
    } else {
      clearFilter();
    }
  }, 250));

  // 回车 → 跳转搜索引擎；Shift+Enter → 多引擎同时搜索
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const query = input.value.trim();
      if (!query) return;

      if (e.shiftKey) {
        // Shift+Enter: 同时打开所有勾选的搜索引擎
        e.preventDefault();
        const engines = SEARCH_ENGINES.filter(en => multiEngineIds.includes(en.id));
        if (engines.length === 0) {
          showToast('请先在设置中勾选至少一个搜索引擎');
          return;
        }
        engines.forEach(engine => {
          chrome.tabs.create({ url: engine.url + encodeURIComponent(query) });
        });
      } else {
        // Enter: 单引擎搜索
        const engine = SEARCH_ENGINES.find(en => en.id === currentEngineId) || SEARCH_ENGINES[0];
        window.location.href = engine.url + encodeURIComponent(query);
      }
    }
  });
}

/**
 * 渲染搜索引擎下拉列表
 */
function renderEngineList() {
  const list = document.getElementById('engine-list');
  list.innerHTML = '';
  SEARCH_ENGINES.forEach(engine => {
    const li = createElement('li', {
      className: engine.id === currentEngineId ? 'active' : '',
      onClick: (e) => {
        e.stopPropagation();
        selectEngine(engine.id);
      }
    }, [
      createElement('img', { src: engine.icon, alt: engine.name }),
      document.createTextNode(engine.name)
    ]);
    list.appendChild(li);
  });
}

/**
 * 选择搜索引擎
 */
function selectEngine(engineId) {
  currentEngineId = engineId;
  chrome.storage.local.set({ searchEngine: engineId });
  updateEngineUI();
  document.getElementById('engine-list').classList.add('hidden');
  renderEngineList();
}

/**
 * 更新引擎按钮 UI
 */
function updateEngineUI() {
  const engine = SEARCH_ENGINES.find(e => e.id === currentEngineId) || SEARCH_ENGINES[0];
  document.getElementById('engine-icon').src = engine.icon;
  document.getElementById('engine-name').textContent = engine.name;
}

/**
 * 过滤书签（输入时实时搜索）
 * 在两种布局下都生效
 */
function filterBookmarks(query) {
  const lowerQuery = query.toLowerCase();
  const items = document.querySelectorAll('.bookmark-item');
  let matchCount = 0;

  items.forEach(item => {
    const title = (item.querySelector('.title')?.textContent || '').toLowerCase();
    const url = (item.href || '').toLowerCase();
    const match = title.includes(lowerQuery) || url.includes(lowerQuery);
    item.style.display = match ? '' : 'none';
    if (match) matchCount++;
  });

  // 显示/隐藏空卡片
  document.querySelectorAll('.bookmark-card').forEach(card => {
    const visibleItems = card.querySelectorAll('.bookmark-item:not([style*="display: none"])');
    card.style.display = visibleItems.length > 0 ? '' : 'none';
  });

  // 搜索提示
  const hint = document.getElementById('search-hint');
  hint.textContent = `找到 ${matchCount} 个匹配的书签，Enter 搜索 / Shift+Enter 多引擎搜索`;
  hint.classList.remove('hidden');
}

/**
 * 清除过滤
 */
function clearFilter() {
  document.querySelectorAll('.bookmark-item').forEach(item => {
    item.style.display = '';
  });
  document.querySelectorAll('.bookmark-card').forEach(card => {
    card.style.display = '';
  });
  document.getElementById('search-hint').classList.add('hidden');
}

/**
 * 切换多引擎搜索的引擎勾选状态
 * @param {string} engineId
 * @param {boolean} checked
 */
function toggleMultiEngine(engineId, checked) {
  if (checked) {
    if (!multiEngineIds.includes(engineId)) {
      multiEngineIds.push(engineId);
    }
  } else {
    multiEngineIds = multiEngineIds.filter(id => id !== engineId);
  }
  chrome.storage.local.set({ multiEngines: multiEngineIds });
}

/**
 * 获取当前多引擎勾选列表（供 settings.js 使用）
 */
function getMultiEngineIds() {
  return multiEngineIds;
}
