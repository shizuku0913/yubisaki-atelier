/* ゆびさきアトリエ: 共通色ユーティリティ */
(function (global) {
  'use strict';

  function clampByte(value) {
    return Math.max(0, Math.min(255, Math.round(Number(value) || 0)));
  }

  function hexToRgb(hex) {
    const normalized = String(hex).replace('#', '').trim();
    const expanded = normalized.length === 3
      ? normalized.split('').map((char) => char + char).join('')
      : normalized;
    if (!/^[0-9a-fA-F]{6}$/.test(expanded)) {
      throw new TypeError(`Invalid hex color: ${hex}`);
    }
    const number = Number.parseInt(expanded, 16);
    return { r: (number >> 16) & 255, g: (number >> 8) & 255, b: number & 255 };
  }

  function rgbToHex(rgb) {
    const part = (value) => clampByte(value).toString(16).padStart(2, '0');
    return `#${part(rgb.r)}${part(rgb.g)}${part(rgb.b)}`;
  }

  global.YubisakiColors = Object.freeze({ clampByte, hexToRgb, rgbToHex });
})(window);
