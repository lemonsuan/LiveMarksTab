/**
 * app.js — 入口脚本：DOMContentLoaded 后按顺序初始化各模块
 *
 * 初始化顺序不可调换，因为各模块有依赖关系：
 *   0. initTheme()              ← 最先执行！设置 data-theme 避免闪白
 *   1. renderGreeting()         ← 渲染问候语
 *   2. initSettings()           ← 加载布局偏好 + 设置面板 Tab/事件绑定
 *   3. initSearch()             ← 加载搜索引擎偏好，绑定搜索框事件
 *   4. initContextMenu()        ← 绑定右键菜单点击事件
 *   5. initEditDialog()         ← 绑定编辑弹窗事件
 *   6. initCleaner()            ← 初始化书签清理面板
 *   7. loadBookmarks()          ← 读取书签 + 渲染三种布局（异步）
 *   8. renderQuickAccess()      ← 渲染快速访问网格（异步）
 *   9. registerBookmarkListeners() ← 注册变化监听
 */

document.addEventListener('DOMContentLoaded', async () => {
  // 0. 主题（最先！避免页面闪白）
  initTheme();

  // 1. 渲染问候语
  renderGreeting();

  // 2. 初始化设置面板
  initSettings();

  // 3. 初始化搜索栏
  initSearch();

  // 4. 初始化右键菜单
  initContextMenu();

  // 5. 初始化编辑弹窗
  initEditDialog();

  // 6. 初始化书签清理面板
  initCleaner();

  // 6.5 初始化批量操作
  initBatchActions();

  // 6.6 初始化帮助引导页
  initHelp();

  // 6.6 初始化帮助引导页
  initHelp();

  // 7. 读取 Chrome 书签并渲染到三种布局容器
  await loadBookmarks();

  // 8. 渲染快速访问网格（从书签中提取常用站点）
  renderQuickAccess();

  // 9. 注册 Chrome 书签变化监听器
  registerBookmarkListeners();
});

/**
 * 渲染问候语 — 根据当前时间显示不同问候
 */
function renderGreeting() {
  const el = document.getElementById('greeting');
  if (!el) return;

  const hour = new Date().getHours();
  let text;
  if (hour < 6) text = '夜深了，注意休息 🌙';
  else if (hour < 12) text = '早上好 ☀️';
  else if (hour < 14) text = '中午好 🌤';
  else if (hour < 18) text = '下午好 ☁️';
  else text = '晚上好 🌙';

  el.textContent = text;

  // 加载一言
  fetchHitokoto();
}

/**
 * 获取一言 (hitokoto.cn)
 */
async function fetchHitokoto() {
  try {
    const response = await fetch('https://v1.hitokoto.cn');
    const { uuid, hitokoto: hitokotoText } = await response.json();
    const el = document.getElementById('hitokoto_text');
    if (el) {
      el.href = `https://hitokoto.cn/?uuid=${uuid}`;
      el.textContent = hitokotoText;
    }
  } catch {
    // 网络失败静默忽略
  }
}

// 默认快速访问站点（首次使用时的初始数据）
const DEFAULT_QUICK_SITES = [
  { title: '百度', url: 'https://www.baidu.com' },
  { title: 'Google', url: 'https://www.google.com' },
  { title: 'GitHub', url: 'https://github.com' },
  { title: '知乎', url: 'https://www.zhihu.com' },
  { title: '哔哩哔哩', url: 'https://www.bilibili.com' },
  { title: '微博', url: 'https://weibo.com' },
  { title: '掘金', url: 'https://juejin.cn' },
  { title: '淘宝', url: 'https://www.taobao.com' },
];

/**
 * 渲染快速访问网格 — 用户可自定义站点
 * 数据存储在 chrome.storage.local.quickSites
 */
function renderQuickAccess() {
  const grid = document.getElementById('site-grid');
  if (!grid) return;

  chrome.storage.local.get(['quickSites'], (data) => {
    let sites = data.quickSites;

    // 首次使用：从默认列表初始化
    if (!sites || !Array.isArray(sites)) {
      sites = DEFAULT_QUICK_SITES;
      chrome.storage.local.set({ quickSites: sites });
    }

    grid.innerHTML = '';

    // 渲染已有站点
    sites.forEach((site, index) => {
      const link = createElement('a', {
        className: 'site-item',
        href: site.url,
        title: site.title + '\n' + site.url,
      });

      const iconWrap = createElement('div', { className: 'site-icon' });
      const img = createElement('img', {
        src: getFaviconUrl(site.url, 32),
        alt: '',
      });
      img.onerror = function () {
        this.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="%239898a6" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>';
      };
      iconWrap.appendChild(img);

      const name = createElement('span', { className: 'site-name' }, site.title || '未命名');

      link.appendChild(iconWrap);
      link.appendChild(name);

      // 右键菜单：编辑/删除
      link.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        showQuickSiteMenu(e.clientX, e.clientY, index);
      });

      grid.appendChild(link);
    });

    // 添加按钮（如果不足 8 个）
    if (sites.length < 8) {
      const addBtn = createElement('a', {
        className: 'site-item site-add-btn',
        href: 'javascript:void(0)',
        title: '添加快捷方式',
      });

      const iconWrap = createElement('div', { className: 'site-icon site-add-icon' });
      iconWrap.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>';

      const name = createElement('span', { className: 'site-name' }, '添加');

      addBtn.appendChild(iconWrap);
      addBtn.appendChild(name);

      addBtn.addEventListener('click', (e) => {
        e.preventDefault();
        showQuickSiteDialog();
      });

      grid.appendChild(addBtn);
    }
  });
}

/**
 * 显示快速访问站点的右键菜单
 */
function showQuickSiteMenu(x, y, siteIndex) {
  // 移除已有的菜单
  const existing = document.getElementById('quick-site-menu');
  if (existing) existing.remove();

  const menu = createElement('div', {
    id: 'quick-site-menu',
    className: 'context-menu',
  });

  // 编辑
  const editItem = createElement('div', { className: 'context-menu-item' });
  editItem.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg><span>编辑</span>';
  editItem.addEventListener('click', () => {
    menu.remove();
    showQuickSiteDialog(siteIndex);
  });

  // 删除
  const delItem = createElement('div', { className: 'context-menu-item' });
  delItem.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m5-3h4a1 1 0 0 1 1 1v1H9V4a1 1 0 0 1 1-1z"/></svg><span>删除</span>';
  delItem.addEventListener('click', () => {
    menu.remove();
    chrome.storage.local.get(['quickSites'], (data) => {
      const sites = data.quickSites || [];
      sites.splice(siteIndex, 1);
      chrome.storage.local.set({ quickSites: sites }, () => {
        renderQuickAccess();
      });
    });
    showToast('已删除');
  });

  menu.appendChild(editItem);
  menu.appendChild(delItem);

  menu.style.left = x + 'px';
  menu.style.top = y + 'px';
  document.body.appendChild(menu);

  // 点击其他区域关闭
  const closeMenu = () => {
    menu.remove();
    document.removeEventListener('click', closeMenu);
  };
  setTimeout(() => document.addEventListener('click', closeMenu), 0);
}

/**
 * 显示添加/编辑快速访问站点弹窗（复用书签编辑弹窗样式）
 * @param {number} [editIndex] - 如果传入则为编辑模式
 */
function showQuickSiteDialog(editIndex) {
  const isEdit = editIndex !== undefined;

  chrome.storage.local.get(['quickSites'], (data) => {
    const sites = data.quickSites || [];
    const site = isEdit ? sites[editIndex] : { title: '', url: '' };

    const overlay = document.getElementById('edit-overlay');
    const titleEl = document.getElementById('edit-title');
    const nameInput = document.getElementById('edit-name');
    const urlInput = document.getElementById('edit-url');
    const urlGroup = document.getElementById('edit-url-group');
    const saveBtn = document.getElementById('edit-save');

    titleEl.textContent = isEdit ? '编辑快捷方式' : '添加快捷方式';
    nameInput.value = site.title || '';
    urlGroup.style.display = '';
    urlInput.value = site.url || '';

    overlay.classList.remove('hidden');
    requestAnimationFrame(() => {
      overlay.classList.add('visible');
      nameInput.focus();
    });

    // 替换保存按钮的事件（一次性）
    const newSave = saveBtn.cloneNode(true);
    saveBtn.parentNode.replaceChild(newSave, saveBtn);

    newSave.addEventListener('click', () => {
      const title = nameInput.value.trim();
      let url = urlInput.value.trim();

      if (!title) { showToast('请输入名称'); return; }
      if (!url) { showToast('请输入网址'); return; }

      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
      }

      if (isEdit) {
        sites[editIndex] = { title, url };
      } else {
        sites.push({ title, url });
      }

      chrome.storage.local.set({ quickSites: sites }, () => {
        renderQuickAccess();
        showToast(isEdit ? '已更新' : '已添加');
      });

      // 关闭弹窗
      newSave.onclick = null; // 清理事件
      overlay.classList.remove('visible');
      setTimeout(() => overlay.classList.add('hidden'), 250);
    });

    // 绑定取消按钮关闭弹窗
    const cancelBtn = document.getElementById('edit-cancel');
    const newCancel = cancelBtn.cloneNode(true);
    cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);
    
    newCancel.addEventListener('click', () => {
      overlay.classList.remove('visible');
      setTimeout(() => overlay.classList.add('hidden'), 250);
    });
  });
}

/**
 * 初始化帮助/关于 — 内容已整合到设置面板「关于」Tab
 * 帮助按钮已从工具栏移除，此函数保留供参考，无需执行任何操作
 */
function initHelp() {
  // 帮助内容已迁移至设置面板「关于」Tab
  // 通过设置按钮 > 关于 Tab 访问
}
