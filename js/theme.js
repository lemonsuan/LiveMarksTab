/**
 * theme.js — 主题管理：深浅切换 + 配色方案 + 背景图
 *
 * 职责:
 *   - 管理 dark/light/auto 主题模式
 *   - 管理 5 套预设配色方案（每套含深色和浅色变体）
 *   - 管理背景图（内置渐变 / 网络链接 / 本地上传 base64）
 *   - 监听系统 prefers-color-scheme 变化（auto 模式）
 *
 * 存储 (chrome.storage.local):
 *   theme: 'auto' | 'light' | 'dark'       — 主题模式
 *   colorScheme: 'indigo' | 'emerald' | 'amber' | 'rose' | 'violet'
 *   bgType: 'none' | 'builtin' | 'url' | 'upload'
 *   bgValue: string  — 内置渐变名 / 网络URL / base64
 *
 * 机制:
 *   通过 <html data-theme="light|dark"> 切换主题
 *   通过 <html data-color="indigo|emerald|..."> 切换配色
 *   背景图通过 body 的 CSS background-image 设置
 */

// ---- 预设配色方案 ----
const COLOR_SCHEMES = [
  { id: 'indigo',  name: '靛蓝', accent: '#6366f1', accentHover: '#818cf8' },
  { id: 'emerald', name: '翠绿', accent: '#10b981', accentHover: '#34d399' },
  { id: 'amber',   name: '琥珀', accent: '#f59e0b', accentHover: '#fbbf24' },
  { id: 'rose',    name: '玫瑰', accent: '#f43f5e', accentHover: '#fb7185' },
  { id: 'violet',  name: '紫罗兰', accent: '#8b5cf6', accentHover: '#a78bfa' },
];

// ---- 内置背景 (纯CSS渐变，零网络请求) ----
const BUILTIN_BACKGROUNDS = [
  { id: 'aurora',  name: '极光',   css: 'linear-gradient(135deg, #0c1445 0%, #1a0a3e 25%, #2d1b69 50%, #0e4d64 75%, #0c1445 100%)' },
  { id: 'sunset',  name: '日落',   css: 'linear-gradient(135deg, #f97316 0%, #ec4899 50%, #8b5cf6 100%)' },
  { id: 'ocean',   name: '海洋',   css: 'linear-gradient(135deg, #0ea5e9 0%, #2563eb 50%, #7c3aed 100%)' },
  { id: 'forest',  name: '森林',   css: 'linear-gradient(135deg, #064e3b 0%, #065f46 33%, #047857 66%, #0d9488 100%)' },
  { id: 'minimal', name: '极简灰', css: 'linear-gradient(180deg, #e5e7eb 0%, #f9fafb 100%)' },
];

// ---- 系统主题变化监听器 ----
const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');

/**
 * 初始化主题系统（在 DOMContentLoaded 中最先调用）
 */
function initTheme() {
  chrome.storage.local.get(['theme', 'colorScheme', 'bgType', 'bgValue'], (data) => {
    const theme = data.theme || 'light';
    const color = data.colorScheme || 'indigo';
    const bgType = data.bgType || 'none';
    const bgValue = data.bgValue || '';

    applyTheme(theme);
    applyColorScheme(color);
    applyBackground(bgType, bgValue);
  });
}

/**
 * 设置主题模式
 * @param {'light'|'dark'} mode
 */
function setTheme(mode) {
  applyTheme(mode);
  chrome.storage.local.set({ theme: mode });
}

/**
 * 切换深浅模式（悬浮按钮使用）
 */
function toggleTheme() {
  const current = document.documentElement.dataset.theme;
  setTheme(current === 'dark' ? 'light' : 'dark');
}

/**
 * 应用主题 — 同时设置前景和默认背景色
 * 用户自定义背景（builtin/url/upload）优先于主题默认背景
 */
function applyTheme(mode) {
  document.documentElement.dataset.theme = mode;
}

/**
 * 设置配色方案
 * @param {string} colorId - 配色ID
 */
function setColorScheme(colorId) {
  applyColorScheme(colorId);
  chrome.storage.local.set({ colorScheme: colorId });
}

/**
 * 应用配色方案
 */
function applyColorScheme(colorId) {
  const scheme = COLOR_SCHEMES.find(c => c.id === colorId) || COLOR_SCHEMES[0];
  document.documentElement.dataset.color = scheme.id;
  // 动态设置 CSS 变量（对应每套配色）
  document.documentElement.style.setProperty('--accent', scheme.accent);
  document.documentElement.style.setProperty('--accent-hover', scheme.accentHover);
  // 浅底色使用带透明度
  const r = parseInt(scheme.accent.slice(1, 3), 16);
  const g = parseInt(scheme.accent.slice(3, 5), 16);
  const b = parseInt(scheme.accent.slice(5, 7), 16);
  document.documentElement.style.setProperty('--accent-subtle', `rgba(${r}, ${g}, ${b}, 0.10)`);
}

/**
 * 设置背景图
 * @param {'none'|'builtin'|'url'|'upload'} type
 * @param {string} value - 渐变名/URL/base64
 */
function setBgImage(type, value) {
  applyBackground(type, value);
  chrome.storage.local.set({ bgType: type, bgValue: value });
}

/**
 * 应用背景图
 */
function applyBackground(type, value) {
  const body = document.body;

  if (type === 'none' || !value) {
    body.style.backgroundImage = '';
    body.classList.remove('has-bg');
    return;
  }

  body.classList.add('has-bg');

  if (type === 'builtin') {
    const bg = BUILTIN_BACKGROUNDS.find(b => b.id === value);
    if (bg) {
      body.style.backgroundImage = bg.css;
      body.style.backgroundSize = 'cover';
      body.style.backgroundAttachment = 'fixed';
    }
  } else if (type === 'url' || type === 'upload') {
    body.style.backgroundImage = `url(${value})`;
    body.style.backgroundSize = 'cover';
    body.style.backgroundPosition = 'center';
    body.style.backgroundAttachment = 'fixed';
  }
}

/**
 * 清除背景图
 */
function clearBgImage() {
  setBgImage('none', '');
}
