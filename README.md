# 📑 书签导航 NewTab — Chrome 扩展

> 自定义 Chrome 新标签页，将浏览器书签自动渲染为可视化导航界面，支持双向实时同步。

---

## ✨ 功能一览

| 功能 | 说明 |
|------|------|
| **新标签页接管** | 每次 `Cmd/Ctrl+T` 自动展示自定义导航页 |
| **三种布局** | 分行（默认）/ 卡片网格 / 侧边栏，可在设置中切换 |
| **书签自动渲染** | 读取 Chrome 全量书签，一级文件夹 → 分类区块，嵌套文件夹可折叠 |
| **双向同步** | 导航页修改 ↔ Chrome 书签库实时同步，带 Sync Lock 防死循环 |
| **搜索** | 输入关键词实时过滤书签，回车跳转搜索引擎 |
| **多引擎切换** | Google / Bing / 百度 / DuckDuckGo / GitHub |
| **右键菜单** | 打开 / 新标签页打开 / 编辑 / 删除 |
| **编辑弹窗** | 修改书签标题和 URL |
| **设置面板** | 布局模式 + 搜索引擎偏好持久化 |

---

## 📂 项目结构

```
书签管理newtab/
│
├── manifest.json            # Chrome 扩展清单 (Manifest V3)
│                            #   - 声明权限: bookmarks, favicon, storage
│                            #   - 接管新标签页: chrome_url_overrides.newtab
│
├── newtab.html              # 新标签页主页面
│                            #   - 搜索栏区域 (固定高度)
│                            #   - 三种布局容器 (行/网格/侧边栏)
│                            #   - 右键菜单 / 编辑弹窗 / 设置浮层
│
├── css/
│   └── style.css            # 全局样式
│                            #   - CSS 变量 (设计令牌): 颜色/尺寸/过渡
│                            #   - 搜索栏样式
│                            #   - 三种布局的完整样式
│                            #   - 右键菜单 / 编辑弹窗 / Toast 样式
│                            #   - 入场动画 / Hover 微交互
│
├── js/
│   ├── app.js               # 入口脚本 (初始化顺序)
│   │                        #   1. 设置 → 2. 搜索 → 3. 右键菜单
│   │                        #   4. 编辑弹窗 → 5. 书签渲染 → 6. 同步监听
│   │
│   ├── bookmarks.js         # 核心模块: 书签读取 + 三种布局渲染
│   │                        #   - loadBookmarks(): 获取书签树
│   │                        #   - extractFoldersAndLinks(): 提取一级文件夹
│   │                        #   - renderRowsLayout(): 行布局 (默认)
│   │                        #   - renderGridLayout(): 卡片网格布局
│   │                        #   - renderSidebarLayout(): 侧边栏布局
│   │                        #   - 右键菜单 + 编辑弹窗 + Toast 逻辑
│   │
│   ├── search.js            # 搜索栏模块
│   │                        #   - SEARCH_ENGINES[]: 搜索引擎预设列表
│   │                        #   - initSearch(): 初始化及事件绑定
│   │                        #   - filterBookmarks(): 实时过滤
│   │                        #   - selectEngine(): 切换搜索引擎
│   │
│   ├── sync.js              # 双向同步模块
│   │                        #   - _syncLock: 同步锁 (防死循环)
│   │                        #   - writeBookmarkFromUI(): UI→Chrome 写操作封装
│   │                        #   - registerBookmarkListeners(): 5个变化监听器
│   │
│   ├── settings.js          # 设置面板模块
│   │                        #   - DEFAULT_SETTINGS: 默认配置
│   │                        #   - setLayout(): 三布局切换
│   │                        #   - loadSettings()/saveSettings(): 持久化
│   │
│   └── utils.js             # 工具函数
│                            #   - getFaviconUrl(): 获取网站图标
│                            #   - debounce(): 防抖
│                            #   - createElement(): DOM 创建辅助
│                            #   - createExpandIcon()/createFolderIcon(): SVG图标
│
└── icons/
    ├── icon16.png           # 扩展图标 16x16
    ├── icon48.png           # 扩展图标 48x48
    └── icon128.png          # 扩展图标 128x128
```

---

## 🚀 安装与使用

### 开发模式加载

1. 打开 Chrome，地址栏输入 `chrome://extensions/`
2. 右上角开启 **「开发者模式」**
3. 点击 **「加载已解压的扩展程序」**
4. 选择本项目目录（`书签管理newtab/`）
5. 打开新标签页 (`Cmd+T`) → 看到自定义导航页

### 更新扩展

修改代码后，在 `chrome://extensions/` 页面点击扩展卡片上的 **🔄 刷新按钮**，然后重新打开新标签页。

---

## 🏗️ 技术架构

### 核心数据流

```
Chrome 书签数据库
        │
        ├──读取──→ chrome.bookmarks.getTree()
        │              │
        │              ▼
        │         extractFoldersAndLinks()
        │         (根节点合并平铺, 提取一级文件夹)
        │              │
        │              ├──→ renderRowsLayout()    ← 行布局
        │              ├──→ renderGridLayout()     ← 卡片布局
        │              └──→ renderSidebarLayout()  ← 侧边栏布局
        │
        ├──监听──→ onCreated / onRemoved / onChanged / onMoved
        │              │
        │              ▼
        │         if (!_syncLock) loadBookmarks()
        │         (外部变更 → 重新渲染)
        │
        └──写入──← writeBookmarkFromUI(action, ...args)
                       │
                       ├── setSyncLock()     ← 加锁
                       ├── chrome.bookmarks[action]()
                       └── releaseSyncLock() ← 200ms后解锁
```

### 书签树映射规则

```
Chrome 原始结构:                    导航页展示:
─────────────────                  ─────────────
Root (id: "0")                     ┌─────────────────┐
├── 书签栏 (id: "1")     ──合并──→ │ 所有一级文件夹    │
│   ├── 工作 (文件夹)    ──────→   │ 做为独立分类区块   │
│   │   ├── GitHub.com  ──────→   │   └─ 书签链接项    │
│   │   └── 前端 (子文件夹) ───→   │      └─ 可折叠子组 │
│   └── 直接链接        ──────→   │ 归入「未分类」     │
├── 其他书签 (id: "2")   ──合并──→ │                   │
└── 移动书签 (id: "3")   ──合并──→ │                   │
                                   └─────────────────┘
```

### Sync Lock 防死循环机制

```
用户在导航页删除书签
    │
    ▼
writeBookmarkFromUI('remove', id)
    │
    ├── _syncLock = true          ← 加锁
    ├── chrome.bookmarks.remove() ← 执行API
    │       │
    │       └──触发──→ onRemoved 监听器
    │                      │
    │                      ▼
    │               if (_syncLock) return;  ← 被锁住,跳过
    │
    └── setTimeout(_syncLock=false, 200ms)  ← 解锁

外部(浏览器/手机同步)删除书签
    │
    └──触发──→ onRemoved 监听器
                   │
                   ▼
              _syncLock === false  ← 未锁
              loadBookmarks()     ← 正常刷新UI
```

---

## 🎨 三种布局说明

| 布局 | 模式 | 适用场景 |
|------|------|---------|
| **分行** (rows) | 每个顶级分类占一整行，链接水平网格排列，超36项折叠 | **默认布局**，书签量大时概览方便 |
| **卡片** (grid) | 每个分类一个卡片，自适应网格排列 | 书签分类不多时视觉美观 |
| **侧边栏** (sidebar) | 左侧分类导航列表 + 右侧内容详情 | 快速切换分类浏览 |

---

## ⚙️ 配置说明

设置项通过 `chrome.storage.local` 持久化：

| Key | 类型 | 默认值 | 说明 |
|-----|------|--------|------|
| `layout` | `string` | `'rows'` | 布局模式: `'rows'` / `'grid'` / `'sidebar'` |
| `searchEngine` | `string` | `'google'` | 搜索引擎 ID |

---

## 📌 扩展计划 (Phase 2)

- [ ] **元数据增强**: 为书签添加自定义属性（点击次数、置顶权重），存储在 `chrome.storage.local`
- [ ] **后端同步**: 预留 API 接口，加密同步至自建服务器，实现跨浏览器同步
- [ ] **拖拽排序**: 拖拽书签项调整顺序，同步回 Chrome
- [ ] **主题切换**: 亮色/暗色主题切换

---

## 📜 权限说明

| 权限 | 用途 |
|------|------|
| `bookmarks` | 读写 Chrome 书签数据 |
| `favicon` | 通过 `chrome://favicon2/` 获取网站图标 |
| `storage` | 存储用户偏好设置（布局、搜索引擎等） |

---

## 🛠️ 开发约定

- **纯原生 JS**，无框架依赖，确保极致秒开
- **脚本加载顺序**: `utils → search → bookmarks → sync → settings → app`（有依赖关系）
- **CSS 变量统一管理**: 修改主题色请编辑 `:root` 中的变量
- **命名规范**: 函数使用 `camelCase`，CSS 类使用 `kebab-case`，DOM ID 使用 `kebab-case`
