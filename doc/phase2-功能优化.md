# Phase 2：功能优化

> **提交范围**：`2f55773` → `f4a2e2b`（共 5 次提交）  
> **日期**：2026-02-18  
> **完成度**：✅ 100%

---

## Commit 1：项目改名 + gitignore

> `2f55773` chore: 项目改名 LiveMarksTab + .gitignore 忽略 .agent/

### 修改内容

| 文件 | 变更 |
|------|------|
| `manifest.json` | `name` → "LiveMarksTab"，`description` 更新简介 |
| `.gitignore` | 添加 `.agent/` 目录 |
| `README.md` | 全面重写，项目名更新，功能说明精简 |

### 完成度：✅ 100%

---

## Commit 2：未分类书签置底

> `56fd24e` feat: 未分类书签置底显示

### 修改内容

| 文件 | 变更 |
|------|------|
| `bookmarks.js` | `allFolders.unshift()` → `allFolders.push()`，未分类从顶部移到底部 |

### 设计原因
用户期望常用文件夹排在前面，未分类（散落链接）属于低优先级内容，放底部更合理。

### 完成度：✅ 100%

---

## Commit 3：悬浮工具栏 + 深浅切换联动

> `1d60c60` feat: 悬浮工具栏(5按钮) + 深浅切换与背景联动

### 修改内容

| 文件 | 变更 |
|------|------|
| `newtab.html` | 新增 `.float-toolbar` 结构（5 个按钮），移除设置面板中的主题三选 |
| `style.css` | 新增 `.float-toolbar` / `.float-btn` 样式（右侧居中垂直排列） |
| `settings.js` | 绑定 5 个悬浮按钮事件，移除旧主题切换代码 |
| `theme.js` | 新增 `toggleTheme()` 函数，移除 `auto` 模式,联动默认背景色 |

### 五个按钮功能

| 按钮 | 功能 |
|------|------|
| 🌓 深浅切换 | `toggleTheme()` light ↔ dark |
| 🔑 密码管理 | 跳转 `chrome://password-manager/passwords` |
| 📜 浏览历史 | 跳转 `chrome://history` |
| 🧩 扩展管理 | 跳转 `chrome://extensions` |
| ⚙️ 设置 | 打开设置面板 |

### 深浅/背景联动逻辑
- 切换深浅模式时自动设置对应的默认背景色
- 用户自定义背景（内置图片/URL/上传）优先级高于主题默认背景

### 完成度：✅ 100%

---

## Commit 4：设置面板侧栏 Tab + 重置按钮

> `2875e01` feat: 设置面板侧栏 Tab 布局 + 重置所有设置按钮

### 修改内容

| 文件 | 变更 |
|------|------|
| `newtab.html` | Tab 从 `.settings-tabs`（顶栏）改为 `.settings-sidebar`（左侧栏），新增重置按钮 |
| `style.css` | 新增 `.settings-layout` / `.settings-sidebar` / `.settings-content` 样式，面板宽度 440→560px |
| `settings.js` | 新增重置按钮事件：`chrome.storage.local.clear()` + `location.reload()` |

### 布局变化

```
 修改前（顶栏 Tab）        修改后（侧栏 Tab）
┌────────────────┐      ┌───┬────────────┐
│ 外观 │ 布局 │ 搜索 │      │外 │            │
├────────────────┤      │观 │  内容区域   │
│                │      │布 │            │
│    内容区域    │      │局 │            │
│                │      │搜 │            │
│                │      │索 │            │
└────────────────┘      │   │            │
                        │重 │            │
                        │置 │            │
                        └───┴────────────┘
```

### 完成度：✅ 100%

---

## Commit 5：拖拽排序（书签 + 文件夹）

> `f4a2e2b` feat: 拖拽排序 - 书签项与文件夹区块均可拖拽重排

### 修改内容

| 文件 | 变更 |
|------|------|
| `bookmarks.js` | 新增 `enableBookmarkDrag()` / `enableFolderDrag()` 函数，书签添加 `draggable=true` |
| `style.css` | 新增 `.dragging` 拖拽视觉反馈样式 |

### 拖拽功能详情

| 对象 | 拖拽方式 | Chrome 同步 |
|------|---------|-------------|
| 书签项 | 网格内自由拖拽 | `chrome.bookmarks.move(id, { parentId, index })` |
| 文件夹区块 | header 作为拖柄 | `chrome.bookmarks.move(id, { parentId, index })` |
| 未分类 | ❌ 禁止拖拽 | 虚拟文件夹，始终置底 |

### 视觉反馈
- 书签拖拽中：`opacity: 0.35`
- 文件夹拖拽中：`opacity: 0.4` + `outline: 2px dashed` 虚线轮廓

### 完成度：✅ 100%

---

## 整体总结

Phase 2 共 **5 次提交**，涵盖项目规范化、UI 交互优化和功能增强，全部 100% 完成并推送至 GitHub。
