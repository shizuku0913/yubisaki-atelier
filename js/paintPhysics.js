/* ゆびさきアトリエ: Yubisaki Engine "Shizuku" v3.0.0-alpha1 */
(function(global){
  'use strict';

  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const lerp=(a,b,t)=>a+(b-a)*t;

  function hexToRgb(hex){
    const h=String(hex||'#000').replace('#','');
    const v=h.length===3?h.split('').map(x=>x+x).join(''):h;
    const n=parseInt(v,16)||0;
    return {r:(n>>16)&255,g:(n>>8)&255,b:n&255};
  }

  class PaintPhysicsField{
    constructor(size=56){
      this.n=size;
      this.count=size*size;
      this.amount=new Float32Array(this.count);
      this.wet=new Float32Array(this.count);
      this.height=new Float32Array(this.count);
      this.restHeight=new Float32Array(this.count);
      this.heightVelocity=new Float32Array(this.count);
      this.r=new Float32Array(this.count);
      this.g=new Float32Array(this.count);
      this.b=new Float32Array(this.count);
      this.vx=new Float32Array(this.count);
      this.vy=new Float32Array(this.count);

      this.nextAmount=new Float32Array(this.count);
      this.nextWet=new Float32Array(this.count);
      this.nextHeight=new Float32Array(this.count);
      this.nextRMass=new Float32Array(this.count);
      this.nextGMass=new Float32Array(this.count);
      this.nextBMass=new Float32Array(this.count);
      this.nextVx=new Float32Array(this.count);
      this.nextVy=new Float32Array(this.count);

      this.surfaceCanvas=document.createElement('canvas');
      this.surfaceCanvas.width=size;
      this.surfaceCanvas.height=size;
      this.surfaceCtx=this.surfaceCanvas.getContext('2d',{alpha:true});
      this.surfaceImage=this.surfaceCtx.createImageData(size,size);
      this.lastTouch=0;
      this.dirty=true;
    }

    clear(){
      for(const a of [
        this.amount,this.wet,this.height,this.restHeight,this.heightVelocity,
        this.r,this.g,this.b,this.vx,this.vy
      ]) a.fill(0);
      this.lastTouch=0;
      this.dirty=true;
    }

    idx(x,y){return y*this.n+x;}

    forCircle(nx,ny,nr,fn){
      const n=this.n, cx=nx*(n-1), cy=ny*(n-1), rr=Math.max(1.25,nr*n);
      const x0=Math.max(1,Math.floor(cx-rr)),x1=Math.min(n-2,Math.ceil(cx+rr));
      const y0=Math.max(1,Math.floor(cy-rr)),y1=Math.min(n-2,Math.ceil(cy+rr));
      for(let y=y0;y<=y1;y++) for(let x=x0;x<=x1;x++){
        const dx=x-cx,dy=y-cy;
        const d=Math.hypot(dx,dy)/rr;
        if(d<=1){
          const soft=Math.exp(-d*d*3.2);
          fn(this.idx(x,y),x,y,soft,dx,dy,rr,d);
        }
      }
    }

    deposit(nx,ny,nr,color,amount=.7,water=0){
      const c=hexToRgb(color);
      this.forCircle(nx,ny,nr,(i,x,y,w)=>{
        const add=amount*w;
        const old=this.amount[i],total=old+add;
        if(total>0){
          this.r[i]=(this.r[i]*old+c.r*add)/total;
          this.g[i]=(this.g[i]*old+c.g*add)/total;
          this.b[i]=(this.b[i]*old+c.b*add)/total;
        }
        this.amount[i]=Math.min(3,total);
        this.restHeight[i]=Math.min(2.25,this.restHeight[i]+add*.82);
        this.height[i]=Math.min(2.45,this.height[i]+add*.94);
        this.heightVelocity[i]+=add*.05;
        this.wet[i]=Math.min(1,this.wet[i]+.38+water);
      });
      this.dirty=true;
    }

    addWater(nx,ny,nr,amount=.8){
      this.forCircle(nx,ny,nr,(i,x,y,w)=>{
        this.wet[i]=Math.min(1,this.wet[i]+amount*w);
        this.restHeight[i]=Math.max(0,this.restHeight[i]-.035*w);
        this.heightVelocity[i]-=.025*w;
      });
      this.dirty=true;
    }

    press(nx,ny,nr,strength=.7){
      this.lastTouch=performance.now();
      this.forCircle(nx,ny,nr,(i,x,y,w,dx,dy,rr,d)=>{
        if(this.amount[i]<.008) return;
        const distance=Math.hypot(dx,dy);
        const inv=1/(distance||1);
        const center=w*w;
        const rim=Math.exp(-Math.pow((d-.68)/.22,2));
        const pressure=strength*center;

        // Soft indentation at the finger centre.
        this.heightVelocity[i]-=pressure*.55;
        this.height[i]=Math.max(0,this.height[i]-pressure*.08);

        // Paint displaced by the finger rises in a rounded ring instead of
        // forming a hard-edged circle.
        this.heightVelocity[i]+=rim*strength*.14;
        this.vx[i]+=dx*inv*pressure*.48;
        this.vy[i]+=dy*inv*pressure*.48;
      });
      this.dirty=true;
    }

    drag(fx,fy,tx,ty,nr,strength=.9){
      this.lastTouch=performance.now();
      const dx=(tx-fx)*this.n,dy=(ty-fy)*this.n;
      const speed=Math.hypot(dx,dy);
      this.forCircle(tx,ty,nr,(i,x,y,w,rx,ry,rr,d)=>{
        if(this.amount[i]<.005) return;
        const follow=w*(.5+.5*(1-d));
        this.vx[i]+=dx*follow*strength*.23;
        this.vy[i]+=dy*follow*strength*.23;

        // A slow pull piles paint up; a fast swipe stretches it thinner.
        const slow=1-clamp(speed/2.4,0,1);
        this.heightVelocity[i]+=(slow*.09-.025)*w;
      });
      this.dirty=true;
    }

    homogenize(color,strength=.12,flatten=.04){
      const c=hexToRgb(color),k=clamp(strength,0,1),flat=clamp(flatten,0,1);
      for(let i=0;i<this.count;i++){
        if(this.amount[i]<.005) continue;
        this.r[i]+=(c.r-this.r[i])*k;
        this.g[i]+=(c.g-this.g[i])*k;
        this.b[i]+=(c.b-this.b[i])*k;
        const target=Math.min(1.25,this.amount[i]);
        this.restHeight[i]+=(target-this.restHeight[i])*flat;
        this.vx[i]*=(1-k*.45);
        this.vy[i]*=(1-k*.45);
      }
      this.dirty=true;
    }

    setUniformColor(color){this.homogenize(color,1,.32);}

    sample(arr,x,y){
      const n=this.n;
      const x0=clamp(Math.floor(x),0,n-1),y0=clamp(Math.floor(y),0,n-1);
      const x1=Math.min(n-1,x0+1),y1=Math.min(n-1,y0+1);
      const tx=x-x0,ty=y-y0;
      const a=arr[this.idx(x0,y0)],b=arr[this.idx(x1,y0)];
      const c=arr[this.idx(x0,y1)],d=arr[this.idx(x1,y1)];
      return lerp(lerp(a,b,tx),lerp(c,d,tx),ty);
    }

    step(dt=.016){
      const n=this.n;
      dt=clamp(dt,.008,.034);
      const scale=dt*60;
      const active=(performance.now()-this.lastTouch)<90;

      // Smooth local pressure and spring response. This is what creates the
      // rounded "ぷに → ぷるん" motion after the finger leaves the paint.
      for(let y=1;y<n-1;y++) for(let x=1;x<n-1;x++){
        const i=this.idx(x,y);
        if(this.amount[i]<.0005) continue;
        const l=this.idx(x-1,y),r=this.idx(x+1,y),u=this.idx(x,y-1),d=this.idx(x,y+1);
        const neighbour=(this.height[l]+this.height[r]+this.height[u]+this.height[d])*.25;
        const spring=(this.restHeight[i]-this.height[i])*.115;
        const surface=(neighbour-this.height[i])*.17;
        this.heightVelocity[i]+=(spring+surface)*scale;
        this.heightVelocity[i]*=Math.pow(active?.78:.86,scale);
        this.height[i]=Math.max(0,this.height[i]+this.heightVelocity[i]*dt*7.5);

        const pressureX=(this.height[l]-this.height[r])*.085;
        const pressureY=(this.height[u]-this.height[d])*.085;
        this.vx[i]+=pressureX*scale;
        this.vy[i]+=pressureY*scale;
        const flowDamping=.82-this.wet[i]*.08;
        this.vx[i]*=Math.pow(flowDamping,scale);
        this.vy[i]*=Math.pow(flowDamping,scale);
      }

      for(const a of [this.nextAmount,this.nextWet,this.nextHeight,this.nextRMass,this.nextGMass,this.nextBMass,this.nextVx,this.nextVy]) a.fill(0);

      // Bilinear advection removes the old grid-snapping behaviour. Pigment
      // can now move through fractional cells, so strokes bend organically.
      for(let y=1;y<n-1;y++) for(let x=1;x<n-1;x++){
        const i=this.idx(x,y),a=this.amount[i];
        if(a<.0005) continue;
        const mobility=.13+this.wet[i]*.34;
        const tx=clamp(x+this.vx[i]*dt*8.5*mobility,1,n-2.001);
        const ty=clamp(y+this.vy[i]*dt*8.5*mobility,1,n-2.001);
        const x0=Math.floor(tx),y0=Math.floor(ty),fx=tx-x0,fy=ty-y0;
        const targets=[
          [x0,y0,(1-fx)*(1-fy)], [x0+1,y0,fx*(1-fy)],
          [x0,y0+1,(1-fx)*fy], [x0+1,y0+1,fx*fy]
        ];
        for(const [xx,yy,w] of targets){
          const j=this.idx(xx,yy),mass=a*w;
          this.nextAmount[j]+=mass;
          this.nextWet[j]+=this.wet[i]*mass;
          this.nextHeight[j]+=this.height[i]*mass;
          this.nextRMass[j]+=this.r[i]*mass;
          this.nextGMass[j]+=this.g[i]*mass;
          this.nextBMass[j]+=this.b[i]*mass;
          this.nextVx[j]+=this.vx[i]*mass;
          this.nextVy[j]+=this.vy[i]*mass;
        }
      }

      for(let i=0;i<this.count;i++){
        const a=this.nextAmount[i];
        if(a>.0001){
          this.amount[i]=a;
          this.wet[i]=Math.max(0,this.nextWet[i]/a-.00055*scale);
          this.height[i]=this.nextHeight[i]/a;
          this.r[i]=this.nextRMass[i]/a;
          this.g[i]=this.nextGMass[i]/a;
          this.b[i]=this.nextBMass[i]/a;
          this.vx[i]=this.nextVx[i]/a;
          this.vy[i]=this.nextVy[i]/a;
          const target=Math.min(1.7,a*.78);
          this.restHeight[i]+=(target-this.restHeight[i])*.012*scale;
        }else{
          this.amount[i]=this.wet[i]=this.height[i]=this.restHeight[i]=0;
          this.heightVelocity[i]=this.r[i]=this.g[i]=this.b[i]=this.vx[i]=this.vy[i]=0;
        }
      }
      this.dirty=true;
    }

    render(ctx,size){
      const n=this.n,data=this.surfaceImage.data;
      for(let y=0;y<n;y++) for(let x=0;x<n;x++){
        const i=this.idx(x,y),p=i*4,a=this.amount[i];
        if(a<.008){data[p]=data[p+1]=data[p+2]=data[p+3]=0;continue;}

        const h=this.height[i],wet=this.wet[i];
        const l=this.height[this.idx(Math.max(0,x-1),y)];
        const rr=this.height[this.idx(Math.min(n-1,x+1),y)];
        const u=this.height[this.idx(x,Math.max(0,y-1))];
        const d=this.height[this.idx(x,Math.min(n-1,y+1))];
        const nx=(l-rr)*.9,ny=(u-d)*.9;
        const highlight=clamp(nx*-.34+ny*-.42+h*.08+wet*.11,-.12,.34);
        const shade=highlight>=0?highlight:highlight*.55;
        data[p]=clamp(this.r[i]+(shade>=0?(255-this.r[i])*shade:this.r[i]*shade),0,255);
        data[p+1]=clamp(this.g[i]+(shade>=0?(255-this.g[i])*shade:this.g[i]*shade),0,255);
        data[p+2]=clamp(this.b[i]+(shade>=0?(255-this.b[i])*shade:this.b[i]*shade),0,255);
        data[p+3]=Math.round(clamp(.08+a*.24+h*.10,0,.82)*255);
      }
      this.surfaceCtx.putImageData(this.surfaceImage,0,0);

      ctx.clearRect(0,0,size,size);
      ctx.save();
      ctx.imageSmoothingEnabled=true;
      ctx.imageSmoothingQuality='high';
      // A tiny blur joins neighbouring cells into one continuous soft body.
      ctx.filter=`blur(${Math.max(1,size/n*.48)}px)`;
      ctx.drawImage(this.surfaceCanvas,0,0,size,size);
      ctx.filter='none';
      ctx.globalCompositeOperation='screen';
      ctx.globalAlpha=.09;
      ctx.drawImage(this.surfaceCanvas,-size*.002,-size*.003,size,size);
      ctx.restore();
    }
  }

  global.YubisakiPhysics={PaintPhysicsField,version:'3.0.0-alpha1',codename:'Shizuku'};
})(window);
