(() => {
  'use strict';

  /**
   * Shizuku Rebuild M1
   * ------------------
   * One authoritative scalar density field. No source-canvas copying,
   * no polygon contour, no paint stamping while touching.
   */
  class ShizukuEngine {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });
      this.fieldCanvas = document.createElement('canvas');
      this.fieldCtx = this.fieldCanvas.getContext('2d');
      this.maskCanvas = document.createElement('canvas');
      this.maskCtx = this.maskCanvas.getContext('2d');
      this.paintCanvas = document.createElement('canvas');
      this.paintCtx = this.paintCanvas.getContext('2d');

      this.gridW = 196;
      this.gridH = 196;
      this.density = new Float32Array(this.gridW * this.gridH);
      this.nextDensity = new Float32Array(this.density.length);
      this.height = new Float32Array(this.density.length);
      this.velocityX = new Float32Array(this.density.length);
      this.velocityY = new Float32Array(this.density.length);
      this.image = new ImageData(this.gridW, this.gridH);

      this.color = '#ef476f';
      this.rgb = this.hexToRgb(this.color);
      this.pointer = { down: false, x: .5, y: .5, px: .5, py: .5, pressure: 0, releasePulse: 0 };
      this.lastTime = performance.now();
      this.hasPaint = false;
      this.resize();
      this.bindEvents();
      requestAnimationFrame(t => this.frame(t));
    }

    hexToRgb(hex) {
      const n = Number.parseInt(hex.slice(1), 16);
      return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
    }

    setColor(hex) {
      this.color = hex;
      this.rgb = this.hexToRgb(hex);
    }

    resize() {
      const rect = this.canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.canvas.width = Math.max(1, Math.round(rect.width * dpr));
      this.canvas.height = Math.max(1, Math.round(rect.height * dpr));
      this.fieldCanvas.width = this.maskCanvas.width = this.paintCanvas.width = this.gridW;
      this.fieldCanvas.height = this.maskCanvas.height = this.paintCanvas.height = this.gridH;
    }

    reset() {
      this.density.fill(0);
      this.nextDensity.fill(0);
      this.height.fill(0);
      this.velocityX.fill(0);
      this.velocityY.fill(0);
      this.hasPaint = false;
    }

    addPaint(nx = .5, ny = .53) {
      const cx = nx * (this.gridW - 1);
      const cy = ny * (this.gridH - 1);
      const radius = Math.min(this.gridW, this.gridH) * .18;
      for (let y = Math.max(1, Math.floor(cy - radius * 1.4)); y < Math.min(this.gridH - 1, Math.ceil(cy + radius * 1.4)); y++) {
        for (let x = Math.max(1, Math.floor(cx - radius * 1.4)); x < Math.min(this.gridW - 1, Math.ceil(cx + radius * 1.4)); x++) {
          const dx = (x - cx) / radius;
          const dy = (y - cy) / radius;
          const d2 = dx * dx + dy * dy;
          const soft = Math.exp(-d2 * 2.35);
          const i = y * this.gridW + x;
          this.density[i] = Math.min(1.35, this.density[i] + soft * .94);
          this.height[i] = Math.max(this.height[i], soft * .75);
        }
      }
      this.hasPaint = true;
    }

    bindEvents() {
      const position = event => {
        const rect = this.canvas.getBoundingClientRect();
        return {
          x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
          y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height))
        };
      };
      this.canvas.addEventListener('pointerdown', event => {
        event.preventDefault();
        this.canvas.setPointerCapture(event.pointerId);
        const p = position(event);
        Object.assign(this.pointer, { down: true, x: p.x, y: p.y, px: p.x, py: p.y, pressure: event.pressure || .72 });
      });
      this.canvas.addEventListener('pointermove', event => {
        if (!this.pointer.down) return;
        event.preventDefault();
        const p = position(event);
        this.pointer.px = this.pointer.x;
        this.pointer.py = this.pointer.y;
        this.pointer.x = p.x;
        this.pointer.y = p.y;
        this.pointer.pressure = event.pressure || .72;
      });
      const release = event => {
        if (!this.pointer.down) return;
        if (event) event.preventDefault();
        this.pointer.down = false;
        this.pointer.releasePulse = 1;
      };
      this.canvas.addEventListener('pointerup', release);
      this.canvas.addEventListener('pointercancel', release);
      window.addEventListener('resize', () => this.resize(), { passive: true });
    }

    sample(field, x, y) {
      x = Math.max(0, Math.min(this.gridW - 1.001, x));
      y = Math.max(0, Math.min(this.gridH - 1.001, y));
      const x0 = Math.floor(x), y0 = Math.floor(y);
      const x1 = Math.min(this.gridW - 1, x0 + 1), y1 = Math.min(this.gridH - 1, y0 + 1);
      const tx = x - x0, ty = y - y0;
      const a = field[y0 * this.gridW + x0] * (1 - tx) + field[y0 * this.gridW + x1] * tx;
      const b = field[y1 * this.gridW + x0] * (1 - tx) + field[y1 * this.gridW + x1] * tx;
      return a * (1 - ty) + b * ty;
    }

    interact(dt) {
      const p = this.pointer;
      if (!p.down && p.releasePulse <= .002) return;
      const gx = p.x * (this.gridW - 1);
      const gy = p.y * (this.gridH - 1);
      const dxPointer = (p.x - p.px) * this.gridW;
      const dyPointer = (p.y - p.py) * this.gridH;
      const radius = 19;
      const pressure = p.down ? Math.max(.38, p.pressure) : 0;
      const minX = Math.max(2, Math.floor(gx - radius * 1.7));
      const maxX = Math.min(this.gridW - 3, Math.ceil(gx + radius * 1.7));
      const minY = Math.max(2, Math.floor(gy - radius * 1.7));
      const maxY = Math.min(this.gridH - 3, Math.ceil(gy + radius * 1.7));

      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          const ox = x - gx, oy = y - gy;
          const dist = Math.hypot(ox, oy);
          if (dist >= radius * 1.55) continue;
          const i = y * this.gridW + x;
          const influence = Math.exp(-(dist * dist) / (radius * radius * .68));
          const localPaint = Math.min(1, this.density[i] * 1.7);
          if (localPaint < .01) continue;

          if (p.down) {
            // Existing mass is pushed sideways. Touching never creates density.
            const inv = 1 / Math.max(1, dist);
            const radial = (1 - Math.min(1, dist / radius)) * pressure;
            this.velocityX[i] += (ox * inv * radial * .48 + dxPointer * .34) * influence * localPaint;
            this.velocityY[i] += (oy * inv * radial * .48 + dyPointer * .34) * influence * localPaint;
            this.height[i] -= influence * pressure * .16;
          } else {
            this.height[i] += influence * p.releasePulse * .08;
          }
        }
      }
      p.px = p.x;
      p.py = p.y;
      p.releasePulse *= Math.pow(.035, dt);
    }

    simulate(dt) {
      this.interact(dt);
      const advect = Math.min(1, dt * 38);
      let massBefore = 0;
      for (let i = 0; i < this.density.length; i++) massBefore += this.density[i];

      for (let y = 1; y < this.gridH - 1; y++) {
        for (let x = 1; x < this.gridW - 1; x++) {
          const i = y * this.gridW + x;
          const vx = this.velocityX[i];
          const vy = this.velocityY[i];
          const moved = this.sample(this.density, x - vx * advect, y - vy * advect);
          const neighbors = (this.density[i - 1] + this.density[i + 1] + this.density[i - this.gridW] + this.density[i + this.gridW]) * .25;
          this.nextDensity[i] = Math.max(0, moved * .992 + neighbors * .008);

          const hNeighbors = (this.height[i - 1] + this.height[i + 1] + this.height[i - this.gridW] + this.height[i + this.gridW]) * .25;
          this.height[i] += (hNeighbors - this.height[i]) * Math.min(1, dt * 10.5);
          this.height[i] *= Math.pow(.16, dt);
          this.velocityX[i] *= Math.pow(.055, dt);
          this.velocityY[i] *= Math.pow(.055, dt);
        }
      }

      let massAfter = 0;
      for (let i = 0; i < this.nextDensity.length; i++) massAfter += this.nextDensity[i];
      // Tiny global correction compensates interpolation drift, never adds visible local paint.
      const correction = massAfter > 0 ? Math.max(.985, Math.min(1.015, massBefore / massAfter)) : 1;
      const swap = this.density;
      this.density = this.nextDensity;
      this.nextDensity = swap;
      for (let i = 0; i < this.density.length; i++) this.density[i] = Math.min(1.4, this.density[i] * correction);
    }

    render() {
      const data = this.image.data;
      const { r, g, b } = this.rgb;
      for (let y = 0; y < this.gridH; y++) {
        for (let x = 0; x < this.gridW; x++) {
          const i = y * this.gridW + x;
          const p = i * 4;
          const d = this.density[i];
          const alpha = this.smoothstep(.055, .32, d);
          const left = this.density[i - (x > 0 ? 1 : 0)];
          const right = this.density[i + (x < this.gridW - 1 ? 1 : 0)];
          const up = this.density[i - (y > 0 ? this.gridW : 0)];
          const down = this.density[i + (y < this.gridH - 1 ? this.gridW : 0)];
          const nx = left - right;
          const ny = up - down;
          const h = this.height[i];
          const light = Math.max(-.18, Math.min(.28, nx * .34 + ny * .48 + h * .34));
          data[p] = Math.max(0, Math.min(255, r + 255 * light));
          data[p + 1] = Math.max(0, Math.min(255, g + 230 * light));
          data[p + 2] = Math.max(0, Math.min(255, b + 210 * light));
          data[p + 3] = Math.round(alpha * 250);
        }
      }
      this.fieldCtx.putImageData(this.image, 0, 0);

      const ctx = this.ctx;
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      ctx.save();
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      // Two-pass blur removes the simulation-cell silhouette before scaling.
      ctx.filter = 'blur(2.4px) drop-shadow(0 12px 13px rgba(88,54,25,.18))';
      ctx.drawImage(this.fieldCanvas, 0, 0, this.canvas.width, this.canvas.height);
      ctx.restore();

      // Soft wet highlight, rendered from density—not a polygon path.
      ctx.save();
      ctx.globalCompositeOperation = 'source-atop';
      const grad = ctx.createLinearGradient(0, 0, this.canvas.width, this.canvas.height);
      grad.addColorStop(0, 'rgba(255,255,255,.34)');
      grad.addColorStop(.38, 'rgba(255,255,255,.07)');
      grad.addColorStop(1, 'rgba(70,25,15,.12)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      ctx.restore();
    }

    smoothstep(a, b, x) {
      const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
      return t * t * (3 - 2 * t);
    }

    frame(time) {
      const dt = Math.min(.033, Math.max(.001, (time - this.lastTime) / 1000));
      this.lastTime = time;
      this.simulate(dt);
      this.render();
      requestAnimationFrame(t => this.frame(t));
    }
  }

  const canvas = document.getElementById('paintCanvas');
  const engine = new ShizukuEngine(canvas);
  const hint = document.getElementById('emptyHint');

  document.getElementById('addPaintButton').addEventListener('click', () => {
    engine.addPaint(.5 + (Math.random() - .5) * .08, .53 + (Math.random() - .5) * .05);
    hint.classList.add('hidden');
  });
  document.getElementById('resetButton').addEventListener('click', () => {
    engine.reset();
    hint.classList.remove('hidden');
  });
  document.querySelectorAll('.color').forEach(button => {
    button.addEventListener('click', () => {
      document.querySelectorAll('.color').forEach(b => b.classList.toggle('selected', b === button));
      engine.setColor(button.dataset.color);
    });
  });

  // Start with one blob so the tactile change is immediately testable.
  engine.addPaint();
  hint.classList.add('hidden');
  window.ShizukuEngine = ShizukuEngine;
})();
