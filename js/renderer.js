/* ゆびさきアトリエ: Renderer 基盤 */
(function (global) {
  'use strict';

  const Colors = global.YubisakiColors;

  function blendWith(hex, target, ratio) {
    const source = Colors.hexToRgb(hex);
    const t = Math.max(0, Math.min(1, ratio));
    return Colors.rgbToHex({
      r: source.r + (target.r - source.r) * t,
      g: source.g + (target.g - source.g) * t,
      b: source.b + (target.b - source.b) * t
    });
  }

  class PaintRenderer {
    constructor(context) {
      if (!context) throw new TypeError('CanvasRenderingContext2D is required.');
      this.context = context;
    }

    drawBlob(blob, x, y, radius) {
      const ctx = this.context;
      const color = blob && blob.color ? blob.color : '#999999';
      const gloss = blob && Number.isFinite(blob.gloss) ? blob.gloss : 0.8;
      const light = blendWith(color, { r: 255, g: 255, b: 255 }, 0.4);
      const dark = blendWith(color, { r: 0, g: 0, b: 0 }, 0.24);

      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,.24)';
      ctx.shadowBlur = radius * 0.3;
      ctx.shadowOffsetY = radius * 0.12;

      const gradient = ctx.createRadialGradient(
        x - radius * 0.3, y - radius * 0.35, radius * 0.08,
        x, y, radius
      );
      gradient.addColorStop(0, light);
      gradient.addColorStop(0.62, color);
      gradient.addColorStop(1, dark);
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.shadowColor = 'transparent';
      ctx.fillStyle = `rgba(255,255,255,${0.18 + gloss * 0.38})`;
      ctx.beginPath();
      ctx.ellipse(x - radius * 0.28, y - radius * 0.32, radius * 0.24, radius * 0.13, -0.45, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  global.YubisakiRenderer = Object.freeze({ PaintRenderer });
})(window);
