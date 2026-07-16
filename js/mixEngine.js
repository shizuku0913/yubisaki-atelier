/* ゆびさきアトリエ: Mix Engine 基盤 */
(function (global) {
  'use strict';

  const Colors = global.YubisakiColors;

  function mixRgb(colors, weights) {
    if (!Array.isArray(colors) || colors.length === 0) return '#999999';
    const safeWeights = Array.isArray(weights) && weights.length === colors.length
      ? weights.map((weight) => Math.max(0, Number(weight) || 0))
      : colors.map(() => 1);
    const total = safeWeights.reduce((sum, value) => sum + value, 0) || 1;
    const mixed = colors.reduce((acc, color, index) => {
      const rgb = typeof color === 'string' ? Colors.hexToRgb(color) : color;
      const weight = safeWeights[index] / total;
      acc.r += rgb.r * weight;
      acc.g += rgb.g * weight;
      acc.b += rgb.b * weight;
      return acc;
    }, { r: 0, g: 0, b: 0 });
    return Colors.rgbToHex(mixed);
  }

  class MixEngine {
    mix(colors, weights) {
      return mixRgb(colors, weights);
    }
  }

  global.YubisakiMix = Object.freeze({ MixEngine, mixRgb });
})(window);
