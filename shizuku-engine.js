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
      this.colorCanvas = document.createElement('canvas');
      this.colorCtx = this.colorCanvas.getContext('2d');
      this.colorBuckets = new Map();
      this.particles = [];
      this.bonds = [];
      this.bondKeys = new Set();
      this.maxBonds = 2600;
      this.nextClumpId = 1;
      this.lastRebondAt = 0;
      this.clumpTopologyDirty = false;
      this.maxParticles = 720;
      this.initialParticles = 420;
      this.spawnPerAdd = 54;
      this.reserveParticles = 90;
      this.softParticleLimit = this.maxParticles - this.reserveParticles;
      this.addCount = 0;
      this.lastAddedRgb = { r:232, g:74, b:104 };
      this.lastCompactionAt = 0;
      this.hash = new SpatialHash(16);
      this.neighborBuffer = [];
      this.color = '#e84a68';
      this.rgb = this.hexToRgb(this.color);
      this.pointer = { down:false, id:null, x:0, y:0, px:0, py:0, vx:0, vy:0, pressure:.7, justReleased:0, grabbed:new Map(), anchorX:0, anchorY:0, lastCapture:0 };
      this.maxGrabbed = 82;
      this.viscosity = 0.76;
      this.elasticRecovery = 0.34;
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
      this.seedBlob(.5, .55, this.initialParticles);
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
      this.maskCanvas.width = this.shadeCanvas.width = this.colorCanvas.width = Math.max(180, Math.round(this.w * this.renderScale));
      this.maskCanvas.height = this.shadeCanvas.height = this.colorCanvas.height = Math.max(180, Math.round(this.h * this.renderScale));
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
      this.bonds.length = 0;
      this.bondKeys.clear();
      this.nextClumpId = 1;
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
      const startIndex = this.particles.length;
      const clumpId = this.nextClumpId++;
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
          restX: 0, restY: 0,
          strain: 0,
          memoryVx: 0, memoryVy: 0,
          clumpId,
          pigment: { r:this.rgb.r, g:this.rgb.g, b:this.rgb.b },
          bondDegree: 0,
          detached: false,
          bornAt: performance.now()
        });
      }
      this.fixedMass = this.particles.length;
      this.buildBondsForRange(startIndex, this.particles.length);
      this.updateMassLabel();
      this.wake(2200);
      return spawnCount;
    }

    colorDistance(a, b) {
      const dr=a.r-b.r, dg=a.g-b.g, db=a.b-b.b;
      return Math.sqrt(dr*dr + dg*dg + db*db);
    }

    rebuildAllBonds() {
      this.bonds.length = 0;
      this.bondKeys.clear();
      for (const p of this.particles) p.bondDegree = 0;
      this.buildBondsForRange(0, this.particles.length);
    }

    compactPaint(removeCount, reason = 'budget') {
      const safeMinimum = 300;
      const count = Math.min(removeCount, Math.max(0, this.particles.length - safeMinimum));
      if (count <= 0) return 0;

      this.rebuildHash();
      const now = performance.now();
      const scored = [];
      for (let i=0; i<this.particles.length; i++) {
        if (this.pointer.grabbed.has(i)) continue;
        const p=this.particles[i];
        const near=this.hash.nearbyInto(p.x,p.y,this.neighborBuffer);
        let close=0, colourSpread=0;
        for (const j of near) {
          if (j===i) continue;
          const q=this.particles[j];
          const d=Math.hypot(q.x-p.x,q.y-p.y);
          if (d<this.particleRadius*1.75) {
            close++;
            colourSpread += this.colorDistance(p.pigment,q.pigment);
          }
        }
        const speed=Math.hypot(p.vx,p.vy);
        const age=Math.min(1,(now-(p.bornAt||0))/5000);
        const uniformity=close ? 1-clamp(colourSpread/(close*180),0,1) : 0;
        // Old, quiet particles in dense/uniform paint are least visible when
        // consolidated. Edge particles, fresh colour and moving streaks survive.
        const score=close*1.5 + uniformity*5 + age*2.5 - speed*2.2 - (p.detached?4:0);
        scored.push([score,i]);
      }
      scored.sort((a,b)=>b[0]-a[0]);
      const remove=new Set(scored.slice(0,count).map(v=>v[1]));
      if (!remove.size) return 0;
      this.particles=this.particles.filter((_,i)=>!remove.has(i));
      this.pointer.grabbed.clear();
      this.rebuildAllBonds();
      this.fixedMass=this.particles.length;
      this.lastCompactionAt=now;
      this.renderDirty=true;
      return remove.size;
    }

    addPaint() {
      const colourChanged=this.colorDistance(this.rgb,this.lastAddedRgb)>42;
      // A new colour gets priority: gently consolidate old, settled paint so
      // children can always introduce another pigment. Same-colour taps use
      // smaller portions, giving a much wider range of amounts.
      if (colourChanged && this.particles.length>470) this.compactPaint(24,'new-colour');

      const needed=Math.max(0, this.particles.length + this.spawnPerAdd - this.softParticleLimit);
      if (needed>0) this.compactPaint(Math.max(needed, this.spawnPerAdd),'reserve');

      // The hard cap is never exceeded. If consolidation could not free enough
      // slots, recycle another settled patch rather than disabling the button.
      const hardNeeded=Math.max(0, this.particles.length + this.spawnPerAdd - this.maxParticles);
      if (hardNeeded>0) this.compactPaint(hardNeeded + 12,'hard-cap');

      const x = .5 + (Math.random() - .5) * .22;
      const y = .54 + (Math.random() - .5) * .14;
      const added=this.seedBlob(x, y, this.spawnPerAdd);
      this.addCount++;
      this.lastAddedRgb={...this.rgb};
      this.updateMassLabel();
      return added;
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
        Object.assign(this.pointer, { down:true, id:e.pointerId, x:p.x, y:p.y, px:p.x, py:p.y, vx:0, vy:0, pressure:e.pressure || .72, anchorX:p.x, anchorY:p.y, lastCapture:performance.now() });
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
      this.capturePaint(true);
    }

    capturePaint(initial = false) {
      const pnt = this.pointer;
      const radius = Math.min(this.w, this.h) * (initial ? .090 : .070);
      const candidates = [];
      for (let i = 0; i < this.particles.length; i++) {
        if (pnt.grabbed.has(i)) continue;
        const p = this.particles[i];
        const dx = p.x - pnt.anchorX, dy = p.y - pnt.anchorY;
        const d = Math.hypot(dx, dy);
        if (d < radius) candidates.push([d, i, dx, dy]);
      }
      candidates.sort((a,b) => a[0]-b[0]);
      const room = Math.max(0, this.maxGrabbed - pnt.grabbed.size);
      const limit = Math.min(room, initial ? 60 : 10, candidates.length);
      for (let n = 0; n < limit; n++) {
        const [d, i, dx, dy] = candidates[n];
        const radial = 1 - d / radius;
        pnt.grabbed.set(i, {
          ox: dx,
          oy: dy,
          strength: clamp(.28 + radial * .72, .28, 1),
          age: 0
        });
      }
    }

    bondKey(a, b) {
      return a < b ? `${a}:${b}` : `${b}:${a}`;
    }

    addBond(a, b, restLength, strength = 1) {
      if (a === b || this.bonds.length >= this.maxBonds) return false;
      const key = this.bondKey(a, b);
      if (this.bondKeys.has(key)) return false;
      this.bondKeys.add(key);
      this.bonds.push({ a, b, rest:restLength, strength, active:true, strain:0 });
      this.particles[a].bondDegree++;
      this.particles[b].bondDegree++;
      return true;
    }

    buildBondsForRange(start, end) {
      this.rebuildHash();
      const linkRadius = this.particleRadius * 2.05;
      const candidates = [];
      for (let i = start; i < end; i++) {
        const p = this.particles[i];
        const near = this.hash.nearbyInto(p.x, p.y, this.neighborBuffer);
        candidates.length = 0;
        for (const j of near) {
          if (j === i) continue;
          const q = this.particles[j];
          const d = Math.hypot(q.x-p.x, q.y-p.y);
          if (d <= linkRadius) candidates.push([d, j]);
        }
        candidates.sort((a,b)=>a[0]-b[0]);
        const desired = 4;
        for (let n=0; n<Math.min(desired,candidates.length); n++) {
          const [d,j] = candidates[n];
          this.addBond(i,j,d, .82 + Math.random()*.26);
        }
      }
    }

    applyClumpBonds(sdt) {
      const pnt = this.pointer;
      const fingerSpeed = Math.hypot(pnt.vx,pnt.vy);
      let broke = false;
      for (const bond of this.bonds) {
        if (!bond.active) continue;
        const a=this.particles[bond.a], b=this.particles[bond.b];
        const dx=b.x-a.x, dy=b.y-a.y;
        const d=Math.max(.001,Math.hypot(dx,dy));
        const stretch=(d-bond.rest)/Math.max(1,bond.rest);
        bond.strain=lerp(bond.strain,Math.max(0,stretch),.18);
        const rvx=b.vx-a.vx, rvy=b.vy-a.vy;
        const separating=(rvx*dx+rvy*dy)/d;
        const edgeWeakness=((a.bondDegree<=2)||(b.bondDegree<=2)) ? .16 : 0;
        const tearAt=.78 + bond.strength*.20 - edgeWeakness;
        const violent=separating>2.8 || fingerSpeed>13;
        if (stretch>tearAt && violent) {
          bond.active=false;
          this.bondKeys.delete(this.bondKey(bond.a,bond.b));
          a.bondDegree=Math.max(0,a.bondDegree-1);
          b.bondDegree=Math.max(0,b.bondDegree-1);
          const impulse=Math.min(1.35,stretch*.72);
          const nx=dx/d, ny=dy/d;
          a.vx-=nx*impulse; a.vy-=ny*impulse;
          b.vx+=nx*impulse; b.vy+=ny*impulse;
          a.detached=a.bondDegree<2; b.detached=b.bondDegree<2;
          broke=true;
          continue;
        }
        const nx=dx/d, ny=dy/d;
        const spring=clamp(stretch,-.24,1.15)*24*bond.strength*sdt;
        a.vx+=nx*spring; a.vy+=ny*spring;
        b.vx-=nx*spring; b.vy-=ny*spring;
        const match=(.20 + this.viscosity*.28)*bond.strength;
        const mvx=(b.vx-a.vx)*match*sdt, mvy=(b.vy-a.vy)*match*sdt;
        a.vx+=mvx; a.vy+=mvy; b.vx-=mvx; b.vy-=mvy;
      }
      if (broke) this.clumpTopologyDirty=true;
    }

    attemptRebond(now) {
      const pnt=this.pointer;
      const fingerSpeed=Math.hypot(pnt.vx,pnt.vy);
      if (!pnt.down || fingerSpeed>7 || now-this.lastRebondAt<150) return;
      this.lastRebondAt=now;
      this.rebuildHash();
      const radius=this.particleRadius*1.72;
      let made=0;
      for (let i=0;i<this.particles.length && made<10;i++) {
        const p=this.particles[i];
        if (Math.hypot(p.x-pnt.x,p.y-pnt.y)>Math.min(this.w,this.h)*.15) continue;
        const near=this.hash.nearbyInto(p.x,p.y,this.neighborBuffer);
        for (const j of near) {
          if (j<=i || made>=10) continue;
          const q=this.particles[j];
          const d=Math.hypot(q.x-p.x,q.y-p.y);
          const rel=Math.hypot(q.vx-p.vx,q.vy-p.vy);
          if (d<radius && rel<2.4 && this.addBond(i,j,d,.72)) {
            made++;
            p.detached=q.detached=false;
            const merged=Math.min(p.clumpId,q.clumpId);
            p.clumpId=q.clumpId=merged;
          }
        }
      }
    }

    mixPigments(sdt) {
      // Pigment is transported between touching particles instead of replacing
      // both colours at once. Gentle contact diffuses slowly; kneading and shear
      // accelerate exchange, leaving visible marbling before a uniform result.
      const pnt = this.pointer;
      const fingerSpeed = Math.hypot(pnt.vx, pnt.vy);
      const contactRadius = this.particleRadius * 1.72;
      const contactRadius2 = contactRadius * contactRadius;
      for (let i = 0; i < this.particles.length; i++) {
        const a = this.particles[i];
        const near = this.hash.nearbyInto(a.x, a.y, this.neighborBuffer);
        for (const j of near) {
          if (j <= i) continue;
          const b = this.particles[j];
          const dx = b.x - a.x, dy = b.y - a.y;
          const d2 = dx * dx + dy * dy;
          if (d2 <= .0001 || d2 > contactRadius2) continue;

          const closeness = 1 - Math.sqrt(d2) / contactRadius;
          const relativeSpeed = Math.hypot(b.vx - a.vx, b.vy - a.vy);
          const nearFinger = pnt.down && (
            Math.hypot(a.x - pnt.x, a.y - pnt.y) < contactRadius * 5.2 ||
            Math.hypot(b.x - pnt.x, b.y - pnt.y) < contactRadius * 5.2
          );
          const knead = nearFinger ? clamp((relativeSpeed + fingerSpeed * .55) / 15, 0, 1) : 0;
          const rate = (.055 + knead * .72) * closeness * sdt;
          if (rate <= 0) continue;

          const ar = a.pigment.r, ag = a.pigment.g, ab = a.pigment.b;
          const br = b.pigment.r, bg = b.pigment.g, bb = b.pigment.b;
          a.pigment.r += (br - ar) * rate;
          a.pigment.g += (bg - ag) * rate;
          a.pigment.b += (bb - ab) * rate;
          b.pigment.r += (ar - br) * rate;
          b.pigment.g += (ag - bg) * rate;
          b.pigment.b += (ab - bb) * rate;
        }
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

        if (pnt.down) {
          // The grip point deliberately trails the finger. That delay is what
          // makes the paint feel held rather than merely pushed.
          const fingerSpeed = Math.hypot(pnt.vx, pnt.vy);
          const follow = clamp(.20 + fingerSpeed * .012, .20, .52);
          pnt.anchorX = lerp(pnt.anchorX, pnt.x, follow);
          pnt.anchorY = lerp(pnt.anchorY, pnt.y, follow);
          const now = performance.now();
          if (now - pnt.lastCapture > 85 && pnt.grabbed.size < this.maxGrabbed) {
            this.capturePaint(false);
            pnt.lastCapture = now;
          }
        }

        this.applyClumpBonds(sdt);
        this.mixPigments(sdt);
        this.attemptRebond(performance.now());

        for (let i=0;i<this.particles.length;i++) {
          const p=this.particles[i];
          p.px=p.x; p.py=p.y;

          // Viscosity 1.0: velocity does not disappear instantly. A small
          // history term remains, so the paint arrives and stops just after the finger.
          const speedNow=Math.hypot(p.vx,p.vy);
          const shear=clamp(speedNow/18,0,1);
          const viscousDrag=lerp(.040,.105,shear);
          p.vx *= Math.pow(viscousDrag, sdt);
          p.vy *= Math.pow(viscousDrag, sdt);
          p.memoryVx=lerp(p.memoryVx,p.vx,.12);
          p.memoryVy=lerp(p.memoryVy,p.vy,.12);
          p.vx += p.memoryVx*.018;
          p.vy += p.memoryVy*.018;
          p.vy += (p.detached ? 13 : 9) * sdt;

          const near=this.hash.nearbyInto(p.x,p.y,this.neighborBuffer);
          let cx=0, cy=0, cvx=0, cvy=0, count=0;
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
            cx += q.x; cy += q.y; cvx += q.vx; cvy += q.vy; count++;
          }
          if (count>1) {
            cx/=count; cy/=count; cvx/=count; cvy/=count;
            // Local momentum sharing is the core of the viscous feel: nearby paint
            // resists sliding apart and begins moving as one heavy, wet mass.
            const velocityMatch=(.90 + this.viscosity*1.45)*(1-shear*.34);
            p.vx += (cvx-p.vx)*velocityMatch*sdt;
            p.vy += (cvy-p.vy)*velocityMatch*sdt;
            p.vx += (cx-p.x)*0.66*sdt;
            p.vy += (cy-p.y)*0.66*sdt;

            const localStretch=Math.hypot(cx-p.x,cy-p.y)/Math.max(1,target);
            p.strain=lerp(p.strain,clamp(localStretch,0,1.8),.08);
          }

          // Grip propagates through nearby paint. A directly held patch drags
          // its neighbours, producing a neck instead of isolated flying dots.
          if (pnt.down && !pnt.grabbed.has(i)) {
            let tx=0, ty=0, linked=0;
            for (const j of near) {
              const held=pnt.grabbed.get(j);
              if (!held) continue;
              const q=this.particles[j];
              tx += q.x; ty += q.y; linked++;
            }
            if (linked) {
              tx/=linked; ty/=linked;
              const coupling=Math.min(1, linked*.22) * (p.detached ? .48 : 1);
              p.vx += (tx-p.x)*1.75*coupling*sdt;
              p.vy += (ty-p.y)*1.75*coupling*sdt;
            }
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

          // Grip Constraint 2.0: particles are attached to a lagging anchor,
          // preserving a soft patch shape. Slow pulls stretch; fast pulls tear.
          const grab=pnt.grabbed.get(i);
          if (pnt.down && grab) {
            grab.age += sdt;
            const shapeRetention = lerp(.50, .28, clamp(grab.age * .55, 0, 1));
            const targetX=pnt.anchorX + grab.ox*shapeRetention;
            const targetY=pnt.anchorY + grab.oy*shapeRetention;
            const gx=targetX-p.x, gy=targetY-p.y;
            const stretch=Math.hypot(gx,gy);
            const fingerSpeed=Math.hypot(pnt.vx,pnt.vy);
            // Slow motion behaves more like a long sticky thread; fast motion
            // shear-thins and becomes easier to tear.
            const slowPull=1-clamp(fingerSpeed/22,0,1);
            const spring=(12 + grab.strength*15)*(1 + slowPull*.34);
            p.vx += gx*spring*sdt;
            p.vy += gy*spring*sdt;
            p.vx += pnt.vx*(.09 + grab.strength*.13);
            p.vy += pnt.vy*(.09 + grab.strength*.13);

            const speedPenalty=clamp(fingerSpeed/22,0,.76);
            const ageToughness=clamp(grab.age*.26,0,.22);
            const breakDistance=pointerRadius*(1.96 - speedPenalty + grab.strength*.28 + slowPull*.26 + ageToughness);
            if (stretch>breakDistance) pnt.grabbed.delete(i);
          }
          if (!pnt.down && pnt.justReleased>0 && dist<pointerRadius*1.28) {
            const t=1-dist/(pointerRadius*1.28);
            // The stretched mass relaxes gradually rather than snapping back.
            const recovery=this.elasticRecovery*(.55+p.strain*.45);
            p.vx += -dx*recovery*t*pnt.justReleased*sdt;
            p.vy += -dy*recovery*t*pnt.justReleased*sdt;
            p.vx += p.memoryVx*.025*t;
            p.vy += p.memoryVy*.025*t;
          }

          p.strain*=Math.pow(.20,sdt);
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
        const scale=p.detached ? .82 : 1;
        const sw=sprite.width*scale, sh=sprite.height*scale;
        c.drawImage(sprite,p.x*this.sx-sw/2,p.y*this.sy-sh/2,sw,sh);
      }
      c.restore();
    }

    renderColorField() {
      const c = this.colorCtx;
      const mw = this.colorCanvas.width, mh = this.colorCanvas.height;
      c.clearRect(0, 0, mw, mh);
      this.colorBuckets.clear();

      // Quantisation keeps the number of draw-state changes low while retaining
      // enough steps for visible red/blue/purple marbling.
      for (const p of this.particles) {
        const r = clamp(Math.round(p.pigment.r / 12) * 12, 0, 255);
        const g = clamp(Math.round(p.pigment.g / 12) * 12, 0, 255);
        const b = clamp(Math.round(p.pigment.b / 12) * 12, 0, 255);
        const key = `${r},${g},${b}`;
        let bucket = this.colorBuckets.get(key);
        if (!bucket) {
          bucket = { r, g, b, points: [] };
          this.colorBuckets.set(key, bucket);
        }
        bucket.points.push(p);
      }

      const rr = this.particleRadius * 1.58 * Math.min(this.sx, this.sy);
      c.save();
      c.globalAlpha = .78;
      for (const bucket of this.colorBuckets.values()) {
        c.fillStyle = `rgb(${bucket.r},${bucket.g},${bucket.b})`;
        c.beginPath();
        for (const p of bucket.points) {
          const x = p.x * this.sx, y = p.y * this.sy;
          c.moveTo(x + rr, y);
          c.arc(x, y, p.detached ? rr * .78 : rr, 0, Math.PI * 2);
        }
        c.fill();
      }
      c.restore();
    }

    render() {
      this.renderMask();
      this.renderColorField();
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

      // Multi-pigment body. The colour field follows individual particles,
      // while the density mask preserves one continuous wet paint surface.
      ctx.save();
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.filter = `blur(${Math.max(2.2,this.particleRadius*.22)}px) saturate(112%) contrast(118%)`;
      ctx.drawImage(this.colorCanvas, 0, 0, this.w, this.h);
      ctx.globalCompositeOperation = 'destination-in';
      ctx.filter = `blur(${Math.max(1.5,this.particleRadius*.14)}px) contrast(160%)`;
      ctx.drawImage(this.maskCanvas, 0, 0, this.w, this.h);
      ctx.restore();

      // Broad translucent lighting keeps mixed colours readable without flattening
      // the marble streaks into a single gradient.
      ctx.save();
      ctx.globalCompositeOperation = 'source-atop';
      const bodyLight = ctx.createLinearGradient(0, 0, this.w, this.h);
      bodyLight.addColorStop(0, 'rgba(255,255,255,.24)');
      bodyLight.addColorStop(.48, 'rgba(255,255,255,.03)');
      bodyLight.addColorStop(1, 'rgba(44,22,28,.18)');
      ctx.fillStyle = bodyLight;
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

      // Fine wet glints follow moving particles and expose viscous flow direction.
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
      if (el) el.textContent=`${this.addCount}かい 追加`;
      const button=document.getElementById('addPaintButton');
      if (button) {
        button.disabled=false;
        button.textContent='＋ えのぐを たす';
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
  console.info('Shizuku Engine 4.0 alpha v0.8 Paint Budget System');
})();
