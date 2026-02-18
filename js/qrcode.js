/**
 * qrcode.js — 轻量级 QR 码生成器（纯 Canvas，无依赖）
 * 基于 QR Code Model 2, Version 1-10, ECC Level M
 *
 * 用法: generateQRCode(canvas, text, size?)
 */

/* ---- 常量表 ---- */
const QR_EC_LEVEL = 1; // 0=L, 1=M, 2=Q, 3=H
const QR_MODE_BYTE = 4;

// 每个版本在 ECC=M 下可存放的数据字节数
const QR_DATA_CAPACITY = [
  0, 16, 28, 44, 64, 86, 108, 124, 154, 182, 216,
  254, 290, 334, 365, 415, 453, 507, 563, 627, 669,
];

// EC 码字数（每块）
const QR_EC_CODEWORDS = [
  0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26,
  30, 22, 22, 24, 24, 28, 28, 26, 26, 28,
];

// 每个版本的 EC 块数（M 级别）
const QR_EC_BLOCKS = [
  0, 1, 1, 1, 2, 2, 4, 4, 4, 4, 6,
  6, 8, 8, 10, 10, 12, 12, 14, 14, 16,
];

// 对齐图案中心位置
const QR_ALIGN_POS = [
  [],
  [], [6,18], [6,22], [6,26], [6,30], [6,34],
  [6,22,38], [6,24,42], [6,26,46], [6,28,50],
  [6,30,54], [6,32,58], [6,34,62], [6,26,46,66],
  [6,26,48,70], [6,26,50,74], [6,30,54,78],
  [6,30,56,82], [6,30,58,86], [6,34,62,90],
];

/* ---- GF(256) 运算 ---- */
const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
(function initGF() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x = (x << 1) ^ (x >= 128 ? 0x11d : 0);
  }
  for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255];
})();

function gfMul(a, b) {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

/* ---- Reed-Solomon ---- */
function rsGeneratorPoly(n) {
  let poly = [1];
  for (let i = 0; i < n; i++) {
    const newPoly = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      newPoly[j] ^= poly[j];
      newPoly[j + 1] ^= gfMul(poly[j], GF_EXP[i]);
    }
    poly = newPoly;
  }
  return poly;
}

function rsEncode(data, ecCount) {
  const gen = rsGeneratorPoly(ecCount);
  const result = new Uint8Array(ecCount);
  for (let i = 0; i < data.length; i++) {
    const coef = data[i] ^ result[0];
    result.copyWithin(0, 1);
    result[ecCount - 1] = 0;
    for (let j = 0; j < ecCount; j++) {
      result[j] ^= gfMul(gen[j + 1], coef);
    }
  }
  return result;
}

/* ---- 数据编码 ---- */
function encodeData(text) {
  const bytes = new TextEncoder().encode(text);
  // 选择最小版本
  let version = 1;
  for (; version <= 20; version++) {
    if (QR_DATA_CAPACITY[version] >= bytes.length + 3) break;
  }
  if (version > 20) throw new Error('内容过长，无法生成二维码');

  const totalDataBytes = QR_DATA_CAPACITY[version];
  const bits = [];

  // 模式指示符 (4 bits: Byte=0100)
  pushBits(bits, QR_MODE_BYTE, 4);
  // 字符计数 (version 1-9: 8 bits, 10+: 16 bits)
  const countBits = version <= 9 ? 8 : 16;
  pushBits(bits, bytes.length, countBits);
  // 数据
  for (const b of bytes) pushBits(bits, b, 8);
  // 终止符
  pushBits(bits, 0, Math.min(4, totalDataBytes * 8 - bits.length));
  // 字节对齐
  while (bits.length % 8 !== 0) bits.push(0);
  // 填充字节
  const padBytes = [0xEC, 0x11];
  let padIdx = 0;
  while (bits.length < totalDataBytes * 8) {
    pushBits(bits, padBytes[padIdx % 2], 8);
    padIdx++;
  }

  // 转为字节数组
  const dataBytes = new Uint8Array(totalDataBytes);
  for (let i = 0; i < totalDataBytes; i++) {
    let val = 0;
    for (let b = 0; b < 8; b++) val = (val << 1) | (bits[i * 8 + b] || 0);
    dataBytes[i] = val;
  }

  return { version, dataBytes };
}

function pushBits(arr, value, count) {
  for (let i = count - 1; i >= 0; i--) {
    arr.push((value >> i) & 1);
  }
}

/* ---- EC 分块与交织 ---- */
function interleave(version, dataBytes) {
  const ecCount = QR_EC_CODEWORDS[version];
  const numBlocks = QR_EC_BLOCKS[version];
  const totalData = dataBytes.length;
  const shortBlockLen = Math.floor(totalData / numBlocks);
  const longBlocks = totalData % numBlocks;

  const dataBlocks = [];
  const ecBlocks = [];
  let offset = 0;

  for (let i = 0; i < numBlocks; i++) {
    const blockLen = shortBlockLen + (i >= numBlocks - longBlocks ? 1 : 0);
    const block = dataBytes.slice(offset, offset + blockLen);
    dataBlocks.push(block);
    ecBlocks.push(rsEncode(block, ecCount));
    offset += blockLen;
  }

  // 交织数据码字
  const result = [];
  const maxDataLen = shortBlockLen + (longBlocks > 0 ? 1 : 0);
  for (let i = 0; i < maxDataLen; i++) {
    for (const block of dataBlocks) {
      if (i < block.length) result.push(block[i]);
    }
  }
  // 交织 EC 码字
  for (let i = 0; i < ecCount; i++) {
    for (const block of ecBlocks) {
      if (i < block.length) result.push(block[i]);
    }
  }
  return result;
}

/* ---- 矩阵构建 ---- */
function createMatrix(version) {
  const size = version * 4 + 17;
  const matrix = Array.from({ length: size }, () => new Int8Array(size)); // 0=空, 1=黑, -1=白(固定)
  const reserved = Array.from({ length: size }, () => new Uint8Array(size));

  // 定位图案 (3 个 7x7)
  const positions = [[0, 0], [size - 7, 0], [0, size - 7]];
  for (const [row, col] of positions) {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        const isBlack = (r === 0 || r === 6 || c === 0 || c === 6) ||
                        (r >= 2 && r <= 4 && c >= 2 && c <= 4);
        setModule(matrix, reserved, row + r, col + c, isBlack);
      }
    }
  }

  // 分隔线
  for (let i = 0; i < 8; i++) {
    // 左上
    setModule(matrix, reserved, 7, i, false);
    setModule(matrix, reserved, i, 7, false);
    // 右上
    setModule(matrix, reserved, 7, size - 8 + i, false);
    setModule(matrix, reserved, i, size - 8, false);
    // 左下
    setModule(matrix, reserved, size - 8, i, false);
    setModule(matrix, reserved, size - 8 + i, 7, false);
  }

  // 时序图案
  for (let i = 8; i < size - 8; i++) {
    setModule(matrix, reserved, 6, i, i % 2 === 0);
    setModule(matrix, reserved, i, 6, i % 2 === 0);
  }

  // 对齐图案
  if (version >= 2) {
    const pos = QR_ALIGN_POS[version];
    for (const r of pos) {
      for (const c of pos) {
        if (reserved[r][c]) continue; // 跳过与定位图案重叠
        for (let dr = -2; dr <= 2; dr++) {
          for (let dc = -2; dc <= 2; dc++) {
            const isBlack = Math.abs(dr) === 2 || Math.abs(dc) === 2 || (dr === 0 && dc === 0);
            setModule(matrix, reserved, r + dr, c + dc, isBlack);
          }
        }
      }
    }
  }

  // 暗模块
  setModule(matrix, reserved, size - 8, 8, true);

  // 预留格式信息区域
  for (let i = 0; i < 9; i++) {
    if (!reserved[8][i]) { reserved[8][i] = 1; }
    if (!reserved[i][8]) { reserved[i][8] = 1; }
  }
  for (let i = 0; i < 8; i++) {
    if (!reserved[8][size - 8 + i]) { reserved[8][size - 8 + i] = 1; }
    if (!reserved[size - 7 + i]?.[8]) {
      if (size - 7 + i >= 0) reserved[size - 7 + i][8] = 1;
    }
  }

  // 预留版本信息 (version >= 7)
  if (version >= 7) {
    for (let i = 0; i < 6; i++) {
      for (let j = 0; j < 3; j++) {
        reserved[i][size - 11 + j] = 1;
        reserved[size - 11 + j][i] = 1;
      }
    }
  }

  return { matrix, reserved, size };
}

function setModule(matrix, reserved, row, col, isBlack) {
  matrix[row][col] = isBlack ? 1 : -1;
  reserved[row][col] = 1;
}

/* ---- 数据放置 ---- */
function placeData(matrix, reserved, size, codewords) {
  let bitIdx = 0;
  const totalBits = codewords.length * 8;

  for (let col = size - 1; col >= 1; col -= 2) {
    if (col === 6) col = 5; // 跳过时序列
    for (let i = 0; i < size; i++) {
      for (let j = 0; j < 2; j++) {
        const c = col - j;
        const r = ((Math.floor((size - 1 - col + (col <= 6 ? 1 : 0)) / 2)) % 2 === 0)
          ? size - 1 - i : i;
        if (reserved[r][c]) continue;
        if (bitIdx < totalBits) {
          const byteIdx = Math.floor(bitIdx / 8);
          const bitPos = 7 - (bitIdx % 8);
          matrix[r][c] = ((codewords[byteIdx] >> bitPos) & 1) ? 1 : -1;
          bitIdx++;
        } else {
          matrix[r][c] = -1;
        }
      }
    }
  }
}

/* ---- 掩码 ---- */
const MASK_FNS = [
  (r, c) => (r + c) % 2 === 0,
  (r, c) => r % 2 === 0,
  (r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => (r * c) % 2 + (r * c) % 3 === 0,
  (r, c) => ((r * c) % 2 + (r * c) % 3) % 2 === 0,
  (r, c) => ((r + c) % 2 + (r * c) % 3) % 2 === 0,
];

function applyMask(matrix, reserved, size, maskIdx) {
  const fn = MASK_FNS[maskIdx];
  const result = matrix.map(row => Int8Array.from(row));
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!reserved[r][c] && fn(r, c)) {
        result[r][c] = result[r][c] === 1 ? -1 : 1;
      }
    }
  }
  return result;
}

/* ---- 格式信息 ---- */
const FORMAT_INFO = [
  0x5412, 0x5125, 0x5E7C, 0x5B4B, 0x45F9, 0x40CE, 0x4F97, 0x4AA0,
  0x77C4, 0x72F3, 0x7DAA, 0x789D, 0x662F, 0x6318, 0x6C41, 0x6976,
  0x1689, 0x13BE, 0x1CE7, 0x19D0, 0x0762, 0x0255, 0x0D0C, 0x083B,
  0x355F, 0x3068, 0x3F31, 0x3A06, 0x24B4, 0x2183, 0x2EDA, 0x2BED,
];

function writeFormatInfo(matrix, size, maskIdx) {
  const code = FORMAT_INFO[QR_EC_LEVEL * 8 + maskIdx];
  const bits = [];
  for (let i = 14; i >= 0; i--) bits.push((code >> i) & 1);

  // 水平（左侧定位图案旁）
  const hPos = [0,1,2,3,4,5,7,8,size-7,size-6,size-5,size-4,size-3,size-2,size-1];
  for (let i = 0; i < 15; i++) {
    matrix[8][hPos[i]] = bits[i] ? 1 : -1;
  }

  // 垂直（上方定位图案旁）
  const vPos = [size-1,size-2,size-3,size-4,size-5,size-6,size-7,8,7,5,4,3,2,1,0];
  for (let i = 0; i < 15; i++) {
    matrix[vPos[i]][8] = bits[i] ? 1 : -1;
  }
}

/* ---- 评分 ---- */
function scoreMask(matrix, size) {
  let score = 0;
  // 简化评分：只统计连续同色行/列
  for (let r = 0; r < size; r++) {
    let count = 1;
    for (let c = 1; c < size; c++) {
      if ((matrix[r][c] > 0) === (matrix[r][c - 1] > 0)) {
        count++;
        if (count === 5) score += 3;
        else if (count > 5) score += 1;
      } else {
        count = 1;
      }
    }
  }
  for (let c = 0; c < size; c++) {
    let count = 1;
    for (let r = 1; r < size; r++) {
      if ((matrix[r][c] > 0) === (matrix[r - 1][c] > 0)) {
        count++;
        if (count === 5) score += 3;
        else if (count > 5) score += 1;
      } else {
        count = 1;
      }
    }
  }
  return score;
}

/* ---- 主入口 ---- */
function generateQRCode(canvas, text, pixelSize = 200) {
  const { version, dataBytes } = encodeData(text);
  const codewords = interleave(version, dataBytes);
  const { matrix, reserved, size } = createMatrix(version);

  placeData(matrix, reserved, size, codewords);

  // 选择最优掩码
  let bestMask = 0;
  let bestScore = Infinity;
  for (let m = 0; m < 8; m++) {
    const masked = applyMask(matrix, reserved, size, m);
    writeFormatInfo(masked, size, m);
    const s = scoreMask(masked, size);
    if (s < bestScore) {
      bestScore = s;
      bestMask = m;
    }
  }

  const finalMatrix = applyMask(matrix, reserved, size, bestMask);
  writeFormatInfo(finalMatrix, size, bestMask);

  // 绘制到 Canvas
  const scale = pixelSize / (size + 8); // 留 4 格白边
  canvas.width = pixelSize;
  canvas.height = pixelSize;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, pixelSize, pixelSize);
  ctx.fillStyle = '#000000';

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (finalMatrix[r][c] > 0) {
        ctx.fillRect(
          Math.floor((c + 4) * scale),
          Math.floor((r + 4) * scale),
          Math.ceil(scale),
          Math.ceil(scale)
        );
      }
    }
  }
}
