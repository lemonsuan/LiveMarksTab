/**
 * settings.js — 设置面板逻辑
 *
 * 职责:
 *   - 管理设置面板的打开/关闭 + Tab 切换
 *   - 布局模式切换 (rows/grid/sidebar)
 *   - 外观设置：主题模式、配色方案、背景图
 *   - 搜索引擎偏好持久化
 *   - ESC 快捷键关闭所有弹窗
 *
 * 存储 (chrome.storage.local):
 *   layout: 'rows' | 'grid' | 'sidebar'
 *   searchEngine: 'google' | 'bing' | 'baidu' | 'duckduckgo' | 'github'
 *   theme: 'light' | 'dark'
 *   colorScheme: 'indigo' | 'emerald' | 'amber' | 'rose' | 'violet'
 *   bgType: 'none' | 'builtin' | 'url' | 'upload'
 *   bgValue: string
 *
 * 依赖:
 *   - search.js: SEARCH_ENGINES[], selectEngine()
 *   - theme.js: COLOR_SCHEMES[], BUILTIN_BACKGROUNDS[], setTheme(), setColorScheme(), setBgImage(), clearBgImage()
 *   - utils.js: createElement()
 */

// 默认设置
const DEFAULT_SETTINGS = {
  layout: 'rows',
  searchEngine: 'google',
  theme: 'light',
  colorScheme: 'indigo',
  bgType: 'none',
  bgValue: '',
};

/**
 * 初始化设置面板
 */
function initSettings() {
  const overlay = document.getElementById('settings-overlay');
  const closeBtn = document.getElementById('settings-close');

  // ---- 悬浮工具栏按钮绑定 ----
  // 设置按钮 → 打开设置面板
  document.getElementById('btn-settings').addEventListener('click', () => {
    overlay.classList.remove('hidden');
    requestAnimationFrame(() => {
      overlay.classList.add('visible');
    });
  });

  // 深浅切换
  document.getElementById('btn-theme-toggle').addEventListener('click', () => {
    toggleTheme();
  });

  // 密码管理
  document.getElementById('btn-passwords').addEventListener('click', () => {
    chrome.tabs.create({ url: 'chrome://password-manager/passwords' });
  });

  // 浏览历史
  document.getElementById('btn-history').addEventListener('click', () => {
    chrome.tabs.create({ url: 'chrome://history' });
  });

  // 扩展管理
  document.getElementById('btn-extensions').addEventListener('click', () => {
    chrome.tabs.create({ url: 'chrome://extensions' });
  });

  // 书签清理
  document.getElementById('btn-cleaner').addEventListener('click', () => {
    openCleanerPanel();
  });

  // 关闭设置
  const closeSettings = () => {
    overlay.classList.remove('visible');
    setTimeout(() => overlay.classList.add('hidden'), 250);
  };

  closeBtn.addEventListener('click', closeSettings);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeSettings();
  });

  // ESC 关闭设置和编辑弹窗
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeSettings();
      const editOverlay = document.getElementById('edit-overlay');
      if (editOverlay && editOverlay.classList.contains('visible')) {
        editOverlay.classList.remove('visible');
        setTimeout(() => editOverlay.classList.add('hidden'), 250);
      }
    }
  });

  // ---- 重置所有设置 ----
  document.getElementById('btn-reset-settings').addEventListener('click', () => {
    if (confirm('确定要重置所有设置吗？这将清除所有自定义配置并恢复默认值。')) {
      chrome.storage.local.clear(() => {
        location.reload();
      });
    }
  });

  // ---- Tab 切换 ----
  document.querySelectorAll('.settings-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.dataset.tab;
      // 切换 tab 按钮高亮
      document.querySelectorAll('.settings-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.tab === tabName);
      });
      // 切换 tab 内容
      document.querySelectorAll('.settings-tab-content').forEach(c => {
        c.classList.toggle('active', c.dataset.tab === tabName);
      });
    });
  });

  // ---- 布局切换 ----
  document.querySelectorAll('.layout-option').forEach(btn => {
    btn.addEventListener('click', () => {
      const layout = btn.dataset.layout;
      setLayout(layout);
      saveSettings({ layout });
      document.querySelectorAll('.layout-option').forEach(b => {
        b.classList.toggle('active', b.dataset.layout === layout);
      });
    });
  });

  // ---- 搜索引擎 ----
  const engineSelect = document.getElementById('setting-engine');
  SEARCH_ENGINES.forEach(engine => {
    const option = createElement('option', { value: engine.id }, engine.name);
    engineSelect.appendChild(option);
  });
  engineSelect.addEventListener('change', () => {
    selectEngine(engineSelect.value);
  });

  // (主题深浅切换已移至悬浮工具栏)

  // ---- 配色方案 ----
  const colorContainer = document.getElementById('color-options');
  COLOR_SCHEMES.forEach(scheme => {
    const dot = createElement('div', {
      className: 'color-dot' + (scheme.id === DEFAULT_SETTINGS.colorScheme ? ' active' : ''),
      title: scheme.name,
      dataset: { color: scheme.id },
    });
    dot.style.backgroundColor = scheme.accent;
    dot.addEventListener('click', () => {
      setColorScheme(scheme.id);
      document.querySelectorAll('.color-dot').forEach(d => {
        d.classList.toggle('active', d.dataset.color === scheme.id);
      });
    });
    colorContainer.appendChild(dot);
  });

  // ---- 背景图内置选项 ----
  const bgContainer = document.getElementById('bg-options');
  // "无背景" 选项
  const noneBg = createElement('div', {
    className: 'bg-option bg-option-none active',
    dataset: { bgType: 'none', bgValue: '' },
  });
  noneBg.textContent = '无';
  noneBg.addEventListener('click', () => {
    clearBgImage();
    updateBgOptionActive('none', '');
  });
  bgContainer.appendChild(noneBg);

  // 内置渐变背景
  BUILTIN_BACKGROUNDS.forEach(bg => {
    const option = createElement('div', {
      className: 'bg-option',
      title: bg.name,
      dataset: { bgType: 'builtin', bgValue: bg.id },
    });
    option.style.background = bg.css;
    option.addEventListener('click', () => {
      setBgImage('builtin', bg.id);
      updateBgOptionActive('builtin', bg.id);
    });
    bgContainer.appendChild(option);
  });

  // URL 输入应用
  document.getElementById('bg-url-apply').addEventListener('click', () => {
    const url = document.getElementById('bg-url-input').value.trim();
    if (url) {
      setBgImage('url', url);
      updateBgOptionActive('url', url);
    }
  });

  // 本地上传
  const uploadBtn = document.getElementById('bg-upload-btn');
  const fileInput = document.getElementById('bg-file-input');
  uploadBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    // 限制 4MB
    if (file.size > 4 * 1024 * 1024) {
      showToast('图片不能超过 4MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = ev.target.result;
      setBgImage('upload', base64);
      updateBgOptionActive('upload', '');
    };
    reader.readAsDataURL(file);
  });

  // 加载已保存的设置
  loadSettings();
}

/**
 * 更新背景选项的 active 状态
 */
function updateBgOptionActive(type, value) {
  document.querySelectorAll('.bg-option').forEach(opt => {
    if (type === 'none') {
      opt.classList.toggle('active', opt.dataset.bgType === 'none');
    } else if (type === 'builtin') {
      opt.classList.toggle('active', opt.dataset.bgType === 'builtin' && opt.dataset.bgValue === value);
    } else {
      // url 或 upload 模式，所有内置选项都不高亮
      opt.classList.remove('active');
    }
  });
}

/**
 * 加载设置
 */
function loadSettings() {
  chrome.storage.local.get(
    ['layout', 'searchEngine', 'theme', 'colorScheme', 'bgType', 'bgValue'],
    (data) => {
      const layout = data.layout || DEFAULT_SETTINGS.layout;
      const engineId = data.searchEngine || DEFAULT_SETTINGS.searchEngine;
      const theme = data.theme || DEFAULT_SETTINGS.theme;
      const colorScheme = data.colorScheme || DEFAULT_SETTINGS.colorScheme;
      const bgType = data.bgType || DEFAULT_SETTINGS.bgType;
      const bgValue = data.bgValue || DEFAULT_SETTINGS.bgValue;

      // 布局
      setLayout(layout);
      document.querySelectorAll('.layout-option').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.layout === layout);
      });

      // 搜索引擎
      document.getElementById('setting-engine').value = engineId;

      // 多引擎勾选列表
      renderMultiEngineList();

      // (主题切换由悬浮栏控制，无需更新设置面板 UI)

      // 配色
      document.querySelectorAll('.color-dot').forEach(d => {
        d.classList.toggle('active', d.dataset.color === colorScheme);
      });

      // 背景
      updateBgOptionActive(bgType, bgValue);
      if (bgType === 'url' && bgValue) {
        document.getElementById('bg-url-input').value = bgValue;
      }
    }
  );
}

/**
 * 保存设置
 */
function saveSettings(partialSettings) {
  chrome.storage.local.set(partialSettings);
}

/**
 * 切换布局显示
 */
function setLayout(layout) {
  const rowsEl = document.getElementById('layout-rows');
  const gridEl = document.getElementById('layout-grid');
  const sidebarEl = document.getElementById('layout-sidebar');

  [rowsEl, gridEl, sidebarEl].forEach(el => {
    el.classList.remove('active');
    el.classList.add('hidden');
  });

  const targetEl = layout === 'sidebar' ? sidebarEl : layout === 'grid' ? gridEl : rowsEl;
  targetEl.classList.remove('hidden');
  targetEl.classList.add('active');
}

/**
 * 渲染多引擎搜索勾选列表
 */
function renderMultiEngineList() {
  const container = document.getElementById('multi-engine-list');
  if (!container) return;
  container.innerHTML = '';

  const selectedIds = getMultiEngineIds();

  SEARCH_ENGINES.forEach(engine => {
    const label = createElement('label', { className: 'multi-engine-item' });

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = selectedIds.includes(engine.id);
    checkbox.addEventListener('change', () => {
      toggleMultiEngine(engine.id, checkbox.checked);
    });

    const icon = createElement('img', {
      src: engine.icon,
      alt: engine.name,
      className: 'multi-engine-icon',
    });

    const name = document.createTextNode(engine.name);

    label.appendChild(checkbox);
    label.appendChild(icon);
    label.appendChild(name);
    container.appendChild(label);
  });
}
