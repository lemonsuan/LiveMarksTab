/**
 * app.js — 入口脚本：DOMContentLoaded 后按顺序初始化各模块
 *
 * 初始化顺序不可调换，因为各模块有依赖关系：
 *   0. initTheme()              ← 最先执行！设置 data-theme 避免闪白
 *   1. initSettings()           ← 加载布局偏好 + 设置面板 Tab/事件绑定
 *   2. initSearch()             ← 加载搜索引擎偏好，绑定搜索框事件
 *   3. initContextMenu()        ← 绑定右键菜单点击事件
 *   4. initEditDialog()         ← 绑定编辑弹窗事件
 *   5. loadBookmarks()          ← 读取书签 + 渲染三种布局（异步）
 *   6. registerBookmarkListeners() ← 注册变化监听（在首次渲染完成后）
 */

document.addEventListener('DOMContentLoaded', async () => {
  // console.log('[App] 书签导航初始化中...');

  // 0. 主题（最先！避免页面闪白——先设 data-theme 再渲染内容）
  initTheme();

  // 1. 初始化设置面板（Tab切换 + 布局偏好 + 外观设置事件绑定）
  initSettings();

  // 2. 初始化搜索栏（加载搜索引擎偏好 + 绑定事件）
  initSearch();

  // 3. 初始化右键菜单（绑定 document 级别的事件监听）
  initContextMenu();

  // 4. 初始化编辑弹窗（绑定弹窗内的保存/取消/关闭事件）
  initEditDialog();

  // 4.5 初始化书签清理面板
  initCleaner();

  // 5. 读取 Chrome 书签并渲染到三种布局容器
  await loadBookmarks();

  // 6. 注册 Chrome 书签变化监听器（外部变更 → 刷新 UI）
  registerBookmarkListeners();

  // console.log('[App] 初始化完成');
});
