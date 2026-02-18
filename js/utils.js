/**
 * utils.js — 工具函数
 */

/**
 * 获取书签网站的 favicon URL
 * 使用 Chrome 扩展的 _favicon API (MV3)
 * @param {string} url - 网站 URL
 * @param {number} size - 图标尺寸，默认 32
 * @returns {string} favicon URL
 */
function getFaviconUrl(url, size = 32) {
  if (!url) return "";
  try {
    const u = new URL(chrome.runtime.getURL("/_favicon/"));
    u.searchParams.set("pageUrl", url);
    u.searchParams.set("size", size);
    return u.toString();
  } catch {
    return "";
  }
}

/**
 * 防抖函数
 * @param {Function} fn - 要防抖的函数
 * @param {number} delay - 延迟毫秒数
 * @returns {Function}
 */
function debounce(fn, delay = 200) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

/**
 * 快捷创建 DOM 元素
 * @param {string} tag - 标签名
 * @param {object} attrs - 属性键值对
 * @param {string|Node|Array} children - 子节点
 * @returns {HTMLElement}
 */
function createElement(tag, attrs = {}, children = null) {
  const el = document.createElement(tag);
  for (const [key, val] of Object.entries(attrs)) {
    if (key === "className") {
      el.className = val;
    } else if (key === "dataset") {
      Object.assign(el.dataset, val);
    } else if (key.startsWith("on") && typeof val === "function") {
      el.addEventListener(key.slice(2).toLowerCase(), val);
    } else {
      el.setAttribute(key, val);
    }
  }
  if (children !== null) {
    if (typeof children === "string") {
      el.textContent = children;
    } else if (children instanceof Node) {
      el.appendChild(children);
    } else if (Array.isArray(children)) {
      children.forEach((c) => {
        if (c instanceof Node) el.appendChild(c);
        else if (typeof c === "string")
          el.appendChild(document.createTextNode(c));
      });
    }
  }
  return el;
}

/**
 * 展开/折叠 SVG 图标 (右箭头)
 * @returns {SVGElement}
 */
function createExpandIcon() {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", "14");
  svg.setAttribute("height", "14");
  svg.classList.add("expand-icon");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", "M9 6l6 6-6 6");
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", "currentColor");
  path.setAttribute("stroke-width", "2");
  path.setAttribute("stroke-linecap", "round");
  svg.appendChild(path);
  return svg;
}

/**
 * 文件夹 SVG 图标
 * @returns {SVGElement}
 */
function createFolderIcon() {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", "16");
  svg.setAttribute("height", "16");
  svg.classList.add("folder-icon");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute(
    "d",
    "M3 7a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z",
  );
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", "currentColor");
  path.setAttribute("stroke-width", "1.5");
  svg.appendChild(path);
  return svg;
}
