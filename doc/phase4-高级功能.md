# Phase 4：高级功能

> 完成时间：2026-02-18

## 4.1 卡片模式瀑布流布局

**文件**：`css/style.css`

- `#layout-grid` 从 `display: grid` 改为 `columns: 280px` CSS 瀑布流
- `.bookmark-card` 添加 `break-inside: avoid` + `margin-bottom: 20px`
- 卡片按内容高度自然堆叠，不再强制等高对齐

## 4.2 修复文件夹/书签拖拽排序

**文件**：`js/bookmarks.js`

- 恢复 `createRowSection` 中 `enableBookmarkDrag(grid, folder.id)` 调用（重构子文件夹入网格时误删）
- `enableBookmarkDrag` 的 `dragover` 添加 `if (!dragItem) return;` 空检查，防止干扰文件夹拖拽

## 4.3 右键生成二维码

**文件**：`newtab.html`, `js/bookmarks.js`, `js/qrcode.js`, `css/style.css`

- 右键菜单新增「生成二维码」选项（文件夹自动隐藏）
- 弹窗显示二维码图片（Canvas 绘制）+ 网址文本
- 「复制二维码」按钮：通过 `ClipboardItem` API 复制图片到剪贴板
- 「复制网址」按钮：复制 URL 文本
- 使用 [qrcode-generator](https://www.npmjs.com/package/qrcode-generator) 库（MIT, v1.4.4）

## 4.4 书签清理（URL 可访问性检测 + 批量删除）

**文件**：`manifest.json`, `js/cleaner.js`（新增）, `js/app.js`, `js/settings.js`, `newtab.html`, `css/style.css`

### 功能说明
- 悬浮工具栏新增「书签清理」按钮
- 点击后打开清理面板，一键扫描所有书签的 URL 可访问性
- 使用 `fetch(url, { method: 'HEAD' })` 检测，并发数限制 6，超时 8 秒
- 实时进度条 + 扫描计数
- 结果列表仅显示异常项（不可访问/超时），带状态标签
- 全选/取消全选 + 批量删除功能
- 删除后自动刷新书签列表

### 技术要点
- `manifest.json` 添加 `host_permissions: ["<all_urls>"]` 允许跨域 fetch
- 非 http(s) 协议（如 `chrome://`、`javascript:`）自动跳过
- HTTP 405/403 视为可访问（站点存在但限制 HEAD 请求）

## 4.5 清理面板大升级

**文件**：`js/cleaner.js`, `newtab.html`, `css/style.css`

### 新增功能
- **面板扩大**：宽度 520px → 720px，高度 88vh，`overflow: hidden` 防止溢出
- **实时统计卡片**：扫描中动态更新 总书签 / ✅正常 / ❌不可访问 / ⏱超时 四张卡片
- **状态筛选 Tab**：全部异常 / 不可访问 / 超时，带数量角标，点击切换结果视图
- **快捷选择按钮**：全选、取消全选、仅不可访问（联动切换到对应 Tab）、仅超时
- **结果列表双行**：书签标题（粗体）+ 完整 URL（小字灰色）
- **底部固定操作栏**：快捷选择 + 删除按钮固定在面板底部，不随列表滚动
- **双击打开**：双击结果列表任意行，在新标签页打开该 URL 供手动验证
- **空状态提示**：全部正常时显示 🎉 提示，无结果时隐藏操作栏
