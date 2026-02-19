/**
 * settings.js — 设置面板逻辑
 *
 * 职责:
 *   - 管理设置面板的打开/关闭 + Tab 切换
 *   - 布局模式切换 (rows/grid/sidebar)
 *   - 外观设置：主题模式、配色方案、背景图
 *   - 搜索引擎偏好持久化
 *   - 快捷入口 Tab (密码管理/浏览历史/扩展管理/书签清理)
 *   - ESC 快捷键关闭所有弹窗
 */

// 默认设置
const DEFAULT_SETTINGS = {
  layout: "rows",
  searchEngine: "google",
  theme: "light",
  colorScheme: "blue",
  bgType: "none",
  bgValue: "",
};

// 快捷入口列表
const SHORTCUTS = [
  {
    id: "passwords",
    name: "密码管理",
    url: "chrome://password-manager/passwords",
    icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
  },
  {
    id: "history",
    name: "浏览历史",
    url: "chrome://history",
    icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
  },
  {
    id: "extensions",
    name: "扩展管理",
    url: "chrome://extensions",
    icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>',
  },
  {
    id: "cleaner",
    name: "书签清理",
    url: "__cleaner__",
    icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 2l.27 1.63A7 7 0 0 0 5.16 7H3v2h1.29a7 7 0 0 0 0 6H3v2h2.16a7 7 0 0 0 4.11 3.37L9 22h6l-.27-1.63A7 7 0 0 0 18.84 17H21v-2h-1.29a7 7 0 0 0 0-6H21V7h-2.16a7 7 0 0 0-4.11-3.37L15 2H9z"/><circle cx="12" cy="12" r="3"/></svg>',
  },
];

/**
 * 初始化设置面板
 */
function initSettings() {
  const overlay = document.getElementById("settings-overlay");
  const closeBtn = document.getElementById("settings-close");

  // ---- 工具栏按钮绑定 ----
  document.getElementById("btn-settings").addEventListener("click", () => {
    overlay.classList.remove("hidden");
    requestAnimationFrame(() => {
      overlay.classList.add("visible");
    });
  });

  // 深浅切换
  document.getElementById("btn-theme-toggle").addEventListener("click", () => {
    toggleTheme();
  });

  // Chrome 快捷入口按钮
  document.getElementById("btn-passwords").addEventListener("click", () => {
    chrome.tabs.create({ url: "chrome://password-manager/passwords" });
  });
  document.getElementById("btn-history").addEventListener("click", () => {
    chrome.tabs.create({ url: "chrome://history" });
  });
  document.getElementById("btn-extensions").addEventListener("click", () => {
    chrome.tabs.create({ url: "chrome://extensions" });
  });
  document.getElementById("btn-cleaner").addEventListener("click", () => {
    openCleanerPanel();
  });

  // 关闭设置
  const closeSettings = () => {
    overlay.classList.remove("visible");
    setTimeout(() => overlay.classList.add("hidden"), 250);
  };

  closeBtn.addEventListener("click", closeSettings);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeSettings();
  });

  // ESC 关闭设置和编辑弹窗
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeSettings();
      const editOverlay = document.getElementById("edit-overlay");
      if (editOverlay && editOverlay.classList.contains("visible")) {
        editOverlay.classList.remove("visible");
        setTimeout(() => editOverlay.classList.add("hidden"), 250);
      }
    }
  });

  // ---- 重置所有设置 ----
  document
    .getElementById("btn-reset-settings")
    .addEventListener("click", () => {
      if (
        confirm("确定要重置所有设置吗？这将清除所有自定义配置并恢复默认值。")
      ) {
        chrome.storage.local.clear(() => {
          location.reload();
        });
      }
    });

  // ---- Tab 切换 ----
  document.querySelectorAll(".settings-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      const tabName = tab.dataset.tab;
      document.querySelectorAll(".settings-tab").forEach((t) => {
        t.classList.toggle("active", t.dataset.tab === tabName);
      });
      document.querySelectorAll(".settings-tab-content").forEach((c) => {
        c.classList.toggle("active", c.dataset.tab === tabName);
      });
    });
  });

  // ---- 布局切换 ----
  document.querySelectorAll(".layout-option").forEach((btn) => {
    btn.addEventListener("click", () => {
      const layout = btn.dataset.layout;
      setLayout(layout);
      saveSettings({ layout });
      document.querySelectorAll(".layout-option").forEach((b) => {
        b.classList.toggle("active", b.dataset.layout === layout);
      });
    });
  });

  // ---- 搜索引擎 ----
  const engineSelect = document.getElementById("setting-engine");
  SEARCH_ENGINES.forEach((engine) => {
    const option = createElement("option", { value: engine.id }, engine.name);
    engineSelect.appendChild(option);
  });
  engineSelect.addEventListener("change", () => {
    selectEngine(engineSelect.value);
  });

  // ---- 配色方案 ----
  const colorContainer = document.getElementById("color-options");
  COLOR_SCHEMES.forEach((scheme) => {
    const dot = createElement("div", {
      className:
        "color-dot" +
        (scheme.id === DEFAULT_SETTINGS.colorScheme ? " active" : ""),
      title: scheme.name,
      dataset: { color: scheme.id },
    });
    dot.style.backgroundColor = scheme.accent;
    dot.addEventListener("click", () => {
      setColorScheme(scheme.id);
      document.querySelectorAll(".color-dot").forEach((d) => {
        d.classList.toggle("active", d.dataset.color === scheme.id);
      });
    });
    colorContainer.appendChild(dot);
  });

  // ---- 背景图内置选项 ----
  const bgContainer = document.getElementById("bg-options");
  // "无背景" 选项
  const noneBg = createElement("div", {
    className: "bg-option bg-option-none active",
    dataset: { bgType: "none", bgValue: "" },
  });
  noneBg.textContent = "无";
  noneBg.addEventListener("click", () => {
    clearBgImage();
    updateBgOptionActive("none", "");
  });
  bgContainer.appendChild(noneBg);

  // 内置渐变背景
  BUILTIN_BACKGROUNDS.forEach((bg) => {
    const option = createElement("div", {
      className: "bg-option",
      title: bg.name,
      dataset: { bgType: "builtin", bgValue: bg.id },
    });
    option.style.background = bg.css;
    option.addEventListener("click", () => {
      setBgImage("builtin", bg.id);
      updateBgOptionActive("builtin", bg.id);
    });
    bgContainer.appendChild(option);
  });

  // URL 输入应用
  document.getElementById("bg-url-apply").addEventListener("click", () => {
    const url = document.getElementById("bg-url-input").value.trim();
    if (url) {
      setBgImage("url", url);
      updateBgOptionActive("url", url);
    }
  });

  // 本地上传
  const uploadBtn = document.getElementById("bg-upload-btn");
  const fileInput = document.getElementById("bg-file-input");
  uploadBtn.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      showToast("图片不能超过 4MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = ev.target.result;
      setBgImage("upload", base64);
      updateBgOptionActive("upload", "");
    };
    reader.readAsDataURL(file);
  });

  // ---- 快捷入口 Tab ----
  renderShortcuts();

  // ---- 数据导出/导入 ----
  initDataSync();

  // 加载已保存的设置
  loadSettings();
}

/**
 * 渲染快捷入口
 */
function renderShortcuts() {
  const grid = document.getElementById("shortcut-grid");
  if (!grid) return;
  grid.innerHTML = "";

  SHORTCUTS.forEach((shortcut) => {
    const item = createElement("div", {
      className: "shortcut-item",
      onClick: () => {
        if (shortcut.url === "__cleaner__") {
          // 关闭设置面板，打开清理面板
          const settingsOverlay = document.getElementById("settings-overlay");
          settingsOverlay.classList.remove("visible");
          setTimeout(() => {
            settingsOverlay.classList.add("hidden");
            openCleanerPanel();
          }, 250);
        } else {
          chrome.tabs.create({ url: shortcut.url });
        }
      },
    });
    item.innerHTML = shortcut.icon + "<span>" + shortcut.name + "</span>";
    grid.appendChild(item);
  });
}

/**
 * 更新背景选项的 active 状态
 */
function updateBgOptionActive(type, value) {
  document.querySelectorAll(".bg-option").forEach((opt) => {
    if (type === "none") {
      opt.classList.toggle("active", opt.dataset.bgType === "none");
    } else if (type === "builtin") {
      opt.classList.toggle(
        "active",
        opt.dataset.bgType === "builtin" && opt.dataset.bgValue === value,
      );
    } else {
      opt.classList.remove("active");
    }
  });
}

/**
 * 加载设置
 */
function loadSettings() {
  chrome.storage.local.get(
    ["layout", "searchEngine", "theme", "colorScheme", "bgType", "bgValue"],
    (data) => {
      const layout = data.layout || DEFAULT_SETTINGS.layout;
      const engineId = data.searchEngine || DEFAULT_SETTINGS.searchEngine;
      const colorScheme = data.colorScheme || DEFAULT_SETTINGS.colorScheme;
      const bgType = data.bgType || DEFAULT_SETTINGS.bgType;
      const bgValue = data.bgValue || DEFAULT_SETTINGS.bgValue;

      // 布局
      setLayout(layout);
      document.querySelectorAll(".layout-option").forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.layout === layout);
      });

      // 搜索引擎
      document.getElementById("setting-engine").value = engineId;

      // 多引擎勾选列表
      renderMultiEngineList();

      // 配色
      document.querySelectorAll(".color-dot").forEach((d) => {
        d.classList.toggle("active", d.dataset.color === colorScheme);
      });

      // 背景
      updateBgOptionActive(bgType, bgValue);
      if (bgType === "url" && bgValue) {
        document.getElementById("bg-url-input").value = bgValue;
      }
    },
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
  const rowsEl = document.getElementById("layout-rows");
  const gridEl = document.getElementById("layout-grid");
  const sidebarEl = document.getElementById("layout-sidebar");

  [rowsEl, gridEl, sidebarEl].forEach((el) => {
    el.classList.remove("active");
    el.classList.add("hidden");
  });

  const targetEl =
    layout === "sidebar" ? sidebarEl : layout === "grid" ? gridEl : rowsEl;
  targetEl.classList.remove("hidden");
  targetEl.classList.add("active");
}

/**
 * 渲染多引擎搜索勾选列表
 */
function renderMultiEngineList() {
  const container = document.getElementById("multi-engine-list");
  if (!container) return;
  container.innerHTML = "";

  const selectedIds = getMultiEngineIds();

  SEARCH_ENGINES.forEach((engine) => {
    const label = createElement("label", { className: "multi-engine-item" });

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = selectedIds.includes(engine.id);
    checkbox.addEventListener("change", () => {
      toggleMultiEngine(engine.id, checkbox.checked);
    });

    const icon = createElement("img", {
      src: engine.icon,
      alt: engine.name,
      className: "multi-engine-icon",
    });

    const name = document.createTextNode(engine.name);

    label.appendChild(checkbox);
    label.appendChild(icon);
    label.appendChild(name);
    container.appendChild(label);
  });
}

// ============================================
// 数据导出/导入
// ============================================

/**
 * 初始化导出/导入功能
 */
function initDataSync() {
  // 导出设置
  document.getElementById("btn-export-settings").addEventListener("click", () => {
    chrome.storage.local.get(null, (data) => {
      const exportData = {
        _meta: {
          app: "LiveMarksTab",
          version: "1.0.0",
          exportedAt: new Date().toISOString(),
          type: "settings",
        },
        settings: data,
      };
      downloadJSON(exportData, `livemarks-settings-${formatDate()}.json`);
      showToast("设置已导出");
    });
  });

  // 导入设置
  const importInput = document.getElementById("import-file-input");
  document.getElementById("btn-import-settings").addEventListener("click", () => {
    importInput.click();
  });

  importInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);

        // 验证格式
        if (!data._meta || data._meta.app !== "LiveMarksTab") {
          showToast("无效的设置文件");
          return;
        }

        if (data._meta.type === "settings" && data.settings) {
          chrome.storage.local.set(data.settings, () => {
            showToast("设置已导入，正在刷新...");
            setTimeout(() => location.reload(), 800);
          });
        } else {
          showToast("不支持的文件类型");
        }
      } catch {
        showToast("文件解析失败，请检查格式");
      }
    };
    reader.readAsText(file);
    importInput.value = ""; // 重置，允许再次选择同一文件
  });

  // 导出书签
  document.getElementById("btn-export-bookmarks").addEventListener("click", async () => {
    try {
      const tree = await chrome.bookmarks.getTree();
      const exportData = {
        _meta: {
          app: "LiveMarksTab",
          version: "1.0.0",
          exportedAt: new Date().toISOString(),
          type: "bookmarks",
        },
        bookmarks: tree,
      };
      downloadJSON(exportData, `livemarks-bookmarks-${formatDate()}.json`);
      showToast("书签已导出");
    } catch (err) {
      showToast("导出失败: " + err.message);
    }
  });
}

/**
 * 下载 JSON 文件
 */
function downloadJSON(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * 格式化日期为 YYYYMMDD
 */
function formatDate() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
}
