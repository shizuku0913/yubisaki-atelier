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

    _smoothInto(source,target,passes=2){
      const n=this.n;
      if(!this._blurTemp || this._blurTemp.length!==source.length){
        this._blurTemp=new Float32Array(source.length);
      }
      let input=source, output=target, temp=this._blurTemp;
      for(let pass=0; pass<passes; pass++){
        for(let y=0;y<n;y++) for(let x=0;x<n;x++){
          const i=this.idx(x,y);
          const xm2=Math.max(0,x-2), xm1=Math.max(0,x-1), xp1=Math.min(n-1,x+1), xp2=Math.min(n-1,x+2);
          temp[i]=(input[this.idx(xm2,y)] + 4*input[this.idx(xm1,y)] + 6*input[i] + 4*input[this.idx(xp1,y)] + input[this.idx(xp2,y)]) / 16;
        }
        for(let y=0;y<n;y++) for(let x=0;x<n;x++){
          const i=this.idx(x,y);
          const ym2=Math.max(0,y-2), ym1=Math.max(0,y-1), yp1=Math.min(n-1,y+1), yp2=Math.min(n-1,y+2);
          output[i]=(temp[this.idx(x,ym2)] + 4*temp[this.idx(x,ym1)] + 6*temp[i] + 4*temp[this.idx(x,yp1)] + temp[this.idx(x,yp2)]) / 16;
        }
        if(pass<passes-1){
          input=output;
          output = output===target ? new Float32Array(source.length) : target;
        }
      }
      if(output!==target) target.set(output);
    }

    _catmull(arr,gx,gy){
      const n=this.n;
      const x=clamp(gx,0,n-1), y=clamp(gy,0,n-1);
      const ix=Math.floor(x), iy=Math.floor(y), fx=x-ix, fy=y-iy;
      const cubic=(p0,p1,p2,p3,t)=>{
        const a0=-.5*p0+1.5*p1-1.5*p2+.5*p3;
        const a1=p0-2.5*p1+2*p2-.5*p3;
        const a2=-.5*p0+.5*p2;
        return ((a0*t+a1)*t+a2)*t+p1;
      };
      const rows=[];
      for(let m=-1;m<=2;m++){
        const yy=clamp(iy+m,0,n-1);
        const p=[];
        for(let k=-1;k<=2;k++) p.push(arr[this.idx(clamp(ix+k,0,n-1),yy)]);
        rows.push(cubic(p[0],p[1],p[2],p[3],fx));
      }
      return cubic(rows[0],rows[1],rows[2],rows[3],fy);
    }

    render(ctx,size){
      // Organic Renderer: blur the simulation lattice into continuous scalar
      // fields, then reconstruct it with bicubic interpolation. The visible
      // boundary is an implicit contour, not a row of grid cells.
      const c=this.amount.length;
      if(!this._smoothAmount || this._smoothAmount.length!==c){
        this._smoothAmount=new Float32Array(c);
        this._smoothHeight=new Float32Array(c);
        this._smoothDeform=new Float32Array(c);
        this._smoothWet=new Float32Array(c);
        this._smoothR=new Float32Array(c);
        this._smoothG=new Float32Array(c);
        this._smoothB=new Float32Array(c);
      }
      this._smoothInto(this.amount,this._smoothAmount,2);
      this._smoothInto(this.height,this._smoothHeight,2);
      this._smoothInto(this.deform,this._smoothDeform,2);
      this._smoothInto(this.wet,this._smoothWet,1);
      this._smoothInto(this.r,this._smoothR,1);
      this._smoothInto(this.g,this._smoothG,1);
      this._smoothInto(this.b,this._smoothB,1);

      const scale=4;
      const w=this.n*scale,h=this.n*scale;
      if(this._surface.width!==w||this._surface.height!==h){
        this._surface.width=w; this._surface.height=h;
        this._imageData=this._surfaceCtx.createImageData(w,h);
      }
      const data=this._imageData.data;
      const n=this.n;
      for(let py=0;py<h;py++){
        const gy0=py/(h-1)*(n-1);
        for(let px=0;px<w;px++){
          const gx0=px/(w-1)*(n-1);
          // Sub-pixel flow warp breaks any remaining axis-aligned contour
          // without adding noisy bumps to the silhouette.
          const warp=.12*Math.sin(gy0*.43)+.07*Math.sin((gx0+gy0)*.21);
          const gx=gx0+warp, gy=gy0+.10*Math.sin(gx0*.37)-warp*.35;
          const o=(py*w+px)*4;
          const amount=Math.max(0,this._catmull(this._smoothAmount,gx,gy));
          const alpha=smoothstep(.004,.105,amount)*clamp(.34+amount*.34,0,.90);
          if(alpha<.004){ data[o]=data[o+1]=data[o+2]=data[o+3]=0; continue; }
          const wet=clamp(this._catmull(this._smoothWet,gx,gy),0,1);
          const baseHeight=this._catmull(this._smoothHeight,gx,gy);
          const deform=this._catmull(this._smoothDeform,gx,gy);
          const eps=.58;
          const zpx=this._catmull(this._smoothHeight,gx+eps,gy)+this._catmull(this._smoothDeform,gx+eps,gy)*.72;
          const zmx=this._catmull(this._smoothHeight,gx-eps,gy)+this._catmull(this._smoothDeform,gx-eps,gy)*.72;
          const zpy=this._catmull(this._smoothHeight,gx,gy+eps)+this._catmull(this._smoothDeform,gx,gy+eps)*.72;
          const zmy=this._catmull(this._smoothHeight,gx,gy-eps)+this._catmull(this._smoothDeform,gx,gy-eps)*.72;
          const zx=zpx-zmx, zy=zpy-zmy;
          const normalLight=clamp(.58-zx*.40-zy*.46,0,1);
          const depthShade=clamp(deform<0 ? deform*.20 : deform*.09,-.25,.16);
          const edgeLift=Math.pow(1-smoothstep(.02,.20,amount),2)*.10;
          const gloss=Math.pow(normalLight,6)*(0.10+wet*.34) + edgeLift;
          const rr=clamp(this._catmull(this._smoothR,gx,gy),0,255);
          const gg=clamp(this._catmull(this._smoothG,gx,gy),0,255);
          const bb=clamp(this._catmull(this._smoothB,gx,gy),0,255);
          const shade=clamp(.80+normalLight*.30+depthShade,0.56,1.16);
          data[o]=clamp(rr*shade+255*gloss,0,255);
          data[o+1]=clamp(gg*shade+255*gloss,0,255);
          data[o+2]=clamp(bb*shade+255*gloss,0,255);
          data[o+3]=255*alpha;
        }
      }
      this._surfaceCtx.putImageData(this._imageData,0,0);
      ctx.clearRect(0,0,size,size);
      ctx.save();
      ctx.imageSmoothingEnabled=true;
      ctx.imageSmoothingQuality='high';
      ctx.filter='blur(0.35px)';
      ctx.drawImage(this._surface,0,0,size,size);
      ctx.restore();
      this.dirty=false;
    }
  }
  global.YubisakiPhysics={PaintPhysicsField};
})(window);
