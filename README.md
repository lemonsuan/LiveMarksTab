# 📑 LiveMarksTab — Chrome 新标签页书签导航

> 自定义 Chrome 新标签页，将浏览器书签自动渲染为可视化导航界面，支持双向实时同步。

---

## ✨ 功能一览

### 核心功能
- **新标签页接管**：每次 `Cmd/Ctrl+T` 自动展示自定义导航页
- **书签自动渲染**：读取 Chrome 全量书签，一级文件夹 → 分类区块
- **双向同步**：导航页修改 ↔ Chrome 书签库实时同步，带 Sync Lock 防死循环
- **三种布局**：
  - **分行布局**：经典列表视图
  - **卡片瀑布流**：美观的 masonry 布局，子文件夹以网格卡片展开
  - **侧边栏布局**：高效垂直导航
- **拖拽排序**：支持文件夹区块和书签项的自由拖拽，实时同步顺序

### 增强体验
- **深浅模式**：一键切换，联动背景色，支持自定义背景图（渐变/网络/本地）
- **悬浮工具栏**：快速访问深浅切换、密码管理、浏览历史、扩展管理、设置
- **多引擎搜索**：
  - 实时过滤书签（支持标题/URL）
  - **Shift+Enter**：同时打开选中的多个搜索引擎
  - 支持 Google / Bing / 百度 / DuckDuckGo / GitHub 等
- **右键菜单**：打开、编辑、删除、**生成二维码**（支持复制图片/URL）
- **书签清理**：一键扫描所有 URL 可访问性，支持批量筛选（不可访问/超时）并删除

---

## 📂 项目结构

```
LiveMarksTab/
│
├── manifest.json            # Chrome 扩展清单 (Manifest V3)
├── newtab.html              # 新标签页主页面
│
├── css/
│   └── style.css            # 全局样式 (CSS 变量 + 主题 + 布局 + 清理面板)
│
├── js/
│   ├── app.js               # 入口 (初始化顺序)
│   ├── bookmarks.js         # 书签读取 + param渲染 + 拖拽排序
│   ├── cleaner.js           # 书签清理 (并发扫描 + 批量删除) [新增]
│   ├── qrcode.js            # 二维码生成库 (qrcode-generator) [新增]
│   ├── search.js            # 搜索栏 + 多引擎切换 + 实时过滤
│   ├── settings.js          # 设置面板 + 持久化
│   ├── sync.js              # 双向同步 + Sync Lock
│   ├── theme.js             # 主题管理 (深浅/配色/背景)
│   └── utils.js             # 工具函数
│
├── icons/                   # 扩展图标
└── doc/                     # 开发文档与变更日志
```

---

## 🚀 安装与使用

1. 打开 Chrome → `chrome://extensions/`
2. 开启右上角 **开发者模式**
3. 点击 **加载已解压的扩展程序** → 选择本项目目录 `LiveMarksTab`
4. 打开新标签页 (`Cmd/Ctrl+T`) → 即可看到自定义导航页

**开发调试**：修改代码后，请在扩展页面点击 🔄 刷新按钮，并刷新新标签页。

---

## 📜 权限说明

| 权限 | 用途 |
|------|------|
| `bookmarks` | 读写 Chrome 书签数据，实现双向同步 |
| `favicon` | 获取网站图标 (`chrome://favicon`) |
| `storage` | 存储用户偏好设置（布局、主题、搜索引擎偏好） |
| `host_permissions` | `<all_urls>`：用于书签清理功能的 URL 可访问性检测 (`fetch HEAD`) |

---

## 🛠️ 技术栈

- **Manifest**：Chrome Extension V3
- **Core**：纯原生 JS (ES6+)，无框架依赖，追求极致秒开
- **CSS**：CSS Variables (主题系统) + Flexbox/Grid/Columns (布局)
- **Libs**：`qrcode-generator` (用于二维码生成)

---

## 📝 开发日志

详细变更记录请查看 [doc/README.md](doc/README.md)。

- **Phase 1**: 核心功能 + UI 美化
- **Phase 2**: 拖拽排序 + 悬浮工具栏 + 设置优化
- **Phase 3**: 多引擎搜索
- **Phase 4**: 瀑布流布局 + 二维码 + 书签清理
