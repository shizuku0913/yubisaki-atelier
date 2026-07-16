/* ゆびさきアトリエ: Paint Engine 基盤 */
(function (global) {
  'use strict';

  class PaintBlob {
    constructor({ color = '#999999', amount = 1, wetness = 1, viscosity = 0.82, gloss = 0.9 } = {}) {
      this.color = color;
      this.amount = Math.max(0, amount);
      this.wetness = Math.max(0, Math.min(1, wetness));
      this.viscosity = Math.max(0, Math.min(1, viscosity));
      this.gloss = Math.max(0, Math.min(1, gloss));
      this.height = 1;
      this.mixLevel = 0;
      this.history = [color];
    }

    addPaint(color, amount = 1) {
      this.color = color;
      this.amount += Math.max(0, amount);
      this.height = Math.min(2.2, this.height + amount * 0.12);
      this.history.push(color);
      return this;
    }

    addWater(amount = 0.1) {
      this.wetness = Math.min(1, this.wetness + Math.max(0, amount));
      this.viscosity = Math.max(0.15, this.viscosity - amount * 0.35);
      this.gloss = Math.min(1, this.gloss + amount * 0.25);
      return this;
    }

    dry(delta = 0.001) {
      this.wetness = Math.max(0, this.wetness - Math.max(0, delta));
      this.gloss = Math.min(this.gloss, this.wetness);
      this.height = Math.max(0.7, this.height - delta * 0.25);
      return this;
    }
  }

  global.YubisakiPaint = Object.freeze({ PaintBlob });
})(window);
