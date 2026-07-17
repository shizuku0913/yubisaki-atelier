(() => {
  'use strict';

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  class SpatialHash {
    constructor(cellSize) {
      this.cellSize = cellSize;
      this.cells = new Map();
      this.activeBuckets = [];
    }
    clear() {
      for (const bucket of this.activeBuckets) bucket.length = 0;
      this.activeBuckets.length = 0;
    }
    key(cx, cy) { return cx + cy * 4096; }
    insert(i, x, y) {
      const cx = Math.floor(x / this.cellSize);
      const cy = Math.floor(y / this.cellSize);
      const k = this.key(cx, cy);
      let bucket = this.cells.get(k);
      if (!bucket) {
        bucket = [];
        this.cells.set(k, bucket);
      }
      if (bucket.length === 0) this.activeBuckets.push(bucket);
      bucket.push(i);
    }
    nearbyInto(x, y, out) {
      out.length = 0;
      const cx = Math.floor(x / this.cellSize);
      const cy = Math.floor(y / this.cellSize);
      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          const bucket = this.cells.get(this.key(cx + ox, cy + oy));
          if (!bucket) continue;
          for (let i = 0; i < bucket.length; i++) out.push(bucket[i]);
        }
      }
      return out;
    }
  }

  class ShizukuEngine4Alpha {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });
      this.maskCanvas = document.createElement('canvas');
      this.maskCtx = this.maskCanvas.getContext('2d', { willReadFrequently: true });
      this.shadeCanvas = document.createElement('canvas');
      this.shadeCtx = this.shadeCanvas.getContext('2d');
      this.particles = [];
      this.maxParticles = 720;
      this.initialParticles = 510;
      this.hash = new SpatialHash(16);
      this.neighborBuffer = [];
      this.color = '#e84a68';
      this.rgb = this.hexToRgb(this.color);
      this.pointer = { down:false, id:null, x:0, y:0, px:0, py:0, vx:0, vy:0, pressure:.7, justReleased:0, grabbed:new Map() };
      this.fixedMass = 0;
      this.lastTime = performance.now();
      this.renderScale = 0.42;
      this.awake = true;
      this.sleepAt = this.lastTime + 2200;
      this.renderDirty = true;
      this.lastRenderTime = 0;
      this.targetRenderInterval = 1000 / 30;
      this.particleSprite = document.createElement('canvas');
      this.particleSpriteCtx = this.particleSprite.getContext('2d');
      this.resize();
      this.bind();
      this.seedBlob(.5, .55, 510);
      requestAnimationFrame(t => this.frame(t));
    }

    hexToRgb(hex) {
      const n = parseInt(hex.slice(1), 16);
      return { r:(n>>16)&255, g:(n>>8)&255, b:n&255 };
    }
    setColor(hex) {
      this.color = hex;
      this.rgb = this.hexToRgb(hex);
      this.renderDirty = true;
      this.wake(350);
    }

    wake(extraMs = 1800) {
      this.awake = true;
      this.sleepAt = performance.now() + extraMs;
      this.renderDirty = true;
    }

    resize() {
      const rect = this.canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.canvas.width = Math.max(1, Math.round(rect.width * dpr));
      this.canvas.height = Math.max(1, Math.round(rect.height * dpr));
      this.w = this.canvas.width;
      this.h = this.canvas.height;
      this.maskCanvas.width = this.shadeCanvas.width = Math.max(180, Math.round(this.w * this.renderScale));
      this.maskCanvas.height = this.shadeCanvas.height = Math.max(180, Math.round(this.h * this.renderScale));
      this.sx = this.maskCanvas.width / this.w;
      this.sy = this.maskCanvas.height / this.h;
      this.particleRadius = clamp(Math.min(this.w, this.h) * .018, 7, 15);
      this.hash.cellSize = this.particleRadius * 2.15;
      this.buildParticleSprite();
      this.wake(600);
    }

    buildParticleSprite() {
      const rr = Math.max(2, this.particleRadius * 2.45 * Math.min(this.sx, this.sy));
      const size = Math.ceil(rr * 2 + 4);
      this.particleSprite.width = size;
      this.particleSprite.height = size;
      const c = this.particleSpriteCtx;
      const center = size / 2;
      const g = c.createRadialGradient(center, center, 0, center, center, rr);
      g.addColorStop(0, 'rgba(255,255,255,.18)');
      g.addColorStop(.48, 'rgba(255,255,255,.12)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.clearRect(0, 0, size, size);
      c.fillStyle = g;
      c.fillRect(0, 0, size, size);
      this.spriteHalf = size / 2;
    }

    reset() {
      this.particles.length = 0;
      this.pointer.grabbed.clear();
      this.seedBlob(.5, .55, this.initialParticles);
      this.wake(2200);
    }

    seedBlob(nx, ny, amount = 320) {
      const available = Math.max(0, this.maxParticles - this.particles.length);
      const spawnCount = Math.min(amount, available);
      if (spawnCount === 0) {
        this.updateMassLabel();
        return 0;
      }
      const cx = nx * this.w, cy = ny * this.h;
      const radius = Math.min(this.w, this.h) * .145;
      const golden = Math.PI * (3 - Math.sqrt(5));
      for (let i = 0; i < spawnCount; i++) {
        const q = Math.sqrt((i + .5) / spawnCount);
        const a = i * golden + Math.random() * .13;
        const jitter = .92 + Math.random() * .13;
        this.particles.push({
          x: cx + Math.cos(a) * radius * q * jitter,
          y: cy + Math.sin(a) * radius * q * jitter * .88,
          px: 0, py: 0, vx: 0, vy: 0,
          restX: 0, restY: 0
        });
      }
      this.fixedMass = this.particles.length;
      this.updateMassLabel();
      this.wake(2200);
      return spawnCount;
    }

    addPaint() {
      const x = .5 + (Math.random() - .5) * .12;
      const y = .54 + (Math.random() - .5) * .08;
      this.seedBlob(x, y, 180);
    }

    bind() {
      const local = e => {
        const r = this.canvas.getBoundingClientRect();
        return { x:(e.clientX-r.left)/r.width*this.w, y:(e.clientY-r.top)/r.height*this.h };
      };
      this.canvas.addEventListener('pointerdown', e => {
        e.preventDefault();
        const p = local(e);
        this.canvas.setPointerCapture(e.pointerId);
        Object.assign(this.pointer, { down:true, id:e.pointerId, x:p.x, y:p.y, px:p.x, py:p.y, vx:0, vy:0, pressure:e.pressure || .72 });
        this.beginGrab();
        this.wake(2200);
      });
      this.canvas.addEventListener('pointermove', e => {
        if (!this.pointer.down || e.pointerId !== this.pointer.id) return;
        e.preventDefault();
        const p = local(e);
        const dx = p.x - this.pointer.x, dy = p.y - this.pointer.y;
        this.pointer.px = this.pointer.x; this.pointer.py = this.pointer.y;
        this.pointer.x = p.x; this.pointer.y = p.y;
        this.pointer.vx = lerp(this.pointer.vx, dx, .68);
        this.pointer.vy = lerp(this.pointer.vy, dy, .68);
        this.pointer.pressure = e.pressure || .72;
        this.wake(1600);
      });
      const up = e => {
        if (!this.pointer.down) return;
        if (e) e.preventDefault();
        this.pointer.down = false;
        this.pointer.justReleased = 1;
        this.pointer.grabbed.clear();
        this.wake(1500);
      };
      this.canvas.addEventListener('pointerup', up);
      this.canvas.addEventListener('pointercancel', up);
      window.addEventListener('resize', () => this.resize(), { passive:true });
    }


    beginGrab() {
      const pnt = this.pointer;
      pnt.grabbed.clear();
      const radius = Math.min(this.w, this.h) * .082;
      const candidates = [];
      for (let i = 0; i < this.particles.length; i++) {
        const p = this.particles[i];
        const dx = p.x - pnt.x, dy = p.y - pnt.y;
        const d = Math.hypot(dx, dy);
        if (d < radius) candidates.push([d, i, dx, dy]);
      }
      candidates.sort((a,b) => a[0]-b[0]);
      const limit = Math.min(54, candidates.length);
      for (let n = 0; n < limit; n++) {
        const [, i, dx, dy] = candidates[n];
        pnt.grabbed.set(i, { ox: dx, oy: dy, strength: 1 - n / Math.max(1, limit) });
      }
    }

    rebuildHash() {
      this.hash.clear();
      for (let i=0;i<this.particles.length;i++) {
        const p=this.particles[i];
        this.hash.insert(i,p.x,p.y);
      }
    }

    step(dt) {
      const substeps = 2;
      const sdt = Math.min(.018, dt / substeps);
      for (let sub=0; sub<substeps; sub++) {
        this.rebuildHash();
        const pr = this.particleRadius;
        const target = pr * 1.36;
        const pointerRadius = Math.min(this.w,this.h) * .105;
        const pnt = this.pointer;

        for (let i=0;i<this.particles.length;i++) {
          const p=this.particles[i];
          p.px=p.x; p.py=p.y;

          // Heavy paint: strong damping, tiny gravity, a little elastic memory.
          p.vx *= Math.pow(.055, sdt);
          p.vy *= Math.pow(.055, sdt);
          p.vy += 11 * sdt;

          const near=this.hash.nearbyInto(p.x,p.y,this.neighborBuffer);
          let cx=0, cy=0, count=0;
          for (const j of near) {
            if (j===i) continue;
            const q=this.particles[j];
            let dx=p.x-q.x, dy=p.y-q.y;
            const d2=dx*dx+dy*dy;
            if (d2<=.0001 || d2>target*target) continue;
            const d=Math.sqrt(d2);
            const overlap=(target-d)/target;
            dx/=d; dy/=d;
            // Incompressibility: particles cannot pile into a hard angular cluster.
            const push=overlap*34*sdt;
            p.vx += dx*push; p.vy += dy*push;
            cx += q.x; cy += q.y; count++;
          }
          if (count>1) {
            cx/=count; cy/=count;
            // Cohesion produces the sticky "nyuru" pull without freezing the blob.
            p.vx += (cx-p.x)*0.60*sdt;
            p.vy += (cy-p.y)*0.60*sdt;
          }

          const dx=p.x-pnt.x, dy=p.y-pnt.y;
          const dist=Math.hypot(dx,dy);
          if (pnt.down && dist<pointerRadius) {
            const t=1-dist/pointerRadius;
            const soft=t*t*(3-2*t);
            const inv=1/Math.max(1,dist);
            const pressure=clamp(pnt.pressure,.4,1);
            // Press still displaces paint, but more softly than before.
            p.vx += dx*inv*soft*pressure*250*sdt;
            p.vy += dy*inv*soft*pressure*250*sdt;
            p.vx += pnt.vx*soft*12*sdt;
            p.vy += pnt.vy*soft*12*sdt;
          }

          // Nyuru grab: a limited patch of paint is attached to the finger by
          // soft springs. It stretches visibly and detaches past a real limit.
          const grab=pnt.grabbed.get(i);
          if (pnt.down && grab) {
            const targetX=pnt.x + grab.ox*.42;
            const targetY=pnt.y + grab.oy*.42;
            const gx=targetX-p.x, gy=targetY-p.y;
            const stretch=Math.hypot(gx,gy);
            const spring=(16 + grab.strength*18);
            p.vx += gx*spring*sdt;
            p.vy += gy*spring*sdt;
            p.vx += pnt.vx*(.16 + grab.strength*.22);
            p.vy += pnt.vy*(.16 + grab.strength*.22);
            const breakDistance=pointerRadius*(1.10 + grab.strength*.72);
            if (stretch>breakDistance) pnt.grabbed.delete(i);
          }
          if (!pnt.down && pnt.justReleased>0 && dist<pointerRadius*1.15) {
            const t=1-dist/(pointerRadius*1.15);
            // A short elastic return pulse: "purun".
            p.vx += -dx*1.1*t*pnt.justReleased*sdt;
            p.vy += -dy*1.1*t*pnt.justReleased*sdt;
          }

          p.x += p.vx;
          p.y += p.vy;
          const margin=pr*1.2;
          if (p.x<margin){p.x=margin;p.vx=Math.abs(p.vx)*.25;}
          if (p.x>this.w-margin){p.x=this.w-margin;p.vx=-Math.abs(p.vx)*.25;}
          if (p.y<margin){p.y=margin;p.vy=Math.abs(p.vy)*.25;}
          if (p.y>this.h-margin){p.y=this.h-margin;p.vy=-Math.abs(p.vy)*.25;}
        }
        pnt.justReleased *= Math.pow(.02,sdt);
        pnt.vx *= .82; pnt.vy *= .82;
      }
    }

    renderMask() {
      const c=this.maskCtx, mw=this.maskCanvas.width, mh=this.maskCanvas.height;
      c.clearRect(0,0,mw,mh);
      c.save();
      c.globalCompositeOperation='lighter';
      const sprite=this.particleSprite;
      const half=this.spriteHalf;
      for (const p of this.particles) {
        c.drawImage(sprite,p.x*this.sx-half,p.y*this.sy-half);
      }
      c.restore();
    }

    render() {
      this.renderMask();
      const ctx=this.ctx;
      ctx.clearRect(0,0,this.w,this.h);

      // A soft floor shadow makes the mass read as thick paint rather than a flat sticker.
      ctx.save();
      ctx.filter=`blur(${Math.max(5,this.particleRadius*.8)}px)`;
      ctx.globalAlpha=.24;
      ctx.drawImage(this.maskCanvas,0,this.particleRadius*.75,this.w,this.h);
      ctx.globalCompositeOperation='source-in';
      ctx.fillStyle='rgba(73,43,24,.55)';
      ctx.fillRect(0,0,this.w,this.h);
      ctx.restore();

      // Main paint body: continuous alpha field, no polygon outline and no stamp copying.
      ctx.save();
      ctx.imageSmoothingEnabled=true;
      ctx.imageSmoothingQuality='high';
      ctx.filter=`blur(${Math.max(1.8,this.particleRadius*.18)}px) contrast(155%)`;
      ctx.drawImage(this.maskCanvas,0,0,this.w,this.h);
      ctx.globalCompositeOperation='source-in';
      const base=ctx.createLinearGradient(0,0,this.w,this.h);
      const {r,g,b}=this.rgb;
      base.addColorStop(0,`rgb(${clamp(r+34,0,255)},${clamp(g+30,0,255)},${clamp(b+24,0,255)})`);
      base.addColorStop(.48,`rgb(${r},${g},${b})`);
      base.addColorStop(1,`rgb(${clamp(r-38,0,255)},${clamp(g-35,0,255)},${clamp(b-30,0,255)})`);
      ctx.fillStyle=base;
      ctx.fillRect(0,0,this.w,this.h);
      ctx.restore();

      // Wet specular sheen clipped by the same density field.
      ctx.save();
      ctx.globalCompositeOperation='source-atop';
      const sheen=ctx.createRadialGradient(this.w*.34,this.h*.30,0,this.w*.34,this.h*.30,Math.max(this.w,this.h)*.72);
      sheen.addColorStop(0,'rgba(255,255,255,.40)');
      sheen.addColorStop(.22,'rgba(255,255,255,.13)');
      sheen.addColorStop(.62,'rgba(255,255,255,0)');
      ctx.fillStyle=sheen;
      ctx.fillRect(0,0,this.w,this.h);
      ctx.restore();

      // Fine wet glints follow moving particles and make stretched areas feel viscous.
      ctx.save();
      ctx.globalCompositeOperation='screen';
      ctx.globalAlpha=.16;
      ctx.lineCap='round';
      ctx.strokeStyle='white';
      ctx.lineWidth=Math.max(1.2,this.particleRadius*.13);
      for(let i=0;i<this.particles.length;i+=17){
        const p=this.particles[i];
        const speed=Math.hypot(p.vx,p.vy);
        if(speed<.12) continue;
        ctx.beginPath();
        ctx.moveTo(p.x,p.y);
        ctx.lineTo(p.x-p.vx*1.7,p.y-p.vy*1.7);
        ctx.stroke();
      }
      ctx.restore();
    }

    updateMassLabel() {
      const el=document.getElementById('massValue');
      if (el) el.textContent=`${Math.round(this.particles.length / this.initialParticles * 100)}%`;
      const button=document.getElementById('addPaintButton');
      if (button) {
        const full=this.particles.length>=this.maxParticles;
        button.disabled=full;
        button.textContent=full ? 'えのぐは いっぱい' : '＋ えのぐを たす';
      }
    }

    frame(t) {
      const dt=clamp((t-this.lastTime)/1000,.001,.033);
      this.lastTime=t;

      if (this.awake) {
        this.step(dt);
        this.renderDirty = true;
        if (!this.pointer.down && t >= this.sleepAt) this.awake = false;
      }

      if (this.renderDirty && (t - this.lastRenderTime >= this.targetRenderInterval || !this.awake)) {
        this.render();
        this.renderDirty = false;
        this.lastRenderTime = t;
      }
      requestAnimationFrame(n=>this.frame(n));
    }
  }

  const canvas=document.getElementById('paintCanvas');
  const engine=new ShizukuEngine4Alpha(canvas);
  document.getElementById('resetButton').addEventListener('click',()=>engine.reset());
  document.getElementById('addPaintButton').addEventListener('click',()=>engine.addPaint());
  document.querySelectorAll('.color').forEach(button=>button.addEventListener('click',()=>{
    document.querySelectorAll('.color').forEach(b=>b.classList.toggle('selected',b===button));
    engine.setColor(button.dataset.color);
  }));
  window.ShizukuEngine4Alpha=ShizukuEngine4Alpha;
  console.info('Shizuku Engine 4.0 alpha v0.3 Performance Stabilization');
})();
