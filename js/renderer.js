/* ゆびさきアトリエ: Paint Renderer v1.1.1 */
(function (global) {
  'use strict';

  const Colors = global.YubisakiColors;

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function blendWith(hex, target, ratio) {
    const source = Colors.hexToRgb(hex);
    const t = clamp(ratio, 0, 1);
    return Colors.rgbToHex({
      r: source.r + (target.r - source.r) * t,
      g: source.g + (target.g - source.g) * t,
      b: source.b + (target.b - source.b) * t
    });
  }

  function organicPath(ctx, x, y, radius, seed, viscosity) {
    const points = 30;
    const wobbleAmount = 0.012 + (1 - viscosity) * 0.045;
    ctx.beginPath();
    for (let i = 0; i <= points; i += 1) {
      const angle = (i / points) * Math.PI * 2;
      const wobble = 1
        + wobbleAmount * Math.sin(angle * 3 + seed)
        + wobbleAmount * 0.62 * Math.sin(angle * 5 + seed * 1.73);
      const r = radius * wobble;
      const px = x + Math.cos(angle) * r;
      const py = y + Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }

  class PaintRenderer {
    constructor(context) {
      if (!context) throw new TypeError('CanvasRenderingContext2D is required.');
      this.context = context;
    }

    drawBlob(blob, x, y, radius, options = {}) {
      const ctx = this.context;
      const color = blob && blob.color ? blob.color : '#999999';
      const gloss = clamp(blob && Number.isFinite(blob.gloss) ? blob.gloss : 0.8, 0, 1);
      const wetness = clamp(blob && Number.isFinite(blob.wetness) ? blob.wetness : 1, 0, 1);
      const viscosity = clamp(blob && Number.isFinite(blob.viscosity) ? blob.viscosity : 0.82, 0, 1);
      const height = clamp(blob && Number.isFinite(blob.height) ? blob.height : 1, 0.55, 2.2);
      const seed = Number.isFinite(options.seed) ? options.seed : Math.random() * 20;
      const composite = options.composite || 'source-over';
      const bumpCount = Math.max(9, Math.floor(radius / 5));
      const light = blendWith(color, { r: 255, g: 255, b: 255 }, 0.28 + gloss * 0.12);
      const veryLight = blendWith(color, { r: 255, g: 255, b: 255 }, 0.58);
      const dark = blendWith(color, { r: 0, g: 0, b: 0 }, 0.12 + height * 0.055);

      // Raised paint body and contact shadow.
      ctx.save();
      ctx.globalCompositeOperation = composite;
      ctx.shadowColor = `rgba(0,0,0,${0.12 + height * 0.075})`;
      ctx.shadowBlur = radius * (0.24 + height * 0.08);
      ctx.shadowOffsetY = radius * (0.08 + height * 0.045);
      organicPath(ctx, x, y, radius, seed, viscosity);
      const gradient = ctx.createRadialGradient(
        x - radius * 0.32, y - radius * 0.38, radius * 0.08,
        x, y, radius * 1.08
      );
      gradient.addColorStop(0, light);
      gradient.addColorStop(0.56, color);
      gradient.addColorStop(1, dark);
      ctx.fillStyle = gradient;
      ctx.fill();
      ctx.restore();

      // Fine ridges and wet highlights are kept in source-over so the blob
      // stays glossy even when the pigment body uses multiply mixing.
      ctx.save();
      organicPath(ctx, x, y, radius, seed, viscosity);
      ctx.clip();
      for (let i = 0; i < bumpCount; i += 1) {
        const angle = Math.random() * Math.PI * 2;
        const distance = Math.pow(Math.random(), 0.65) * radius * 0.86;
        const bx = x + Math.cos(angle) * distance;
        const by = y + Math.sin(angle) * distance;
        const br = radius * (0.12 + Math.random() * 0.18);
        const bump = ctx.createRadialGradient(bx - br * 0.3, by - br * 0.35, 0, bx, by, br);
        bump.addColorStop(0, `rgba(255,255,255,${0.12 + wetness * 0.22})`);
        bump.addColorStop(0.7, 'rgba(255,255,255,0.04)');
        bump.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = bump;
        ctx.beginPath();
        ctx.arc(bx, by, br, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      ctx.save();
      ctx.globalAlpha = 0.3 + gloss * 0.42;
      ctx.fillStyle = 'rgba(255,255,255,.86)';
      ctx.beginPath();
      ctx.ellipse(
        x - radius * 0.31,
        y - radius * 0.38,
        radius * (0.27 + wetness * 0.05),
        radius * (0.13 + wetness * 0.035),
        -0.48,
        0,
        Math.PI * 2
      );
      ctx.fill();
      ctx.globalAlpha = 0.68 + gloss * 0.2;
      ctx.fillStyle = veryLight;
      ctx.beginPath();
      ctx.ellipse(x - radius * 0.42, y - radius * 0.47, radius * 0.105, radius * 0.065, -0.48, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.save();
      organicPath(ctx, x, y, radius, seed, viscosity);
      ctx.lineWidth = Math.max(1.5, radius * 0.055);
      ctx.strokeStyle = `rgba(255,255,255,${0.14 + gloss * 0.18})`;
      ctx.stroke();
      ctx.restore();
    }
  }

  global.YubisakiRenderer = Object.freeze({ PaintRenderer, organicPath });
})(window);
