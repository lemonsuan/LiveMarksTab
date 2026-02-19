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
}

/**
 * 渲染快速访问网格 — 从书签树中提取一级文件夹下的前几个链接
 * 简单策略：取书签栏前 8 个直接链接
 */
function renderQuickAccess() {
  const grid = document.getElementById('site-grid');
  if (!grid || !bookmarkTreeCache || bookmarkTreeCache.length === 0) return;

  grid.innerHTML = '';

  const root = bookmarkTreeCache[0];
  const quickLinks = [];

  // 从各个根子节点中提取直接链接
  if (root.children) {
    root.children.forEach(rootChild => {
      if (rootChild.children) {
        rootChild.children.forEach(item => {
          if (item.url && quickLinks.length < 8) {
            quickLinks.push(item);
          }
        });
      }
    });
  }

  if (quickLinks.length === 0) {
    // 没有直接链接，隐藏快速访问区域
    const section = document.getElementById('quick-access');
    if (section) section.style.display = 'none';
    return;
  }

  quickLinks.forEach(item => {
    const link = createElement('a', {
      className: 'site-item',
      href: item.url,
      title: item.title,
    });

    const iconWrap = createElement('div', { className: 'site-icon' });
    const img = createElement('img', {
      src: getFaviconUrl(item.url, 32),
      alt: '',
    });
    img.onerror = function () {
      this.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="%239898a6" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>';
    };
    iconWrap.appendChild(img);

    const name = createElement('span', { className: 'site-name' }, item.title || new URL(item.url).hostname);

    link.appendChild(iconWrap);
    link.appendChild(name);
    grid.appendChild(link);
  });
}
