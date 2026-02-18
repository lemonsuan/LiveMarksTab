/**
 * bookmarks.js — 书签数据读取与渲染 + 右键菜单 + 编辑弹窗
 *
 * 职责:
 *   - 读取 Chrome 书签树并提取一级文件夹
 *   - 渲染三种布局 (卡片/侧边栏/行)
 *   - 管理右键菜单的显隐和动作派发
 *   - 管理编辑弹窗的显隐和 Chrome API 调用
 *   - 显示 Toast 通知
 *
 * Chrome 书签树结构:
 *   Root (id: "0")
 *     ├── 书签栏 (id: "1")
 *     ├── 其他书签 (id: "2")
 *     └── 移动设备书签 (id: "3")  -- 可能不存在
 *
 * 映射规则:
 *   1. 根节点下的 3 个固定文件夹 → 合并，提取其子项
 *   2. 一级文件夹 → 分类卡片/行区块
 *   3. 嵌套子文件夹 → 可折叠子分组
 *   4. 散落链接 (直接在书签栏下的链接) → 归入「未分类」
 *
 * 依赖:
 *   - utils.js: createElement, getFaviconUrl, createFolderIcon, createExpandIcon
 *   - sync.js: writeBookmarkFromUI (UI 发起的写操作封装)
 */

// 书签树缓存（上次 getTree 的原始结果，留备后续差量更新用）
let bookmarkTreeCache = [];

// 行布局每行最大可见行数，实际可见项 = ROWS_MAX_VISIBLE × 每行栅格列数(约 6 列)
const ROWS_MAX_VISIBLE = 6;

// 当前右键菜单绑定的书签数据（type: 'bookmark'|'folder', id, title, url?)
let contextTarget = null;

/**
 * 获取所有书签并渲染到三种布局容器
 * 这个函数是主入口，被 app.js 和 sync.js 调用
 */
async function loadBookmarks() {
  const tree = await chrome.bookmarks.getTree(); // 返回完整书签树
  bookmarkTreeCache = tree;
  renderBookmarks(tree);
}

/**
 * 从书签树中提取平铺的一级文件夹和散落链接
 *
 * Chrome 书签树结构为:
 *   tree[0] (根)
 *     ├─ children[0] 书签栏    → rootChild
 *     │    ├─ 工作 (文件夹)   → allFolders
 *     │    └─ google.com (链接) → allLooseLinks
 *     ├─ children[1] 其他书签  → rootChild
 *     └─ children[2] 移动书签  → rootChild (可能不存在)
 *
 * @param {Array} tree - chrome.bookmarks.getTree() 的返回值
 * @returns {{ allFolders: Array, allLooseLinks: Array }}
 */
function extractFoldersAndLinks(tree) {
  const root = tree[0];
  const allFolders = [];     // 收集所有一级文件夹
  const allLooseLinks = [];  // 收集直接在根子节点下的裸链接

  if (root.children) {
    // 遍历书签栏、其他书签、移动书签这三个固定节点
    root.children.forEach(rootChild => {
      if (rootChild.children) {
        // 遍历每个固定节点下的直接子项
        rootChild.children.forEach(item => {
          if (item.children) {
            allFolders.push(item);       // 文件夹 → 分类
          } else if (item.url) {
            allLooseLinks.push(item);    // 裸链接 → 未分类
          }
        });
      }
    });
  }

  // 散落链接归入虚拟「未分类」文件夹，插入数组头部
  if (allLooseLinks.length > 0) {
    allFolders.unshift({
      id: '__uncategorized__',  // 虚拟 ID，不对应真实书签节点
      title: '未分类',
      children: allLooseLinks,
    });
  }

  return { allFolders, allLooseLinks };
}

/**
 * 渲染书签到三种布局容器
 * 三种布局始终同时渲染，通过 CSS display 控制可见性
 * 这样切换布局时无需重新读取书签数据
 *
 * @param {Array} tree - chrome.bookmarks.getTree() 的返回值
 */
function renderBookmarks(tree) {
  const { allFolders } = extractFoldersAndLinks(tree);

  renderGridLayout(allFolders);    // 布局 A: 平铺网格
  renderSidebarLayout(allFolders); // 布局 B: 侧边栏
  renderRowsLayout(allFolders);    // 布局 C: 行布局（默认）
}

// ============================================
// 布局 A: 平铺网格
// 每个一级文件夹 → 一张卡片，卡片内渲染链接和嵌套文件夹
// CSS: grid-template-columns: repeat(auto-fill, minmax(280px, 1fr))
// ============================================

function renderGridLayout(folders) {
  const container = document.getElementById('layout-grid');
  container.innerHTML = '';

  if (folders.length === 0) {
    container.innerHTML = renderEmptyState();
    return;
  }

  folders.forEach(folder => {
    container.appendChild(createBookmarkCard(folder));
  });
}

function createBookmarkCard(folder) {
  const card = createElement('div', { className: 'bookmark-card', dataset: { id: folder.id } });

  const header = createElement('div', { className: 'card-header' });
  const headerLeft = createElement('span', {}, [createFolderIcon(), document.createTextNode(folder.title || '未命名')]);
  header.appendChild(headerLeft);
  card.appendChild(header);

  const body = createElement('div', { className: 'card-body' });
  renderFolderContent(body, folder.children || []);
  card.appendChild(body);

  return card;
}

function renderFolderContent(container, items) {
  items.forEach(item => {
    if (item.url) {
      container.appendChild(createBookmarkLink(item));
    } else if (item.children) {
      container.appendChild(createNestedFolder(item));
    }
  });
}

// ============================================
// 布局 B: 侧边栏
// 左侧导航栏 (sidebar-nav) + 右侧内容区 (sidebar-content)
// 点击导航项切换右侧显示的文件夹内容
// ============================================

let activeSidebarFolderId = null;
let _sidebarFolders = [];

function renderSidebarLayout(folders) {
  const nav = document.getElementById('sidebar-nav');
  const content = document.getElementById('sidebar-content');
  nav.innerHTML = '';
  content.innerHTML = '';
  _sidebarFolders = folders;

  if (folders.length === 0) return;

  folders.forEach((folder, index) => {
    const navItem = createElement('div', {
      className: 'sidebar-nav-item' + (index === 0 ? ' active' : ''),
      dataset: { id: folder.id },
      onClick: () => selectSidebarFolder(folder.id),
    }, [createFolderIcon(), document.createTextNode(folder.title || '未命名')]);
    nav.appendChild(navItem);
  });

  activeSidebarFolderId = folders[0].id;
  renderSidebarContent(content, folders[0].children || []);
}

function selectSidebarFolder(folderId) {
  activeSidebarFolderId = folderId;
  document.querySelectorAll('.sidebar-nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.id === folderId);
  });
  const folder = _sidebarFolders.find(f => f.id === folderId);
  const content = document.getElementById('sidebar-content');
  content.innerHTML = '';
  if (folder) {
    renderSidebarContent(content, folder.children || []);
  }
}

function renderSidebarContent(container, items) {
  items.forEach(item => {
    if (item.url) {
      container.appendChild(createBookmarkLink(item));
    } else if (item.children) {
      container.appendChild(createNestedFolder(item));
    }
  });
}

// ============================================
// 布局 C: 行布局（默认）
// 每个一级文件夹占一整行，链接水平网格排列
// 超过 ROWS_MAX_VISIBLE * 6 项显示「展开更多」按钮
// ============================================

function renderRowsLayout(folders) {
  const container = document.getElementById('layout-rows');
  container.innerHTML = '';

  if (folders.length === 0) {
    container.innerHTML = renderEmptyState();
    return;
  }

  folders.forEach(folder => {
    container.appendChild(createRowSection(folder));
  });
}

/**
 * 创建行布局的一个分类区块
 */
function createRowSection(folder) {
  const section = createElement('div', { className: 'row-section', dataset: { id: folder.id } });

  // 头部
  const header = createElement('div', { className: 'row-header' });
  header.appendChild(createFolderIcon());
  header.appendChild(createElement('span', { className: 'row-title' }, folder.title || '未命名'));

  // 收集直接链接和子文件夹
  const directLinks = [];
  const subFolders = [];
  (folder.children || []).forEach(item => {
    if (item.url) directLinks.push(item);
    else if (item.children) subFolders.push(item);
  });

  const totalCount = directLinks.length;
  header.appendChild(createElement('span', { className: 'row-count' }, `(${totalCount})`));
  section.appendChild(header);

  // 链接网格
  const grid = createElement('div', { className: 'row-items' });
  // 计算每行大约几个，用 grid 自动填充，这里用 ROWS_MAX_VISIBLE 行 x 估算列数
  // 实际上我们按可视项数量限制：最多 6 行 x 大约 6 个/行 = 36 个可见
  const maxVisible = ROWS_MAX_VISIBLE * 6;
  const hasMore = totalCount > maxVisible;

  directLinks.forEach((item, index) => {
    const link = createBookmarkLink(item);
    if (index >= maxVisible) {
      link.classList.add('row-hidden', 'row-hidden-init');
    }
    grid.appendChild(link);
  });
  section.appendChild(grid);

  // 子文件夹也渲染为嵌套
  subFolders.forEach(sub => {
    section.appendChild(createNestedFolder(sub));
  });

  // 「更多」按钮
  if (hasMore) {
    const moreBtn = createElement('button', { className: 'row-more-btn' });
    const hiddenCount = totalCount - maxVisible;
    moreBtn.innerHTML = `展开更多 (${hiddenCount}) <svg viewBox="0 0 24 24" width="12" height="12"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;

    moreBtn.addEventListener('click', () => {
      const isExpanded = moreBtn.classList.toggle('expanded');
      // 直接切换 row-hidden 类，避免 CSS 优先级覆盖 inline style
      grid.querySelectorAll('.bookmark-item.row-hidden-init').forEach(el => {
        if (isExpanded) {
          el.classList.remove('row-hidden');
        } else {
          el.classList.add('row-hidden');
        }
      });
      if (isExpanded) {
        moreBtn.innerHTML = `收起 <svg viewBox="0 0 24 24" width="12" height="12"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
      } else {
        moreBtn.innerHTML = `展开更多 (${hiddenCount}) <svg viewBox="0 0 24 24" width="12" height="12"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
      }
    });
    section.appendChild(moreBtn);
  }

  // 分割线
  section.appendChild(createElement('div', { className: 'row-divider' }));

  return section;
}

// ============================================
// 通用组件 — 三种布局共享
// createBookmarkLink(): 单个书签链接（favicon + 标题 + 右键菜单）
// createNestedFolder(): 可折叠嵌套文件夹
// renderEmptyState(): 空状态提示
// ============================================

function createBookmarkLink(item) {
  const a = createElement('a', {
    className: 'bookmark-item',
    href: item.url,
    title: `${item.title}\n${item.url}`,
    dataset: { id: item.id },
  });

  const favicon = createElement('img', {
    className: 'favicon',
    src: getFaviconUrl(item.url),
    alt: '',
  });
  favicon.onerror = function () {
    this.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="%239898a6" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l2 2"/></svg>';
  };

  const title = createElement('span', { className: 'title' }, item.title || item.url);

  a.appendChild(favicon);
  a.appendChild(title);

  // 右键菜单
  a.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    showContextMenu(e.clientX, e.clientY, {
      type: 'bookmark',
      id: item.id,
      title: item.title,
      url: item.url,
    });
  });

  return a;
}

function createNestedFolder(folder) {
  const wrapper = createElement('div', { className: 'nested-folder', dataset: { id: folder.id } });

  const header = createElement('div', { className: 'nested-folder-header' });
  header.appendChild(createExpandIcon());
  header.appendChild(createFolderIcon());
  header.appendChild(document.createTextNode(folder.title || '未命名'));

  const body = createElement('div', { className: 'nested-folder-body' });
  renderFolderContent(body, folder.children || []);

  header.addEventListener('click', () => {
    header.classList.toggle('expanded');
    body.classList.toggle('expanded');
  });

  // 右键菜单（文件夹）
  header.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    showContextMenu(e.clientX, e.clientY, {
      type: 'folder',
      id: folder.id,
      title: folder.title,
    });
  });

  wrapper.appendChild(header);
  wrapper.appendChild(body);
  return wrapper;
}

function renderEmptyState() {
  return `
    <div class="empty-state">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M3 7a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/>
      </svg>
      <p>暂无书签</p>
    </div>
  `;
}

// ============================================
// 右键菜单 — 由 initContextMenu() 初始化事件绑定
// 显隐逻辑：show 时 remove .hidden，点击其他区域 add .hidden
// 定位逻辑：以鼠标位置为起点，超出视口时自动调整
// ============================================

function showContextMenu(x, y, target) {
  contextTarget = target;
  const menu = document.getElementById('context-menu');

  // 根据类型显示/隐藏菜单项
  const openItem = menu.querySelector('[data-action="open"]');
  const openNewItem = menu.querySelector('[data-action="open-new"]');
  const urlGroup = document.getElementById('edit-url-group');

  if (target.type === 'folder') {
    openItem.style.display = 'none';
    openNewItem.style.display = 'none';
    if (urlGroup) urlGroup.style.display = 'none';
  } else {
    openItem.style.display = '';
    openNewItem.style.display = '';
    if (urlGroup) urlGroup.style.display = '';
  }

  // 定位
  menu.style.left = x + 'px';
  menu.style.top = y + 'px';
  menu.classList.remove('hidden');

  // 确保不超出视口
  requestAnimationFrame(() => {
    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
      menu.style.left = (window.innerWidth - rect.width - 8) + 'px';
    }
    if (rect.bottom > window.innerHeight) {
      menu.style.top = (window.innerHeight - rect.height - 8) + 'px';
    }
  });
}

function hideContextMenu() {
  document.getElementById('context-menu').classList.add('hidden');
  contextTarget = null;
}

/**
 * 初始化右键菜单
 */
function initContextMenu() {
  // 点击其他区域关闭
  document.addEventListener('click', hideContextMenu);
  document.addEventListener('contextmenu', (e) => {
    // 如果不是书签项，关闭菜单
    if (!e.target.closest('.bookmark-item') && !e.target.closest('.nested-folder-header')) {
      hideContextMenu();
    }
  });

  // 菜单项点击
  document.querySelectorAll('.context-menu-item').forEach(item => {
    item.addEventListener('click', () => {
      if (!contextTarget) return;
      const action = item.dataset.action;
      handleContextAction(action, contextTarget);
      hideContextMenu();
    });
  });
}

async function handleContextAction(action, target) {
  switch (action) {
    case 'open':
      if (target.url) window.location.href = target.url;
      break;

    case 'open-new':
      if (target.url) window.open(target.url, '_blank');
      break;

    case 'edit':
      showEditDialog(target);
      break;

    case 'delete':
      if (confirm(`确定删除「${target.title || '未命名'}」吗？`)) {
        try {
          if (target.type === 'folder') {
            await writeBookmarkFromUI('removeTree', target.id);
          } else {
            await writeBookmarkFromUI('remove', target.id);
          }
          showToast('已删除');
          await loadBookmarks();
        } catch (err) {
          showToast('删除失败: ' + err.message);
        }
      }
      break;
  }
}

// ============================================
// 编辑书签弹窗 — 由 initEditDialog() 初始化事件绑定
// 复用 settings-overlay 遮罩层，通过 .visible 类控制显隐
// 保存时调用 writeBookmarkFromUI('update') 确保同步锁正确
// ============================================

let editTarget = null;

function initEditDialog() {
  const overlay = document.getElementById('edit-overlay');
  const closeBtn = document.getElementById('edit-close');
  const cancelBtn = document.getElementById('edit-cancel');
  const saveBtn = document.getElementById('edit-save');

  const close = () => {
    overlay.classList.remove('visible');
    setTimeout(() => overlay.classList.add('hidden'), 250);
    editTarget = null;
  };

  closeBtn.addEventListener('click', close);
  cancelBtn.addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  saveBtn.addEventListener('click', async () => {
    if (!editTarget) return;
    const newTitle = document.getElementById('edit-name').value.trim();
    const newUrl = document.getElementById('edit-url').value.trim();

    if (!newTitle) {
      showToast('标题不能为空');
      return;
    }

    try {
      const changes = { title: newTitle };
      if (editTarget.type === 'bookmark' && newUrl) {
        changes.url = newUrl;
      }
      await writeBookmarkFromUI('update', editTarget.id, changes);
      showToast('已保存');
      close();
      await loadBookmarks();
    } catch (err) {
      showToast('保存失败: ' + err.message);
    }
  });
}

function showEditDialog(target) {
  editTarget = target;
  const overlay = document.getElementById('edit-overlay');
  const titleEl = document.getElementById('edit-title');
  const nameInput = document.getElementById('edit-name');
  const urlInput = document.getElementById('edit-url');
  const urlGroup = document.getElementById('edit-url-group');

  titleEl.textContent = target.type === 'folder' ? '编辑文件夹' : '编辑书签';
  nameInput.value = target.title || '';

  if (target.type === 'folder') {
    urlGroup.style.display = 'none';
  } else {
    urlGroup.style.display = '';
    urlInput.value = target.url || '';
  }

  overlay.classList.remove('hidden');
  requestAnimationFrame(() => {
    overlay.classList.add('visible');
    nameInput.focus();
  });
}

// ============================================
// Toast 通知 — 底部居中浮层，duration 毫秒后自动消失
// 首次调用时动态创建 DOM，后续复用
// ============================================

function showToast(message, duration = 2000) {
  let toast = document.querySelector('.toast');
  if (!toast) {
    toast = createElement('div', { className: 'toast' });
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('visible');
  setTimeout(() => toast.classList.remove('visible'), duration);
}
