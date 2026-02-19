/**
 * theme.js — 主题管理：深浅切换 + 配色方案 + 背景图
 *
 * 存储 (chrome.storage.local):
 *   theme: 'light' | 'dark'
 *   colorScheme: 'blue' | 'emerald' | 'amber' | 'rose' | 'violet'
 *   bgType: 'none' | 'builtin' | 'url' | 'upload'
 *   bgValue: string
 */

// ---- 预设配色方案 ----
const COLOR_SCHEMES = [
  { id: 'blue',    name: '蔚蓝',   accent: '#339af0', accentHover: '#228be6' },
  { id: 'emerald', name: '翠绿',   accent: '#20c997', accentHover: '#12b886' },
  { id: 'amber',   name: '琥珀',   accent: '#f59f00', accentHover: '#f08c00' },
  { id: 'rose',    name: '玫瑰',   accent: '#f03e3e', accentHover: '#e03131' },
  { id: 'violet',  name: '紫罗兰', accent: '#7950f2', accentHover: '#7048e8' },
];

// ---- 内置背景 (纯CSS渐变) ----
const BUILTIN_BACKGROUNDS = [
  { id: 'aurora',  name: '极光',   css: 'linear-gradient(135deg, #0c1445 0%, #1a0a3e 25%, #2d1b69 50%, #0e4d64 75%, #0c1445 100%)' },
  { id: 'sunset',  name: '日落',   css: 'linear-gradient(135deg, #f97316 0%, #ec4899 50%, #8b5cf6 100%)' },
  { id: 'ocean',   name: '海洋',   css: 'linear-gradient(135deg, #0ea5e9 0%, #2563eb 50%, #7c3aed 100%)' },
  { id: 'forest',  name: '森林',   css: 'linear-gradient(135deg, #064e3b 0%, #065f46 33%, #047857 66%, #0d9488 100%)' },
  { id: 'minimal', name: '极简',   css: 'linear-gradient(180deg, #e5e7eb 0%, #f9fafb 100%)' },
];

/**
 * 初始化主题系统
 */
function initTheme() {
  chrome.storage.local.get(['theme', 'colorScheme', 'bgType', 'bgValue'], (data) => {
    const theme = data.theme || 'light';
    const color = data.colorScheme || 'blue';
    const bgType = data.bgType || 'none';
    const bgValue = data.bgValue || '';

    applyTheme(theme);
    applyColorScheme(color);
    applyBackground(bgType, bgValue);
  });
}

/**
 * 设置主题模式
 */
function setTheme(mode) {
  applyTheme(mode);
  chrome.storage.local.set({ theme: mode });
}

/**
 * 切换深浅模式
 */
function toggleTheme() {
  const current = document.documentElement.dataset.theme;
  setTheme(current === 'dark' ? 'light' : 'dark');
}

/**
 * 应用主题
 */
function applyTheme(mode) {
  document.documentElement.dataset.theme = mode;
}

/**
 * 设置配色方案
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
  document.documentElement.style.setProperty('--accent', scheme.accent);
  document.documentElement.style.setProperty('--accent-hover', scheme.accentHover);
  // 浅底色带透明度
  const r = parseInt(scheme.accent.slice(1, 3), 16);
  const g = parseInt(scheme.accent.slice(3, 5), 16);
  const b = parseInt(scheme.accent.slice(5, 7), 16);
  document.documentElement.style.setProperty('--accent-subtle', `rgba(${r}, ${g}, ${b}, 0.10)`);
  document.documentElement.style.setProperty('--accent-glow', `rgba(${r}, ${g}, ${b}, 0.3)`);
}

/**
 * 设置背景图
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
