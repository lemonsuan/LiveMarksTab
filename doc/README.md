# LiveMarksTab 开发变更日志

> 本目录记录项目各阶段的修改详情、完成度和技术要点。

## 文档索引

| 文档 | 阶段 | 时间 | 状态 |
|------|------|------|------|
| [phase1-核心功能与UI美化.md](phase1-核心功能与UI美化.md) | Phase 1 + 1.5 | 2026-02-18 | ✅ 完成 |
| [phase2-功能优化.md](phase2-功能优化.md) | Phase 2 | 2026-02-18 | ✅ 完成 |
| [phase4-高级功能.md](phase4-高级功能.md) | Phase 4 | 2026-02-18 | ✅ 完成 |
| [phase5-ui-polishing.md](phase5-ui-polishing.md) | Phase 5 | 2026-02-18 | ✅ 完成 |
| [phase6-ui-restructure.md](phase6-ui-restructure.md) | Phase 6 | 2026-02-19 | ✅ 完成 |

## Git 提交历史

| 序号 | Hash | 提交说明 |
|------|------|---------|
| 1 | `c27e7b5` | Initial commit |
| 2 | `2f55773` | chore: 项目改名 LiveMarksTab + .gitignore 忽略 .agent/ |
| 3 | `56fd24e` | feat: 未分类书签置底显示 |
| 4 | `1d60c60` | feat: 悬浮工具栏(5按钮) + 深浅切换与背景联动 |
| 5 | `2875e01` | feat: 设置面板侧栏 Tab 布局 + 重置所有设置按钮 |
| 6 | `f4a2e2b` | feat: 拖拽排序 - 书签项与文件夹区块均可拖拽重排 |
| 7 | `43b10ca` | feat: 子文件夹改为网格卡片排列 |
| 8 | `a486379` | feat: 卡片模式改为瀑布流布局 |
| 9 | `bd9eaa0` | fix: 修复文件夹和书签拖拽排序 |
| 10 | `72a2acf` | feat: 书签右键生成二维码 |
| 11 | `ba65875` | fix: 用 qrcode-generator 库替换手写 QR 生成器 |
| 12 | `9ead5f7` | feat: 书签清理功能 — URL可访问性检测 + 批量删除 |
| 13 | `fad0ea3` | feat: 清理列表双击打开书签链接 |
| 14 | `589ef07` | feat: 书签清理面板大升级 |
| 15 | `e86b5f5` | docs: 更新 phase4 文档 |

## 项目当前状态

- **版本**：1.0.0
- **技术栈**：Chrome Extension Manifest V3 / 纯 HTML + CSS + JS
- **仓库**：https://github.com/lemonsuan/LiveMarksTab

## 功能概览

| 功能 | 说明 |
|------|------|
| 书签渲染 | 三种布局：行布局 / 卡片网格 / 侧边栏 |
| 搜索 | 输入即过滤 + 多引擎搜索 (Shift+Enter) |
| 拖拽排序 | 文件夹区块和书签项均可拖拽，同步到 Chrome |
| 右键菜单 | 打开、编辑、删除、生成二维码 |
| 书签清理 | 扫描 URL 可访问性，批量删除失效书签 |
| 深浅主题 | 一键切换 + 5 套配色方案 + 背景图设置 |
| 快速访问 | 书签栏前 8 个链接，大图标网格展示 |
| 问候语 | 根据时间段显示不同问候 |
| 精简工具栏 | 右下角 2 按钮（主题+设置），其余收纳进设置面板 |
| 模块化 CSS | 6 个 CSS 模块文件，易于维护 |
