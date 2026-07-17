(function(global){
  'use strict';

  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const smoothstep=(a,b,x)=>{ const t=clamp((x-a)/(b-a),0,1); return t*t*(3-2*t); };
  function hexToRgb(hex){
    const h=String(hex||'#000').replace('#','');
    const v=h.length===3?h.split('').map(x=>x+x).join(''):h;
    const n=parseInt(v,16)||0;
    return {r:(n>>16)&255,g:(n>>8)&255,b:n&255};
  }

  class PaintPhysicsField{
    constructor(size=56){
      this.n=size;
      const c=size*size;
      this.amount=new Float32Array(c);
      this.wet=new Float32Array(c);
      this.height=new Float32Array(c);
      this.r=new Float32Array(c);
      this.g=new Float32Array(c);
      this.b=new Float32Array(c);
      this.vx=new Float32Array(c);
      this.vy=new Float32Array(c);

      // Shizuku M1: a separate elastic surface. Keeping this independent from
      // pigment transport lets paint visibly dent and rebound without losing it.
      this.deform=new Float32Array(c);
      this.deformVelocity=new Float32Array(c);
      this.nextDeform=new Float32Array(c);
      this.nextDeformVelocity=new Float32Array(c);
      this.activePress=null;
      this.pressAge=0;

      this._surface=document.createElement('canvas');
      this._surfaceCtx=this._surface.getContext('2d',{alpha:true});
      this._imageData=null;
      this.dirty=true;
    }
    clear(){
      for(const a of [this.amount,this.wet,this.height,this.r,this.g,this.b,this.vx,this.vy,
        this.deform,this.deformVelocity,this.nextDeform,this.nextDeformVelocity]) a.fill(0);
      this.activePress=null;
      this.pressAge=0;
      this.dirty=true;
    }
    idx(x,y){return y*this.n+x;}
    forCircle(nx,ny,nr,fn){
      const n=this.n, cx=nx*(n-1), cy=ny*(n-1), rr=Math.max(1,nr*n);
      const x0=Math.max(1,Math.floor(cx-rr)),x1=Math.min(n-2,Math.ceil(cx+rr));
      const y0=Math.max(1,Math.floor(cy-rr)),y1=Math.min(n-2,Math.ceil(cy+rr));
      for(let y=y0;y<=y1;y++) for(let x=x0;x<=x1;x++){
        const dx=x-cx,dy=y-cy,d=Math.hypot(dx,dy)/rr;
        if(d<=1) fn(this.idx(x,y),x,y,1-d,dx,dy,rr,d);
      }
    }
    deposit(nx,ny,nr,color,amount=.7,water=0){
      const c=hexToRgb(color);
      this.forCircle(nx,ny,nr,(i,x,y,w)=>{
        const add=amount*w*w;
        const old=this.amount[i], total=old+add;
        if(total>0){
          this.r[i]=(this.r[i]*old+c.r*add)/total;
          this.g[i]=(this.g[i]*old+c.g*add)/total;
          this.b[i]=(this.b[i]*old+c.b*add)/total;
        }
        this.amount[i]=Math.min(3,total);
        this.height[i]=Math.min(2.4,this.height[i]+add*.9);
        this.wet[i]=Math.min(1,this.wet[i]+.4+water);
      });
      this.dirty=true;
    }
    addWater(nx,ny,nr,amount=.8){
      this.forCircle(nx,ny,nr,(i,x,y,w)=>{
        this.wet[i]=Math.min(1,this.wet[i]+amount*w);
        this.height[i]=Math.max(0,this.height[i]-.06*w);
      });
      this.dirty=true;
    }

    beginPress(nx,ny,nr=.13,strength=.95){
      this.activePress={x:clamp(nx,0,1),y:clamp(ny,0,1),r:nr,strength};
      this.pressAge=0;
      this._injectPressImpulse(this.activePress,1.35);
    }
    updatePress(nx,ny,nr=.13,strength=.95){
      if(!this.activePress) this.beginPress(nx,ny,nr,strength);
      else Object.assign(this.activePress,{x:clamp(nx,0,1),y:clamp(ny,0,1),r:nr,strength});
    }
    endPress(){
      if(this.activePress){
        // A small upward impulse creates one soft, quickly damped "ぷるん".
        this.forCircle(this.activePress.x,this.activePress.y,this.activePress.r*1.15,
          (i,x,y,w,dx,dy,rr,d)=>{
            if(this.amount[i]<.012) return;
            const center=Math.exp(-d*d*4.8);
            this.deformVelocity[i]+=center*.75;
          });
      }
      this.activePress=null;
      this.pressAge=0;
    }
    press(nx,ny,nr,strength=.7){
      this.beginPress(nx,ny,nr,strength);
      this.endPress();
    }
    _injectPressImpulse(press,scale=1){
      this.forCircle(press.x,press.y,press.r*1.35,(i,x,y,w,dx,dy,rr,d)=>{
        if(this.amount[i]<.012) return;
        const center=Math.exp(-d*d*7.2);
        const rim=Math.exp(-Math.pow(d-.67,2)/.028);
        // Center sinks; displaced paint rises as a soft annular ridge.
        const target=(-1.28*center + .52*rim) * press.strength;
        this.deformVelocity[i]+=target*scale;
      });
      this.dirty=true;
    }
    drag(fx,fy,tx,ty,nr,strength=.9){
      const dx=(tx-fx)*this.n,dy=(ty-fy)*this.n;
      this.updatePress(tx,ty,nr,Math.min(1.15,strength*.82));
      this.forCircle(tx,ty,nr,(i,x,y,w)=>{
        if(this.amount[i]<.005) return;
        this.vx[i]+=dx*w*strength*.2;
        this.vy[i]+=dy*w*strength*.2;
        this.height[i]=Math.min(2.5,this.height[i]+w*.03);
      });
      this.dirty=true;
    }

    homogenize(color, strength=.12, flatten=.04){
      const c=hexToRgb(color);
      const k=clamp(strength,0,1);
      for(let i=0;i<this.amount.length;i++){
        if(this.amount[i]<.005) continue;
        this.r[i]+=(c.r-this.r[i])*k;
        this.g[i]+=(c.g-this.g[i])*k;
        this.b[i]+=(c.b-this.b[i])*k;
        this.height[i]+=(Math.min(1.25,this.amount[i]) - this.height[i])*clamp(flatten,0,1);
        this.vx[i]*=(1-k*.55);
        this.vy[i]*=(1-k*.55);
      }
      this.dirty=true;
    }
    setUniformColor(color){ this.homogenize(color,1,.32); }

    _stepElastic(dt){
      const n=this.n;
      if(this.activePress){
        this.pressAge+=dt;
        // Continuous, pressure-like forcing rather than a one-frame animation.
        const settle=clamp(.62+this.pressAge*.7,.62,1.18);
        this._injectPressImpulse(this.activePress,dt*18*settle);
      }
      const spring=24;
      const coupling=18;
      const damping=Math.pow(.10,dt); // stable across refresh rates
      const dv=this.deformVelocity, d=this.deform;
      const nd=this.nextDeform, nv=this.nextDeformVelocity;
      nd.fill(0); nv.fill(0);
      for(let y=1;y<n-1;y++) for(let x=1;x<n-1;x++){
        const i=this.idx(x,y);
        if(this.amount[i]<.003){ continue; }
        const lap=d[i-1]+d[i+1]+d[i-n]+d[i+n]-4*d[i];
        let v=dv[i] + (-spring*d[i] + coupling*lap)*dt;
        v*=damping;
        let z=d[i]+v*dt;
        z=clamp(z,-1.55,1.05);
        nv[i]=v; nd[i]=z;
      }
      this.deform.set(nd);
      this.deformVelocity.set(nv);
    }

    step(dt=.016){
      const n=this.n;
      this._stepElastic(dt);
      const nextAmount=new Float32Array(this.amount.length);
      const nextWet=new Float32Array(this.wet.length);
      const nextHeight=new Float32Array(this.height.length);
      const nextR=new Float32Array(this.r.length),nextG=new Float32Array(this.g.length),nextB=new Float32Array(this.b.length);
      for(let y=1;y<n-1;y++) for(let x=1;x<n-1;x++){
        const i=this.idx(x,y), a=this.amount[i];
        if(a<.0005) continue;
        const damp=.88;
        this.vx[i]*=damp; this.vy[i]*=damp;
        const tx=clamp(Math.round(x+this.vx[i]*dt*18),1,n-2);
        const ty=clamp(Math.round(y+this.vy[i]*dt*18),1,n-2);
        const j=this.idx(tx,ty);
        const move=clamp((Math.abs(this.vx[i])+Math.abs(this.vy[i]))*.012 + this.wet[i]*.015,0,.16);
        const stay=1-move;
        const add=(arr,val)=>{arr[i]+=val*stay;arr[j]+=val*move;};
        add(nextAmount,a); add(nextWet,this.wet[i]); add(nextHeight,this.height[i]);
        add(nextR,this.r[i]*a); add(nextG,this.g[i]*a); add(nextB,this.b[i]*a);
      }
      for(let i=0;i<this.amount.length;i++){
        const a=nextAmount[i];
        if(a>.0001){ nextR[i]/=a; nextG[i]/=a; nextB[i]/=a; }
        this.amount[i]=a;
        this.wet[i]=Math.max(0,nextWet[i]-.0007);
        this.height[i]=nextHeight[i]+(a-nextHeight[i])*.018;
        this.r[i]=nextR[i];this.g[i]=nextG[i];this.b[i]=nextB[i];
      }
      this.dirty=true;
    }

    _sample(arr,gx,gy){
      const n=this.n;
      const x=clamp(gx,0,n-1.001), y=clamp(gy,0,n-1.001);
      const x0=x|0,y0=y|0,x1=Math.min(n-1,x0+1),y1=Math.min(n-1,y0+1);
      const fx=x-x0,fy=y-y0;
      const a=arr[this.idx(x0,y0)]*(1-fx)+arr[this.idx(x1,y0)]*fx;
      const b=arr[this.idx(x0,y1)]*(1-fx)+arr[this.idx(x1,y1)]*fx;
      return a*(1-fy)+b*fy;
    }

    render(ctx,size){
      const scale=3;
      const w=this.n*scale,h=this.n*scale;
      if(this._surface.width!==w||this._surface.height!==h){
        this._surface.width=w; this._surface.height=h;
        this._imageData=this._surfaceCtx.createImageData(w,h);
      }
      const data=this._imageData.data;
      const n=this.n;
      for(let py=0;py<h;py++){
        const gy=py/(h-1)*(n-1);
        for(let px=0;px<w;px++){
          const gx=px/(w-1)*(n-1);
          const o=(py*w+px)*4;
          const amount=this._sample(this.amount,gx,gy);
          if(amount<.006){ data[o]=data[o+1]=data[o+2]=data[o+3]=0; continue; }
          const wet=this._sample(this.wet,gx,gy);
          const baseHeight=this._sample(this.height,gx,gy);
          const deform=this._sample(this.deform,gx,gy);
          const z=baseHeight+deform*.72;
          const eps=.72;
          const zx=this._sample(this.height,gx+eps,gy)+this._sample(this.deform,gx+eps,gy)*.72
                  -this._sample(this.height,gx-eps,gy)-this._sample(this.deform,gx-eps,gy)*.72;
          const zy=this._sample(this.height,gx,gy+eps)+this._sample(this.deform,gx,gy+eps)*.72
                  -this._sample(this.height,gx,gy-eps)-this._sample(this.deform,gx,gy-eps)*.72;
          // Soft top-left studio light. The depressed center darkens while the
          // raised rim catches light, making the deformation readable instantly.
          const normalLight=clamp(.56-zx*.42-zy*.48,0,1);
          const depthShade=clamp(deform<0 ? deform*.22 : deform*.10,-.28,.18);
          const gloss=Math.pow(normalLight,5)*(0.12+wet*.32);
          const rr=this._sample(this.r,gx,gy),gg=this._sample(this.g,gx,gy),bb=this._sample(this.b,gx,gy);
          const shade=clamp(.78+normalLight*.32+depthShade,0.52,1.18);
          data[o]=clamp(rr*shade+255*gloss,0,255);
          data[o+1]=clamp(gg*shade+255*gloss,0,255);
          data[o+2]=clamp(bb*shade+255*gloss,0,255);
          data[o+3]=255*smoothstep(.006,.12,amount)*clamp(.30+amount*.30,0,.84);
        }
      }
      this._surfaceCtx.putImageData(this._imageData,0,0);
      ctx.clearRect(0,0,size,size);
      ctx.save();
      ctx.imageSmoothingEnabled=true;
      ctx.imageSmoothingQuality='high';
      ctx.filter='blur(0.65px)';
      ctx.drawImage(this._surface,0,0,size,size);
      ctx.restore();
      this.dirty=false;
    }
  }
  global.YubisakiPhysics={PaintPhysicsField};
})(window);
