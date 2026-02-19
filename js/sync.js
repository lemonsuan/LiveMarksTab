/**
 * sync.js — 双向同步：监听 Chrome 书签变化 + Sync Lock 防死循环
 *
 * Sync Lock 原理:
 *   问题：UI 删除书签 → chrome.bookmarks.remove() → 触发 onRemoved → 重新渲染 → 无限循环
 *   解法：UI 发起的写操作全部经过 writeBookmarkFromUI() 封装，
 *         写入前 _syncLock=true，监听器检查到 _syncLock 直接 return，
 *         写入后 200ms 解锁 (确保事件回调已完成)
 *
 * 依赖:
 *   - bookmarks.js: loadBookmarks() (监听器触发时重新渲染)
 */

// 同步锁：当 UI 主动写入书签时置 true，避免监听器反向触发 UI 重绘
let _syncLock = false;

/**
 * 设置同步锁（外部调用，如从 UI 发起的写操作）
 */
function setSyncLock() {
  _syncLock = true;
}

/**
 * 释放同步锁（延迟释放，确保事件回调已完成）
 */
function releaseSyncLock(delay = 200) {
  setTimeout(() => { _syncLock = false; }, delay);
}

/**
 * 从 UI 发起的书签写操作（统一封装，自动加锁解锁）
 *
 * 用法示例:
 *   await writeBookmarkFromUI('remove', bookmarkId)        // 删除
 *   await writeBookmarkFromUI('update', bookmarkId, { title: 'new' }) // 修改
 *   await writeBookmarkFromUI('create', { parentId, title, url })     // 新建
 *   await writeBookmarkFromUI('removeTree', folderId)      // 删除文件夹
 *
 * @param {string} action - Chrome bookmarks API 方法名: 'create'|'update'|'remove'|'removeTree'|'move'
 * @param {...any} args - 传递给 chrome.bookmarks[action]() 的参数
 * @returns {Promise} Chrome API 返回值
 */
async function writeBookmarkFromUI(action, ...args) {
  setSyncLock();
  try {
    const result = await chrome.bookmarks[action](...args);
    return result;
  } finally {
    releaseSyncLock(); // finally 确保即使报错也能解锁
  }
}

/**
 * 注册所有书签变化监听器
 * 外部变更 (如在 Chrome 书签管理器中编辑/手机同步) → 触发监听器 → loadBookmarks() 全量刷新
 * Phase 1 采用全量刷新策略，后续可优化为差量更新
 */
function registerBookmarkListeners() {
  // 新增书签
  chrome.bookmarks.onCreated.addListener((id, bookmark) => {
    if (_syncLock) return; // UI 发起的变更，跳过
    // console.log('[Sync] 外部新增书签:', id, bookmark.title);
    loadBookmarks();
  });

  // 删除书签
  chrome.bookmarks.onRemoved.addListener((id, removeInfo) => {
    if (_syncLock) return;
    // console.log('[Sync] 外部删除书签:', id);
    loadBookmarks();
  });

  // 修改书签（标题、URL）
  chrome.bookmarks.onChanged.addListener((id, changeInfo) => {
    if (_syncLock) return;
    // console.log('[Sync] 外部修改书签:', id, changeInfo);
    loadBookmarks();
  });

  // 移动书签（更换父文件夹或位置）
  chrome.bookmarks.onMoved.addListener((id, moveInfo) => {
    if (_syncLock) return;
    // console.log('[Sync] 外部移动书签:', id, moveInfo);
    loadBookmarks();
  });

  // 当子节点重新排序时（Chrome 91+）
  if (chrome.bookmarks.onChildrenReordered) {
    chrome.bookmarks.onChildrenReordered.addListener((id, reorderInfo) => {
      if (_syncLock) return;
      // console.log('[Sync] 外部重排书签:', id);
      loadBookmarks();
    });
  }
}
