/* ゆびさきアトリエ: Finger Dynamics v1.2.0 */
(function (global) {
  'use strict';

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  class FingerDynamics {
    constructor() {
      this.reset();
    }

    reset() {
      this.lastTime = null;
      this.smoothedSpeed = 0;
    }

    measure(distance, now = performance.now()) {
      const safeDistance = Math.max(0, Number(distance) || 0);
      const dt = this.lastTime === null ? 16.67 : clamp(now - this.lastTime, 4, 80);
      this.lastTime = now;

      const pixelsPerSecond = (safeDistance / dt) * 1000;
      this.smoothedSpeed = this.smoothedSpeed * 0.72 + pixelsPerSecond * 0.28;
      const speed01 = clamp((this.smoothedSpeed - 35) / 900, 0, 1);

      return {
        speed: this.smoothedSpeed,
        speed01,
        // Slow movement leaves narrow, visible marbling. Fast movement
        // spreads pigment farther and reaches a uniform mixture sooner.
        radius: 21 + speed01 * 17,
        blendAlpha: 0.18 + speed01 * 0.24,
        marbleAlpha: 0.62 - speed01 * 0.34,
        ribbonWidth: 2.2 + (1 - speed01) * 2.6,
        progressMultiplier: 0.62 + speed01 * 1.45
      };
    }
  }

  global.YubisakiFinger = Object.freeze({ FingerDynamics });
})(window);
