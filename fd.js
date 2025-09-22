// fd.js — Fractal Dimension utilities (browser, no bundler)

// ===== Linear regression (log–log) =====
function linreg(X, Y) {
  const n = X.length;
  if (!n) return { slope: NaN, intercept: NaN, r2: 0 };
  const sx = X.reduce((p,c)=>p+c,0), sy = Y.reduce((p,c)=>p+c,0);
  const sxx = X.reduce((p,c)=>p+c*c,0);
  const sxy = X.reduce((p,c,i)=>p+c*Y[i],0);
  const slope = (n*sxy - sx*sy) / (n*sxx - sx*sx + 1e-12);
  const intercept = (sy - slope*sx) / n;
  const ym = sy / n;
  const ssTot = Y.reduce((p,y)=>p+(y-ym)*(y-ym),0);
  const ssRes = Y.reduce((p,y,i)=>p+(y-(slope*X[i]+intercept))**2,0);
  const r2 = ssTot ? 1 - ssRes/ssTot : 0;
  return { slope, intercept, r2 };
}

// ===== Box-counting FD บนชุดจุด (เช่น จุดจากคอนทัวร์) =====
export function fractalDimensionBoxCounting(points, width, height, opts={}) {
  const { minBox=2, maxBox=Math.min(width,height), steps=8 } = opts;
  if (!points || points.length===0) return { D:NaN, R2:0, samples:[] };
  // log-spaced scales
  const scales=[], logMin=Math.log(minBox), logMax=Math.log(maxBox);
  for(let i=0;i<steps;i++){
    const s=Math.round(Math.exp(logMax + (logMin-logMax)*(i/(steps-1))));
    if(s>=1 && !scales.includes(s)) scales.push(s);
  }
  const samples=[];
  for(const s of scales){
    const gx=Math.ceil(width/s), gy=Math.ceil(height/s);
    const set=new Set();
    for(const [x,y] of points){
      const ix=Math.floor(Math.max(0,Math.min(width-1,x))/s);
      const iy=Math.floor(Math.max(0,Math.min(height-1,y))/s);
      set.add(ix+':'+iy);
    }
    const N=set.size;
    if(N>0) samples.push({ s, N });
  }
  const X=samples.map(o=>Math.log(1/o.s)), Y=samples.map(o=>Math.log(o.N));
  const { slope, r2 } = linreg(X,Y);
  return { D:slope, R2:r2, samples };
}

// ===== Differential Box-Counting (DBC) บนภาพเกรย์สเกล =====
export function fractalDimensionDBC(getPixel, width, height, opts={}){
  const { steps=6, minBox=4, zLevels=256 } = opts;
  const maxBox=Math.min(width,height);
  const scales=[], logMin=Math.log(minBox), logMax=Math.log(maxBox);
  for(let i=0;i<steps;i++){
    const s=Math.round(Math.exp(logMax + (logMin-logMax)*(i/(steps-1))));
    if(s>=2 && !scales.includes(s)) scales.push(s);
  }
  const samples=[];
  for(const s of scales){
    const gx=Math.ceil(width/s), gy=Math.ceil(height/s);
    let N=0; const dz=Math.ceil(zLevels/s);
    for(let gyi=0;gyi<gy;gyi++){
      for(let gxi=0;gxi<gx;gxi++){
        const x0=gxi*s, y0=gyi*s, x1=Math.min(x0+s,width), y1=Math.min(y0+s,height);
        let minI=255, maxI=0;
        for(let y=y0;y<y1;y++){
          for(let x=x0;x<x1;x++){
            const v=getPixel(x,y)|0;
            if(v<minI) minI=v; if(v>maxI) maxI=v;
          }
        }
        const boxCount=Math.max(1, Math.ceil((maxI-minI+1)/dz));
        N+=boxCount;
      }
    }
    samples.push({ s, N });
  }
  const X=samples.map(o=>Math.log(1/o.s)), Y=samples.map(o=>Math.log(o.N));
  const { slope, r2 } = linreg(X,Y);
  return { D:slope, R2:r2, samples };
}

// ===== ช่วยวาดกราฟลง <canvas id="fdPlot"> =====
export function drawFDPlot(canvas, samples, title, line={}) {
  if(!canvas) return;
  const ctx=canvas.getContext('2d');
  ctx.clearRect(0,0,canvas.width,canvas.height);
  const pad=28, W=canvas.width, H=canvas.height, x0=pad, y0=H-pad, x1=W-pad, y1=pad;

  // axes
  ctx.strokeStyle='#3a4377'; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(x0,y0); ctx.lineTo(x1,y0); ctx.lineTo(x1,y1); ctx.stroke();

  if(!samples || samples.length===0) return;

  const X=samples.map(o=>Math.log(1/o.s)), Y=samples.map(o=>Math.log(o.N));
  const xmin=Math.min(...X), xmax=Math.max(...X);
  const ymin=Math.min(...Y), ymax=Math.max(...Y);

  const sx=(x)=> x0 + (x - xmin) / (xmax-xmin+1e-9) * (x1-x0);
  const sy=(y)=> y0 - (y - ymin) / (ymax-ymin+1e-9) * (y0-y1);

  // grid
  ctx.strokeStyle='#26315e'; ctx.lineWidth=1;
  for(let i=0;i<=4;i++){
    const gx=x0+(x1-x0)*i/4; ctx.beginPath(); ctx.moveTo(gx,y0); ctx.lineTo(gx,y1); ctx.stroke();
    const gy=y0-(y0-y1)*i/4; ctx.beginPath(); ctx.moveTo(x0,gy); ctx.lineTo(x1,gy); ctx.stroke();
  }

  // points
  ctx.fillStyle='#cfe6ff';
  for(let i=0;i<samples.length;i++){
    const px=sx(X[i]), py=sy(Y[i]);
    ctx.beginPath(); ctx.arc(px,py,3,0,Math.PI*2); ctx.fill();
  }

  // regression line (optional)
  if(line && isFinite(line.slope)){
    const { slope, intercept } = line;
    const yA=slope*xmin + intercept, yB=slope*xmax + intercept;
    ctx.strokeStyle='#7bdfff'; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.moveTo(sx(xmin), sy(yA)); ctx.lineTo(sx(xmax), sy(yB)); ctx.stroke();
  }

  // title
  ctx.fillStyle='#cfe6ff'; ctx.font='12px ui-monospace,monospace';
  ctx.fillText(title || 'Fractal log–log plot', x0, y1-8);
}
