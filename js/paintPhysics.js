(function(global){
  'use strict';

  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
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
      this.tmp=new Float32Array(c);
      this.dirty=true;
    }
    clear(){
      for(const a of [this.amount,this.wet,this.height,this.r,this.g,this.b,this.vx,this.vy]) a.fill(0);
      this.dirty=true;
    }
    idx(x,y){return y*this.n+x;}
    forCircle(nx,ny,nr,fn){
      const n=this.n, cx=nx*(n-1), cy=ny*(n-1), rr=Math.max(1,nr*n);
      const x0=Math.max(1,Math.floor(cx-rr)),x1=Math.min(n-2,Math.ceil(cx+rr));
      const y0=Math.max(1,Math.floor(cy-rr)),y1=Math.min(n-2,Math.ceil(cy+rr));
      for(let y=y0;y<=y1;y++) for(let x=x0;x<=x1;x++){
        const dx=x-cx,dy=y-cy,d=Math.hypot(dx,dy)/rr;
        if(d<=1) fn(this.idx(x,y),x,y,1-d,dx,dy,rr);
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
    press(nx,ny,nr,strength=.7){
      this.forCircle(nx,ny,nr,(i,x,y,w,dx,dy,rr)=>{
        if(this.amount[i]<.01) return;
        const inv=1/(Math.hypot(dx,dy)||1);
        const p=strength*w*w;
        this.height[i]=Math.max(0,this.height[i]-p*.18);
        this.vx[i]+=dx*inv*p*.38;
        this.vy[i]+=dy*inv*p*.38;
      });
      this.dirty=true;
    }
    drag(fx,fy,tx,ty,nr,strength=.9){
      const dx=(tx-fx)*this.n,dy=(ty-fy)*this.n;
      this.forCircle(tx,ty,nr,(i,x,y,w)=>{
        if(this.amount[i]<.005) return;
        this.vx[i]+=dx*w*strength*.2;
        this.vy[i]+=dy*w*strength*.2;
        this.height[i]=Math.min(2.5,this.height[i]+w*.03);
      });
      this.dirty=true;
    }
    step(dt=.016){
      const n=this.n;
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
    }
    render(ctx,size){
      const n=this.n, cell=size/n;
      ctx.clearRect(0,0,size,size);
      ctx.save(); ctx.globalCompositeOperation='source-over';
      for(let y=1;y<n-1;y++) for(let x=1;x<n-1;x++){
        const i=this.idx(x,y),a=this.amount[i];
        if(a<.015) continue;
        const h=this.height[i],wet=this.wet[i];
        const alpha=clamp(.13+a*.18,0,.72);
        const px=x*cell,py=y*cell;
        const light=clamp(h*.16+wet*.12,0,.32);
        const rr=Math.min(255,this.r[i]+(255-this.r[i])*light);
        const gg=Math.min(255,this.g[i]+(255-this.g[i])*light);
        const bb=Math.min(255,this.b[i]+(255-this.b[i])*light);
        ctx.fillStyle=`rgba(${rr|0},${gg|0},${bb|0},${alpha})`;
        ctx.beginPath();ctx.arc(px,py,cell*(.7+h*.12),0,Math.PI*2);ctx.fill();
        if(h>.18){
          ctx.fillStyle=`rgba(255,255,255,${clamp(.03+wet*.14,0,.22)})`;
          ctx.beginPath();ctx.arc(px-cell*.16,py-cell*.2,cell*.18,0,Math.PI*2);ctx.fill();
        }
      }
      ctx.restore();
    }
  }
  global.YubisakiPhysics={PaintPhysicsField};
})(window);
