# Phase 6: UI 重构 — 页面结构 + 模块化 CSS

> **日期**: 2026-02-19
> **分支**: `refactor/page-structure`
> **状态**: ✅ 完成

## 重构概览

本次重构对 LiveMarksTab 的整体页面结构和 CSS 架构进行了全面改造。

### 核心变更

| 维度 | 改造前 | 改造后 |
|------|--------|--------|
| CSS 架构 | `style.css` 单文件 2021 行 | 6 个模块文件：variables/base/search/bookmarks/overlay/toolbar |
| 页面布局 | sticky header 搜索栏 (160px) | Hero 居中搜索区 + 问候语 |
| 工具栏 | 右侧 6 个悬浮按钮 | 右下角 2 个按钮（主题+设置），其余收纳入设置面板 |
| 设计令牌 | 6 档圆角 / 4 档阴影 / 3 种动画 | 3 档圆角 / 2 档阴影 / 2 种动画 |
| 字体 | Merriweather + Nunito (外部引入) | 系统字体栈 (零网络请求) |
| 配色方案 | 5 套 (indigo/emerald/amber/rose/violet) | 5 套 (blue/emerald/amber/rose/violet)，默认改为蔚蓝 |

### 新增功能

| 功能 | 说明 |
|------|------|
| 问候语 | 根据时间段显示不同问候 (早上好/下午好/晚上好) |
| 快速访问 | 书签栏前 8 个直接链接，大图标网格展示 |
| 快捷入口 Tab | 设置面板新增 Tab，收纳密码管理/浏览历史/扩展管理/书签清理 |

### CSS 模块划分

```
css/
  variables.css   — 设计令牌 + 深色主题覆盖
  base.css        — 全局重置 + 排版 + 动画 + Toast
  search.css      — Hero 搜索区 + 快速访问网格
  bookmarks.css   — 书签组件 + 三种布局 + 拖拽反馈
  overlay.css     — 设置面板 + 编辑弹窗 + 右键菜单 + 二维码 + 清理面板
  toolbar.css     — 精简悬浮工具栏 (2 按钮)
```

### 三种布局优化

| 布局 | 优化点 |
|------|--------|
| 卡片网格 | CSS columns 瀑布流 → CSS Grid (auto-fill, minmax 260px)，align-items: start |
| 侧边栏 | 透明背景 → 实色卡片，双列 → 单列，固定高度 → min/max-height 自适应 |
| 行布局 | row-header 增加分隔线，展开更多改为文字链接风格 |

### Git 提交记录

| Hash | 提交说明 |
|------|----------|
| `e1d0210` | refactor: 页面结构重构 + CSS 拆分为6模块 |
| `e69645e` | fix: 优化三种布局细节 |
