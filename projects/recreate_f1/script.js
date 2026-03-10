(() => {
  const canvas = document.getElementById('sim');
  const ctx    = canvas.getContext('2d');
  const wrap   = document.getElementById('canvas-wrap');

  let data=null,simTime=0,tMax=0,playing=false,speed=20,lastTS=null,tf=null,lbTick=-999;
  let arc=[],arcTotal=0;
  const GRID_SECS=60;
  const dnfCache={};
  let rcShown=0,rcScrolled=false,rcPointer=0;
  let prevRankMap={};

  const GSIZE=128;
  let sfGrid=null,sfGridMinX=0,sfGridMinY=0,sfGridCellW=1,sfGridCellH=1;
  function buildSpatialGrid(){
    const pts=data.circuit;
    const xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]);
    sfGridMinX=Math.min(...xs)-1; sfGridMinY=Math.min(...ys)-1;
    const maxX=Math.max(...xs)+1,maxY=Math.max(...ys)+1;
    sfGridCellW=(maxX-sfGridMinX)/GSIZE; sfGridCellH=(maxY-sfGridMinY)/GSIZE;
    sfGrid=new Int16Array(GSIZE*GSIZE);
    for(let cy=0;cy<GSIZE;cy++){
      const wy=sfGridMinY+(cy+0.5)*sfGridCellH;
      for(let cx=0;cx<GSIZE;cx++){
        const wx=sfGridMinX+(cx+0.5)*sfGridCellW;
        let best=Infinity,idx=0;
        for(let i=0;i<pts.length;i++){const dx=pts[i][0]-wx,dy=pts[i][1]-wy,d2=dx*dx+dy*dy;if(d2<best){best=d2;idx=i;}}
        sfGrid[cy*GSIZE+cx]=idx;
      }
    }
  }

  /* ── SECTOR BOUNDS ───────────────────────────────────────────────────── */
  let sectorBounds=null;
  function buildSectorBounds(){
    let f1=1/3,f2=2/3;
    const flDrv=data.drivers.find(d=>d.code===data.meta.session_fastest_lap);
    if(flDrv?.sector_times?.length){
      let best=Infinity,bestRow=null;
      for(const st of flDrv.sector_times){
        if(st.s1&&st.s2&&st.s3){const tot=st.s1+st.s2+st.s3;if(tot<best){best=tot;bestRow=st;}}
      }
      if(bestRow){const tot=bestRow.s1+bestRow.s2+bestRow.s3;f1=bestRow.s1/tot;f2=(bestRow.s1+bestRow.s2)/tot;}
    }
    const t1=f1*arcTotal,t2=f2*arcTotal;
    let s1End=0,s2End=0,b1=Infinity,b2=Infinity;
    for(let i=0;i<arc.length;i++){
      const d1=Math.abs(arc[i]-t1),d2=Math.abs(arc[i]-t2);
      if(d1<b1){b1=d1;s1End=i;} if(d2<b2){b2=d2;s2End=i;}
    }
    sectorBounds={s1End,s2End};
  }

  function drawSectorStripes(){
    if(!sectorBounds||!data?.circuit)return;
    const pts=data.circuit,{s1End,s2End}=sectorBounds;
    ctx.save();ctx.lineJoin='round';ctx.lineCap='round';
    const segs=[
      {from:0,to:s1End,color:'#ffd700',name:'S1'},
      {from:s1End,to:s2End,color:'#c084fc',name:'S2'},
      {from:s2End,to:pts.length-1,color:'#4caf50',name:'S3'},
    ];
    for(const seg of segs){
      ctx.beginPath();
      const[sx,sy]=tc(pts[seg.from][0],pts[seg.from][1]);ctx.moveTo(sx,sy);
      for(let i=seg.from+1;i<=seg.to&&i<pts.length;i++){const[x,y]=tc(pts[i][0],pts[i][1]);ctx.lineTo(x,y);}
      ctx.lineWidth=2.5;ctx.strokeStyle=seg.color+'bb';ctx.stroke();
    }
    const bounds=[{idx:0,label:'S1',color:'#ffd700'},{idx:s1End,label:'S2',color:'#c084fc'},{idx:s2End,label:'S3',color:'#4caf50'}];
    for(const{idx,label,color}of bounds){
      const[bx,by]=tc(pts[idx][0],pts[idx][1]);
      ctx.beginPath();ctx.arc(bx,by,4,0,Math.PI*2);ctx.fillStyle=color+'cc';ctx.fill();
      ctx.fillStyle=color;ctx.font="bold 8px 'Share Tech Mono',monospace";
      ctx.textAlign='center';ctx.textBaseline='bottom';ctx.fillText(label,bx,by-7);
    }
    ctx.restore();
  }

  /* ── FLASH / LEADER EVENTS ───────────────────────────────────────────── */
  let flashEvents=[],flashPointer=0,currentLeader=null;
  const flBanner  =document.getElementById('fl-banner');
  const ldBanner  =document.getElementById('leader-banner');
  const ldInner   =document.getElementById('ld-inner');
  const ldNameText=document.getElementById('ld-name-text');
  const ldTeamText=document.getElementById('ld-team-text');
  let flTimer=null,ldTimer=null;

  function buildFlashEvents(){
    flashEvents=[];flashPointer=0;
    const flDrv=data.drivers.find(d=>d.code===data.meta.session_fastest_lap);
    if(!flDrv?.fastest_lap||!flDrv.positions?.length)return;
    let fastestLap=null;
    if(flDrv.sector_times?.length){
      let best=Infinity;
      for(const st of flDrv.sector_times){
        if(st.s1&&st.s2&&st.s3){const tot=st.s1+st.s2+st.s3;if(tot<best){best=tot;fastestLap=st.lap;}}
      }
    }
    if(fastestLap===null)return;
    const pos=flDrv.positions;
    for(let i=1;i<pos.length;i++){
      if(pos[i][3]===fastestLap+1&&pos[i-1][3]===fastestLap){
        flashEvents.push({t:pos[i][0],code:flDrv.code,color:flDrv.color,lapTime:flDrv.fastest_lap});
        break;
      }
    }
  }

  function triggerFastestLapFlash(code,color,lapTime){
    if(flTimer)clearTimeout(flTimer);
    flBanner.innerHTML=`<div class="fl-pill">
      <span class="fl-icon">⚡</span>
      <span class="fl-label">FASTEST LAP</span>
      <span class="fl-code" style="color:${color}">${code}</span>
      <span class="fl-time">${fmtLap(lapTime)}</span>
    </div>`;
    flBanner.classList.remove('show');
    void flBanner.offsetWidth;
    flBanner.classList.add('show');
    flTimer=setTimeout(()=>flBanner.classList.remove('show'),3300);
  }

  function triggerLeaderBanner(code,color,team){
    if(ldTimer)clearTimeout(ldTimer);
    ldInner.style.borderLeftColor=color;
    ldNameText.textContent=code; ldNameText.style.color=color;
    ldTeamText.textContent=team||'';
    ldBanner.classList.remove('show');
    void ldBanner.offsetWidth;
    ldBanner.classList.add('show');
    ldTimer=setTimeout(()=>ldBanner.classList.remove('show'),4200);
  }

  function checkFlashEvents(){
    while(flashPointer<flashEvents.length&&flashEvents[flashPointer].t<=simTime){
      const ev=flashEvents[flashPointer];
      triggerFastestLapFlash(ev.code,ev.color,ev.lapTime);
      flashPointer++;
    }
  }

  /* ── POSITION CHART ──────────────────────────────────────────────────── */
  let lapRankings={},lastChartLap=-1;
  const posChartCanvas =document.getElementById('pos-chart');
  const posChartWrap   =document.getElementById('pos-chart-wrap');

  function rawProgress(drv, t) {
    const tEff = (drv.dnf_time !== null && t > drv.dnf_time) ? drv.dnf_time : t;
    return getSmoothProgress(drv, tEff);
  }

  function buildLapRankings(){
    lapRankings={};
    const total=data.meta.total_laps;

    lapRankings[0]={};
    const gridSorted=[...data.drivers].sort((a,b)=>a.grid-b.grid);
    gridSorted.forEach((drv,i)=>{ lapRankings[0][drv.code]=i+1; });

    for(let lap=1;lap<=total;lap++){
      let ref=Infinity;
      for(const drv of data.drivers){
        if(!drv.positions?.length)continue;
        const pos=drv.positions;
        for(let i=1;i<pos.length;i++){
          if(pos[i][3]>=lap+1&&pos[i-1][3]<=lap){if(pos[i][0]<ref)ref=pos[i][0];break;}
        }
      }
      if(!isFinite(ref))continue;
      const pl=data.drivers.map(drv=>({code:drv.code,dnf:drv.dnf_time!==null&&ref>drv.dnf_time,prog:rawProgress(drv,ref)}));
      pl.sort((a,b)=>a.dnf!==b.dnf?(a.dnf?1:-1):b.prog-a.prog);
      lapRankings[lap]={};let r=1;
      for(const p of pl)lapRankings[lap][p.code]=p.dnf?null:r++;
    }
  }

  function drawPosChart(){
    if(!posChartCanvas||!Object.keys(lapRankings).length)return;
    const dpr=devicePixelRatio||1;
    const W=posChartCanvas.offsetWidth,H=posChartCanvas.offsetHeight;
    if(!W||!H)return;
    posChartCanvas.width=W*dpr;posChartCanvas.height=H*dpr;
    posChartCanvas.style.width=W+'px';posChartCanvas.style.height=H+'px';
    const c2=posChartCanvas.getContext('2d');
    c2.setTransform(dpr,0,0,dpr,0,0);
    const n=data.drivers.length,total=data.meta.total_laps;
    const PAD={top:10,right:28,bottom:16,left:18};
    const cW=W-PAD.left-PAD.right,cH=H-PAD.top-PAD.bottom;
    const xOf=lap=>PAD.left+(lap/total)*cW;
    c2.fillStyle='#090909';c2.fillRect(0,0,W,H);
    c2.strokeStyle='#1a1a1a';c2.lineWidth=1;
    for(let r=1;r<=n;r+=5){
      const y=PAD.top+((r-1)/(n-1))*cH;
      c2.beginPath();c2.moveTo(PAD.left,y);c2.lineTo(W-PAD.right,y);c2.stroke();
      c2.fillStyle='#444';c2.font="7px 'Share Tech Mono',monospace";
      c2.textAlign='right';c2.fillText('P'+r,PAD.left-3,y+3);
    }
    c2.fillStyle='#333';c2.font="7px 'Share Tech Mono',monospace";c2.textAlign='center';
    c2.fillText('GRID',xOf(0),H-2);
    const step=total>40?10:5;
    for(let lap=step;lap<=total;lap+=step){
      c2.fillText(lap,xOf(lap),H-2);
    }
    let curLap=0;
    for(const drv of data.drivers){if(!isDNF(drv)){const s=interp(drv.positions,simTime);if(s.lap>curLap)curLap=s.lap;}}
    curLap=Math.min(curLap,total);
    {
      const cx=xOf(curLap);
      c2.strokeStyle='#e8002d55';c2.lineWidth=1;c2.setLineDash([3,5]);
      c2.beginPath();c2.moveTo(cx,PAD.top);c2.lineTo(cx,H-PAD.bottom);c2.stroke();
      c2.setLineDash([]);
    }
    const completedLap = Math.max(0, curLap - 1);
    for(const drv of data.drivers){
      const pts=[];
      for(let lap=0;lap<=total;lap++){
        if(!lapRankings[lap])continue;
        const rank=lapRankings[lap][drv.code];
        if(!rank)continue;
        if(lap > completedLap) continue;
        pts.push([xOf(lap),PAD.top+((rank-1)/(n-1))*cH,lap]);
      }
      if(pts.length<2)continue;
      c2.strokeStyle=drv.color;c2.lineWidth=1.5;
      c2.globalAlpha=isDNF(drv)?0.25:0.85;
      c2.beginPath();c2.moveTo(pts[0][0],pts[0][1]);
      for(let i=1;i<pts.length;i++)c2.lineTo(pts[i][0],pts[i][1]);
      c2.stroke();
      const last=pts[pts.length-1];
      c2.globalAlpha=isDNF(drv)?0.3:1;
      c2.fillStyle=drv.color;
      c2.font="bold 6px 'Share Tech Mono',monospace";
      c2.textAlign='left';c2.fillText(drv.code,W-PAD.right+2,last[1]+3);
      c2.globalAlpha=1;
    }
  }

  const TS_STYLE={
    '1':{road:'#3a3a3a',edge:'#1c1c1c',glow:null},
    '2':{road:'#3a3a3a',edge:'#1c1c1c',glow:'#ffd700',blur:22},
    '3':{road:'#3a3a3a',edge:'#1c1c1c',glow:'#ffd700',blur:28,pulse:true},
    '4':{road:'#3a3a3a',edge:'#1c1c1c',glow:'#f5c518',blur:30,pulse:true},
    '5':{road:'#3a3a3a',edge:'#1c1c1c',glow:'#ff1e1e',blur:34,pulse:true},
    '6':{road:'#3a3a3a',edge:'#1c1c1c',glow:'#f5c518',blur:22},
    '7':{road:'#3a3a3a',edge:'#1c1c1c',glow:'#f5c518',blur:14},
  };

  function resize(){
    // Use offsetWidth/Height — these reflect the actual rendered size of the
    // element after CSS layout (including flex). Do NOT set canvas.style.width/
    // height; let the CSS "width:100%;height:100%" handle display size so the
    // canvas always fills its container regardless of when resize() fires.
    const w = wrap.offsetWidth, h = wrap.offsetHeight;
    if(!w || !h){
      requestAnimationFrame(resize);
      return;
    }
    const dpr = devicePixelRatio || 1;
    canvas.width  = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if(data) buildTF();
  }

  /* ── Tablet DOM reorganisation ──────────────────────────────────
     On tablet (768–1199px) we physically move #weather-strip and
     #rc-strip from #centre-col into #lb-panel so they stack below
     the leaderboard on the right side of the screen.
     On desktop / phone they are moved back to #centre-col.
  ─────────────────────────────────────────────────────────────── */
  const weatherStrip    = document.getElementById('weather-strip');
  const rcStrip         = document.getElementById('rc-strip');
  const posChartSection = document.getElementById('pos-chart-section');
  const centreCol       = document.getElementById('centre-col');
  const lbPanel         = document.getElementById('lb-panel');
  const canvasWrap      = document.getElementById('canvas-wrap');

  function applyResponsiveLayout(){
    const isTablet = window.innerWidth >= 768 && window.innerWidth < 1200;

    if(isTablet){
      // Order: leaderboard → weather → rc → pos-chart
      if(weatherStrip.parentElement    !== lbPanel) lbPanel.appendChild(weatherStrip);
      if(rcStrip.parentElement         !== lbPanel) lbPanel.appendChild(rcStrip);
      if(posChartSection.parentElement !== lbPanel) lbPanel.appendChild(posChartSection);
    } else {
      if(weatherStrip.parentElement    !== centreCol) centreCol.insertBefore(weatherStrip, canvasWrap);
      if(rcStrip.parentElement         !== centreCol) centreCol.appendChild(rcStrip);
      if(posChartSection.parentElement !== lbPanel)   lbPanel.appendChild(posChartSection);
    }
    // Double rAF: first frame lets the browser process the DOM changes,
    // second frame guarantees flex layout has fully re-flowed before we measure.
    requestAnimationFrame(() => requestAnimationFrame(resize));
  }

  // ResizeObserver fires AFTER the element has its real painted size,
  // avoiding the race condition where resize() reads 0 on first load.
  const canvasResizeObserver = new ResizeObserver(() => resize());
  canvasResizeObserver.observe(canvasWrap);

  // DOM moves on resize (no resize() call — observer handles it)
  window.addEventListener('resize', applyResponsiveLayout);

  // Initial DOM arrangement — resize() will fire from the observer automatically
  applyResponsiveLayout();

  function buildTF(){
    const xs=data.circuit.map(p=>p[0]),ys=data.circuit.map(p=>p[1]);
    const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
    const cw=wrap.offsetWidth,ch=wrap.offsetHeight,P=28;
    const s=Math.min((cw-P*2)/(maxX-minX),(ch-P*2)/(maxY-minY));
    tf={minX,minY,s,ox:P+(cw-P*2-(maxX-minX)*s)/2,oy:ch-P-(ch-P*2-(maxY-minY)*s)/2};
  }
  function tc(wx,wy){return[tf.ox+(wx-tf.minX)*tf.s,tf.oy-(wy-tf.minY)*tf.s];}

  function lapFrac(wx,wy){
    const cx=Math.max(0,Math.min(GSIZE-1,((wx-sfGridMinX)/sfGridCellW)|0));
    const cy=Math.max(0,Math.min(GSIZE-1,((wy-sfGridMinY)/sfGridCellH)|0));
    return arc[sfGrid[cy*GSIZE+cx]]/arcTotal;
  }

  const finishCache={};
  let finishCounter=1;

  const smoothProgressCache = {};

  function buildSmoothProgress(drv) {
    const pos = drv.positions;
    if (!pos || !pos.length) { smoothProgressCache[drv.code] = []; return; }
    const pts = data.circuit;
    const N = pts.length;

    // Estimate lap time for window sizing.
    // We use the fastest lap in the session as a lower bound on lap time —
    // if a car could complete the circuit faster than this, we'd need a bigger
    // window, but that never happens.
    const flDrv = data.drivers.find(d => d.code === data.meta.session_fastest_lap);
    const lapTimeSec = (flDrv?.fastest_lap) || 90;

    // Global nearest for the very first point (no prior context yet).
    let prevIdx = 0, best = Infinity;
    for (let i = 0; i < N; i++) {
      const dx = pts[i][0]-pos[0][1], dy = pts[i][1]-pos[0][2];
      const d2 = dx*dx + dy*dy;
      if (d2 < best) { best = d2; prevIdx = i; }
    }

    let prevFrac = arc[prevIdx] / arcTotal;
    let laps = prevFrac > 0.5 ? -1 : 0;
    const out = [{t: pos[0][0], p: laps + prevFrac}];

    for (let i = 1; i < pos.length; i++) {
      // Time delta between samples → max fraction of circuit traversable.
      // 3× safety margin covers bursts of high speed; hard cap of 10% prevents
      // ever jumping to the wrong side of a crossing (Suzuka) or a close
      // parallel sector (Baku, Spain, Britain).
      const dt = pos[i][0] - pos[i-1][0];
      const maxFrac = Math.min((dt / lapTimeSec) * 3, 0.10);
      const WINDOW = Math.max(30, Math.floor(maxFrac * N));

      let bIdx = prevIdx, bDist = Infinity;
      for (let w = 0; w < WINDOW; w++) {
        const ci = (prevIdx + w) % N;
        const dx = pts[ci][0]-pos[i][1], dy = pts[ci][1]-pos[i][2];
        const d2 = dx*dx + dy*dy;
        if (d2 < bDist) { bDist = d2; bIdx = ci; }
      }
      const frac = arc[bIdx] / arcTotal;
      // Lap crossing: frac wraps from ~1 back to ~0
      if (frac < prevFrac - 0.5) laps++;
      prevFrac = frac;
      prevIdx = bIdx;
      out.push({t: pos[i][0], p: laps + frac});
    }
    smoothProgressCache[drv.code] = out;
  }

  function getSmoothProgress(drv, t) {
    const sp = smoothProgressCache[drv.code];
    if (!sp || !sp.length) return 0;
    if (t <= sp[0].t) return sp[0].p;
    if (t >= sp[sp.length-1].t) return sp[sp.length-1].p;
    let lo = 0, hi = sp.length - 1;
    while (lo < hi - 1) { const m = (lo+hi)>>1; sp[m].t < t ? (lo=m) : (hi=m); }
    const r = (t - sp[lo].t) / (sp[hi].t - sp[lo].t);
    return sp[lo].p + r * (sp[hi].p - sp[lo].p);
  }

  function raceProgress(drv, t) {
    if (finishCache[drv.code] !== undefined) return finishCache[drv.code];
    const s = interp(drv.positions, t);
    if (s.lap >= data.meta.total_laps && drv.dnf_time === null) {
      const pos = drv.finish_pos || finishCounter++;
      const locked = 1000000 - (pos-1) * 50000;
      finishCache[drv.code] = locked;
      return locked;
    }
    const prog = getSmoothProgress(drv, t);
    if (t >= GRID_SECS) return prog;
    const n = data.drivers.length, grid = (n+1-drv.grid)/n, blend = t/GRID_SECS;
    return grid*(1-blend) + prog*blend;
  }

  function interpArr(arr,t,xi=1,yi=2){
    if(!arr||!arr.length)return{x:0,y:0,lap:1,compound:'U',tyreLife:0};
    const f=arr[0],l=arr[arr.length-1];
    if(t<=f[0])return{x:f[xi],y:f[yi],lap:f[3]||1,compound:f[4]||'U',tyreLife:f[5]||0};
    if(t>=l[0])return{x:l[xi],y:l[yi],lap:l[3]||1,compound:l[4]||'U',tyreLife:l[5]||0};
    let lo=0,hi=arr.length-1;
    while(lo<hi-1){const m=(lo+hi)>>1;arr[m][0]<t?(lo=m):(hi=m);}
    const a=arr[lo],b=arr[hi],r=(t-a[0])/(b[0]-a[0]);
    return{x:a[xi]+r*(b[xi]-a[xi]),y:a[yi]+r*(b[yi]-a[yi]),lap:Math.max(a[3]||1,b[3]||1),compound:a[4]||'U',tyreLife:a[5]||0};
  }

  function interp(pos,t){return interpArr(pos,t,1,2);}

  function interpTel(tel,t){
    const empty={speed:0,gear:0,rpm:0,throttle:0,brake:0,drs:0};
    if(!tel||!tel.length)return empty;
    const f=tel[0],l=tel[tel.length-1];
    const mk=a=>({speed:a[1],gear:a[2],rpm:a[3],throttle:a[4],brake:a[5],drs:a[6]});
    if(t<=f[0])return mk(f);
    if(t>=l[0])return mk(l);
    let lo=0,hi=tel.length-1;
    while(lo<hi-1){const m=(lo+hi)>>1;tel[m][0]<t?(lo=m):(hi=m);}
    const a=tel[lo],b=tel[hi],r=(t-a[0])/(b[0]-a[0]);
    return{
      speed:Math.round(a[1]+r*(b[1]-a[1])),
      gear:a[2],
      rpm:Math.round(a[3]+r*(b[3]-a[3])),
      throttle:Math.round(a[4]+r*(b[4]-a[4])),
      brake:a[5],drs:a[6],
    };
  }

  function isDNF(drv){return drv.dnf_time!==null&&simTime>drv.dnf_time;}
  function activePit(drv){return drv.pit_windows.find(w=>simTime>=w.tin&&simTime<=w.tout)||null;}
  function curTS(){
    if(!data.track_status?.length)return'1';
    let c=data.track_status[0];
    for(const e of data.track_status){if(e.t<=simTime)c=e;else break;}
    return c.code;
  }

  function drawCircuit(){
    const pts=data.circuit,code=curTS(),style=TS_STYLE[code]||TS_STYLE['1'];
    function path(){
      const[sx,sy]=tc(pts[0][0],pts[0][1]);ctx.beginPath();ctx.moveTo(sx,sy);
      for(let i=1;i<pts.length;i++){const[x,y]=tc(pts[i][0],pts[i][1]);ctx.lineTo(x,y);}
      ctx.closePath();
    }
    ctx.save();ctx.lineJoin='round';ctx.lineCap='round';
    path();ctx.lineWidth=36;ctx.strokeStyle=style.edge||'#1c1c1c';ctx.stroke();
    path();ctx.lineWidth=26;ctx.strokeStyle=style.road;ctx.stroke();
    if(style.glow){
      const alpha=style.pulse?0.45+0.45*Math.sin(Date.now()/260):0.85;
      ctx.globalAlpha=alpha*0.5;
      path();ctx.lineWidth=40;ctx.strokeStyle=style.glow+'18';ctx.stroke();
      ctx.globalAlpha=alpha;
      path();ctx.lineWidth=28;ctx.strokeStyle=style.glow+'44';ctx.stroke();
      ctx.globalAlpha=1;
    }
    ctx.setLineDash([6,14]);
    path();ctx.lineWidth=1;ctx.strokeStyle='rgba(255,255,255,.06)';ctx.stroke();
    ctx.setLineDash([]);ctx.restore();
  }

  function drawDRSZones(){
    const zones=data.drs_zones;
    if(!zones||!zones.length)return;
    const pts=data.circuit;
    ctx.save();ctx.lineJoin='round';ctx.lineCap='round';
    for(const z of zones){
      const si=z.si, ei=z.ei;
      if(si==null||ei==null)continue;
      ctx.beginPath();
      const[sx,sy]=tc(pts[si][0],pts[si][1]);
      ctx.moveTo(sx,sy);
      const end=ei>si?ei:pts.length;
      for(let i=si+1;i<=end&&i<pts.length;i++){
        const[x,y]=tc(pts[i][0],pts[i][1]);ctx.lineTo(x,y);
      }
      ctx.lineWidth=12;ctx.strokeStyle='#00ff8822';ctx.stroke();
      ctx.lineWidth=8;ctx.strokeStyle='#00ff8840';ctx.stroke();
      ctx.lineWidth=4;ctx.strokeStyle='#00ff8899';ctx.stroke();
    }
    ctx.restore();
  }

  function drawCar(cx,cy,angle,color,code,pitting){
    ctx.save();ctx.translate(cx,cy);ctx.rotate(angle);
    const W=20,H=4;
    if(pitting)ctx.globalAlpha=0.68;
    if(!pitting){
      ctx.globalAlpha=0.30;ctx.fillStyle=color;
      ctx.beginPath();ctx.roundRect(-W/2-3,-H/2-3,W+6,H+6,3);ctx.fill();
      ctx.globalAlpha=1;
    }
    ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(-W/2,-H/2,W,H,1);ctx.fill();
    const g=ctx.createLinearGradient(0,-H/2,0,H/2);
    g.addColorStop(0,'rgba(255,255,255,.22)');g.addColorStop(1,'rgba(0,0,0,.30)');
    ctx.fillStyle=g;ctx.beginPath();ctx.roundRect(-W/2,-H/2,W,H,1);ctx.fill();
    ctx.fillStyle='rgba(0,0,0,.5)';
    ctx.beginPath();ctx.ellipse(.5,0,W*.16,H*.30,0,0,Math.PI*2);ctx.fill();
    ctx.globalAlpha=pitting?0.68:1;
    ctx.fillStyle='#fff';ctx.font="700 5px 'Titillium Web',sans-serif";
    ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(code,0,.5);
    ctx.restore();
  }

  function draw(){
    const cw=wrap.offsetWidth,ch=wrap.offsetHeight;
    ctx.clearRect(0,0,cw,ch);ctx.fillStyle='#0c0c0c';ctx.fillRect(0,0,cw,ch);
    drawCircuit();
    drawSectorStripes();
    drawDRSZones();
    for(const drv of data.drivers){
      if(isDNF(drv))continue;
      const pit=activePit(drv);
      if(pit){
        if(pit.path&&pit.path.length>=2){
          const s=interpArr(pit.path,simTime,1,2),s2=interpArr(pit.path,simTime+.5,1,2);
          const[cx,cy]=tc(s.x,s.y),[cx2,cy2]=tc(s2.x,s2.y);
          drawCar(cx,cy,Math.atan2(cy2-cy,cx2-cx),drv.color,drv.code,true);
        }else{
          const s=interp(drv.positions,pit.tin-1),[cx,cy]=tc(s.x,s.y);
          drawCar(cx,cy,0,drv.color,drv.code,true);
        }
      }else{
        const s=interp(drv.positions,simTime),s2=interp(drv.positions,simTime+.5);
        const[cx,cy]=tc(s.x,s.y),[cx2,cy2]=tc(s2.x,s2.y);
        drawCar(cx,cy,Math.atan2(cy2-cy,cx2-cx),drv.color,drv.code,false);
      }
    }
  }

  /* ── TELEMETRY ────────────────────────────────────────────────────────── */
  const colLeft  = document.getElementById('tel-col-left');
  const colRight = document.getElementById('tel-col-right');
  const posClass = r => r===1?'p1':r===2?'p2':r===3?'p3':typeof r==='number'?'top10':'';

  let gridOrder = [];

  function makeTelCard(){
    const c=document.createElement('div');
    c.className='tel-card';
    c.innerHTML=`
      <div class="tel-header">
        <span class="tel-pos">—</span>
        <div class="tel-stripe"></div>
        <span class="tel-name">---</span>
        <span class="tel-speed">0 <span class="tel-speed-unit">km/h</span></span>
      </div>
      <div class="tel-row2">
        <div class="tel-stat"><span class="val gear-val">N</span><span class="lbl">GEAR</span></div>
        <div class="tel-stat"><span class="val rpm-val">0.0k</span><span class="lbl">RPM</span></div>
        <div class="tel-drs">DRS</div>
      </div>
      <div class="tel-bars">
        <div class="bar-row"><span class="bar-lbl">THR</span><div class="bar-track"><div class="bar-fill throttle" style="width:0%"></div></div></div>
        <div class="bar-row"><span class="bar-lbl">BRK</span><div class="bar-track"><div class="bar-fill brake" style="width:0%"></div></div></div>
      </div>`;
    return c;
  }

  function initTelCards(){
    colLeft.innerHTML=''; colRight.innerHTML='';
    for(let i=0;i<10;i++) colLeft.appendChild(makeTelCard());
    for(let i=0;i<10;i++) colRight.appendChild(makeTelCard());
    gridOrder = [...data.drivers].sort((a,b)=>a.grid-b.grid);
  }

  function fillTelCard(card, drv, rank){
    const dnf = isDNF(drv);
    card.style.opacity = dnf ? '0.3' : '1';
    const tel = interpTel(drv.telemetry||[], simTime);
    const posEl = card.querySelector('.tel-pos');
    posEl.textContent = rank;
    posEl.className = 'tel-pos ' + posClass(rank);
    card.querySelector('.tel-stripe').style.background = drv.color;
    card.querySelector('.tel-name').textContent = drv.code;
    card.querySelector('.tel-speed').firstChild.textContent = tel.speed + ' ';
    card.querySelector('.gear-val').textContent = tel.gear || 'N';
    card.querySelector('.rpm-val').textContent = (tel.rpm/1000).toFixed(1) + 'k';
    const drsEl = card.querySelector('.tel-drs');
    if(tel.drs){ drsEl.className='tel-drs on'; drsEl.textContent='DRS ▸'; }
    else        { drsEl.className='tel-drs';    drsEl.textContent='DRS'; }
    card.querySelector('.bar-fill.throttle').style.width = tel.throttle + '%';
    card.querySelector('.bar-fill.brake').style.width = (tel.brake ? 100 : 0) + '%';
  }

  function updateTelemetry(rankMap){
    gridOrder.forEach((drv, i) => {
      const card = i < 10 ? colLeft.children[i] : colRight.children[i - 10];
      fillTelCard(card, drv, rankMap[drv.code] ?? '—');
    });
  }

  /* ── LEADERBOARD ─────────────────────────────────────────────────────── */
  function fmtLap(s){if(!s)return'—';const m=Math.floor(s/60),r=(s%60).toFixed(3);return`${m}:${r.padStart(6,'0')}`;}
  function fmt(s){return`${Math.floor(s/3600)}:${String(Math.floor((s%3600)/60)).padStart(2,'0')}:${String(Math.floor(s%60)).padStart(2,'0')}`;}

  function liveFastestLap(drv) {
    const s = interp(drv.positions, simTime);
    const curLap = s.lap;
    let best = null;
    for (const st of (drv.sector_times ?? [])) {
      if (st.lap >= curLap) continue;
      if (st.s1 == null || st.s2 == null || st.s3 == null) continue;
      const t = st.s1 + st.s2 + st.s3;
      if (best === null || t < best) best = t;
    }
    return best;
  }

  function liveSessionBestSectors() {
    let s1 = null, s2 = null, s3 = null;
    for (const drv of data.drivers) {
      const cur = interp(drv.positions, simTime).lap;
      for (const st of (drv.sector_times ?? [])) {
        if (st.lap >= cur) continue;
        if (st.s1 != null && (s1 === null || st.s1 < s1)) s1 = st.s1;
        if (st.s2 != null && (s2 === null || st.s2 < s2)) s2 = st.s2;
        if (st.s3 != null && (s3 === null || st.s3 < s3)) s3 = st.s3;
      }
    }
    return {s1, s2, s3};
  }

  function buildLeaderboard(){
    const rows=data.drivers.map(drv=>{
      const dnf=isDNF(drv),pit=!!activePit(drv);
      const finished=finishCache[drv.code]!==undefined;
      let prog;
      if(dnf){if(dnfCache[drv.code]===undefined)dnfCache[drv.code]=raceProgress(drv,drv.dnf_time);prog=dnfCache[drv.code];}
      else prog=raceProgress(drv,simTime);
      const s=interp(drv.positions,dnf?drv.dnf_time:simTime);
      return{drv,dnf,pit,finished,prog,compound:s.compound,tyreLife:s.tyreLife};
    });
    rows.sort((a,b)=>a.dnf!==b.dnf?a.dnf?1:-1:b.prog-a.prog);

    const newLdr=rows.find(r=>!r.dnf)?.drv;
    if(newLdr&&currentLeader!==null&&currentLeader!==newLdr.code&&simTime>10){
      triggerLeaderBanner(newLdr.code,newLdr.color,newLdr.team);
    }
    if(newLdr)currentLeader=newLdr.code;

    const rankMap = {};
    let rankCount = 1;
    for(const row of rows){
      rankMap[row.drv.code] = row.dnf ? '—' : rankCount;
      if(!row.dnf) rankCount++;
    }
    updateTelemetry(rankMap);
    modalRankMap = rankMap;   // keep modal in sync
    const avgLapSec=data.meta.session_fastest_lap
      ?(data.drivers.find(d=>d.code===data.meta.session_fastest_lap)?.fastest_lap||90):90;
    function realProg(row){
      if(row.finished){
        const sp=smoothProgressCache[row.drv.code];
        return sp&&sp.length?sp[sp.length-1].p:row.prog;
      }
      return row.prog;
    }
    function fmtGap(diff, leaderProg){
      if(diff<=0)return'—';
      const secs=diff*avgLapSec;
      if(diff>=1&&leaderProg>=1)return`+${Math.floor(diff)}L`;
      if(secs<60)return`+${secs.toFixed(3)}s`;
      return`+${Math.floor(secs/60)}:${String((secs%60).toFixed(3)).padStart(6,'0')}`;
    }
    const realProgs=rows.map(r=>realProg(r));

    const liveFL = {};
    let sessionBestTime = null, sessionBestCode = null;
    for (const drv of data.drivers) {
      const fl = liveFastestLap(drv);
      liveFL[drv.code] = fl;
      if (fl !== null && (sessionBestTime === null || fl < sessionBestTime)) {
        sessionBestTime = fl;
        sessionBestCode = drv.code;
      }
    }

    const lb=document.getElementById('leaderboard');
    lb.innerHTML='';

    // On tablet, split into two side-by-side columns (1–10 left, 11–20 right)
    const isTablet = window.innerWidth >= 768 && window.innerWidth < 1200;
    const isPhone  = window.innerWidth < 768;
    let colA, colB;
    if(isTablet){
      lb.classList.add('lb-two-col');
      colA = document.createElement('div'); colA.className = 'lb-split-col';
      colB = document.createElement('div'); colB.className = 'lb-split-col lb-split-col-right';
      lb.appendChild(colA); lb.appendChild(colB);
    } else {
      lb.classList.remove('lb-two-col');
    }

    // Build phone mini leaderboard (5 cols × 4 rows)
    if(isPhone){
      const phoneLb = document.getElementById('phone-lb');
      if(phoneLb){
        phoneLb.innerHTML = '';
        let phoneRank = 1;
        rows.forEach(r => {
          const { drv, dnf } = r;
          const rk = dnf ? null : phoneRank;
          if(!dnf) phoneRank++;
          const cell = document.createElement('div');
          cell.className = 'plb-cell' + (dnf ? ' is-dnf' : '');
          const posEl = document.createElement('span');
          posEl.className = 'plb-pos' + (rk===1?' p1':rk===2?' p2':rk===3?' p3':'');
          posEl.textContent = rk || '—';
          const codeEl = document.createElement('span');
          codeEl.className = 'plb-code';
          codeEl.textContent = drv.code;
          codeEl.style.color = drv.color;
          cell.appendChild(posEl);
          cell.appendChild(codeEl);
          cell.addEventListener('click', () => openDriverModal(drv));
          phoneLb.appendChild(cell);
        });
      }
    }

    let rank=1;
    const newPrevRankMap={};
    for(let i=0;i<rows.length;i++){
      const{drv,dnf,pit,finished,compound,tyreLife}=rows[i];
      const row=document.createElement('div');
      row.className='lb-row'+(dnf?' is-dnf':'');
      const rk=dnf?'—':rank;
      let pc='';
      if(!dnf){if(rank===1)pc='p1';else if(rank===2)pc='p2';else if(rank===3)pc='p3';else if(rank<=10)pc='top10';}

      let deltaHtml='<span class="lb-delta same">—</span>';
      if(!dnf){
        const prev=prevRankMap[drv.code];
        if(prev!==undefined&&prev!=='—'){
          const diff=prev-rank;
          if(diff>0)      deltaHtml=`<span class="lb-delta up">▲${diff}</span>`;
          else if(diff<0) deltaHtml=`<span class="lb-delta down">▼${Math.abs(diff)}</span>`;
          else             deltaHtml=`<span class="lb-delta same">—</span>`;
        }
        newPrevRankMap[drv.code]=rank;
        rank++;
      } else {
        newPrevRankMap[drv.code]='—';
      }

      let gapLHtml,gapAHtml;
      if(dnf){
        gapLHtml=`<span class="lb-gap"></span>`;
        gapAHtml=`<span class="lb-gap"></span>`;
      }else if(i===0){
        gapLHtml=`<span class="lb-gap gap-leader-label">GAP LDR</span>`;
        gapAHtml=`<span class="lb-gap gap-leader-label">GAP AHD</span>`;
      }else{
        const gL=fmtGap(realProgs[0]-realProgs[i],realProgs[0]),gA=fmtGap(realProgs[i-1]-realProgs[i],realProgs[0]);
        gapLHtml=`<span class="lb-gap${gL.endsWith('L')?' gap-lapped':''}">${gL}</span>`;
        gapAHtml=`<span class="lb-gap${gA.endsWith('L')?' gap-lapped':''}">${gA}</span>`;
      }

      const flTime = liveFL[drv.code];
      const flStr = fmtLap(flTime);
      const flCls = (drv.code === sessionBestCode && flTime !== null) ? 'lb-fl purple' : 'lb-fl';
      const chq=finished?'<span class="lb-chq">🏁</span>':'';
      let badge='';
      if(dnf)badge='<span class="lb-badge badge-dnf">DNF</span>';
      else if(pit)badge='<span class="lb-badge badge-pit">PIT</span>';

      const teamHtml=`<span class="lb-team" style="color:${drv.color}bb">${drv.team||''}</span>`;

      row.innerHTML=`
        ${chq}
        <span class="lb-pos ${pc}">${rk}</span>
        ${deltaHtml}
        <div class="lb-stripe" style="background:${drv.color}${dnf?';opacity:.2':''}"></div>
        <span class="lb-code">${drv.code}</span>
        <div class="lb-div"></div>
        <span class="tyre tyre-${compound}">${compound}</span>
        <span class="lb-tlife">${tyreLife}L</span>
        <div class="lb-div"></div>
        ${teamHtml}
        <div class="lb-div"></div>
        <span class="${flCls}">${flStr}</span>
        <div class="lb-div"></div>
        ${gapAHtml}
        <div class="lb-div"></div>
        ${gapLHtml}
        <div class="lb-div"></div>
        <div class="lb-badge-cell">${badge}</div>`;

      // Only attach hover tooltip on desktop (≥ 1200px)
      if(window.innerWidth >= 1200){
        row.addEventListener('mouseenter', e => showSectorTooltip(e, drv));
        row.addEventListener('mousemove',  e => moveSectorTooltip(e));
        row.addEventListener('mouseleave', hideSectorTooltip);
      }

      // Tablet: click row to open the driver detail modal
      if(window.innerWidth >= 768 && window.innerWidth < 1200){
        row.style.cursor = 'pointer';
        row.addEventListener('click', () => openDriverModal(drv));
      }

      if(isTablet){
        // i < 10 → first 10 sorted entries go left, rest go right
        (i < 10 ? colA : colB).appendChild(row);
      } else {
        lb.appendChild(row);
      }
    }
    prevRankMap = newPrevRankMap;
  }

  /* ── SECTOR TOOLTIP ──────────────────────────────────────────────────── */
  const sttEl      = document.getElementById('sector-tooltip');
  const sttDrv     = document.getElementById('stt-driver');
  const sttCurS1   = document.getElementById('stt-cur-s1');
  const sttCurS2   = document.getElementById('stt-cur-s2');
  const sttCurS3   = document.getElementById('stt-cur-s3');
  const sttBestS1  = document.getElementById('stt-best-s1');
  const sttBestS2  = document.getElementById('stt-best-s2');
  const sttBestS3  = document.getElementById('stt-best-s3');

  function fmtSec(s){ if(!s)return'—'; const m=Math.floor(s/60),r=(s%60).toFixed(3); return m?`${m}:${r.padStart(6,'0')}`:`${r}`; }

  function currentSector(drv, t) {
    if (!sectorBounds) return null;
    // Derive lap fraction from the already-correct smooth progress cache
    // instead of calling lapFrac() directly — lapFrac uses a global spatial
    // snap that fails on Suzuka/Baku/similar circuits.
    const prog = getSmoothProgress(drv, t);
    const frac = prog - Math.floor(Math.max(0, prog));
    const {s1End, s2End} = sectorBounds;
    const s1Frac = arc[s1End] / arcTotal;
    const s2Frac = arc[s2End] / arcTotal;
    if (frac < s1Frac) return 1;
    if (frac < s2Frac) return 2;
    return 3;
  }

  function showSectorTooltip(e, drv) {
    const tEff = (drv.dnf_time !== null && simTime > drv.dnf_time) ? drv.dnf_time : simTime;
    const s = interp(drv.positions, tEff);
    const curLap = s.lap;
    const allSectors = drv.sector_times ?? [];
    const inSector = currentSector(drv, tEff);

    const preRace = simTime < GRID_SECS + 2;
    const prevLapData = allSectors.find(x => x.lap === curLap - 1) ?? {};
    const curLapData  = allSectors.find(x => x.lap === curLap)     ?? {};

    const showS1 = preRace ? null
      : inSector >= 2 ? (curLapData.s1 ?? null)
      : (prevLapData.s1 ?? null);
    const showS2 = preRace ? null
      : inSector >= 3 ? (curLapData.s2 ?? null)
      : (prevLapData.s2 ?? null);
    const showS3 = preRace ? null : (prevLapData.s3 ?? null);

    let bestLapData = null, bestLapTime = Infinity;
    for (const st of allSectors) {
      if (st.lap >= curLap) continue;
      if (st.s1 != null && st.s2 != null && st.s3 != null) {
        const total = st.s1 + st.s2 + st.s3;
        if (total < bestLapTime) { bestLapTime = total; bestLapData = st; }
      }
    }

    const blS1 = bestLapData?.s1 ?? null;
    const blS2 = bestLapData?.s2 ?? null;
    const blS3 = bestLapData?.s3 ?? null;

    const sessBest = liveSessionBestSectors();

    function curClass(val, bestLapVal, sessBestVal) {
      if (!val) return 'grey';
      if (sessBestVal !== null && val <= sessBestVal + 0.001) return 'purple';
      if (bestLapVal && val < bestLapVal - 0.001) return 'green';
      if (bestLapVal && val > bestLapVal + 0.001) return 'red';
      return 'grey';
    }
    function bestClass(val, sessBestVal) {
      if (!val) return 'grey';
      if (sessBestVal !== null && val <= sessBestVal + 0.001) return 'purple';
      return 'active';
    }

    sttDrv.textContent = `${drv.code} — LAP ${curLap}`;
    sttDrv.style.color = drv.color;

    [[sttCurS1, showS1, blS1, sessBest.s1],
     [sttCurS2, showS2, blS2, sessBest.s2],
     [sttCurS3, showS3, blS3, sessBest.s3]]
      .forEach(([el, val, bestLapVal, sessBestVal]) => {
        el.textContent = fmtSec(val);
        el.className = 'stt-time ' + curClass(val, bestLapVal, sessBestVal);
      });

    [[sttBestS1, blS1, sessBest.s1],
     [sttBestS2, blS2, sessBest.s2],
     [sttBestS3, blS3, sessBest.s3]]
      .forEach(([el, val, sessBestVal]) => {
        el.textContent = fmtSec(val);
        el.className = 'stt-time ' + bestClass(val, sessBestVal);
      });

    sttEl.style.display = 'block';
    moveSectorTooltip(e);
  }

  function moveSectorTooltip(e){
    const pad=12, w=sttEl.offsetWidth, h=sttEl.offsetHeight;
    let x=e.clientX-w-pad, y=e.clientY-h/2;
    if(x<4) x=e.clientX+pad;
    if(y<4) y=4;
    if(y+h>window.innerHeight-4) y=window.innerHeight-h-4;
    sttEl.style.left=x+'px'; sttEl.style.top=y+'px';
  }
  function hideSectorTooltip(){ sttEl.style.display='none'; }

  /* ── TABLET DRIVER MODAL ─────────────────────────────────────────────── */
  const drvModal        = document.getElementById('drv-modal');
  const drvModalBackdrop= document.getElementById('drv-modal-backdrop');
  const drvModalClose   = document.getElementById('drv-modal-close');
  let   modalDriver     = null;   // driver currently shown in the modal
  let   modalRankMap    = {};     // latest rank map so we can display P#

  function openDriverModal(drv) {
    modalDriver = drv;
    // Header
    document.getElementById('drv-modal-stripe').style.background = drv.color;
    document.getElementById('drv-modal-code').textContent  = drv.code;
    document.getElementById('drv-modal-code').style.color  = drv.color;
    document.getElementById('drv-modal-team').textContent  = drv.team || '';
    // Populate immediately, then the animate loop keeps it fresh
    refreshDriverModal();
    drvModal.classList.add('open');
    drvModal.setAttribute('aria-hidden', 'false');
  }

  function closeDriverModal() {
    drvModal.classList.remove('open');
    drvModal.setAttribute('aria-hidden', 'true');
    // Clear driver reference after transition so panel doesn't flash stale data
    setTimeout(() => { if (!drvModal.classList.contains('open')) modalDriver = null; }, 300);
  }

  drvModalClose.addEventListener('click', closeDriverModal);
  drvModalBackdrop.addEventListener('click', closeDriverModal);

  function refreshDriverModal() {
    if (!modalDriver || !data) return;
    const drv = modalDriver;
    const tEff = (drv.dnf_time !== null && simTime > drv.dnf_time) ? drv.dnf_time : simTime;

    // ── Position + lap ──
    const rank = modalRankMap[drv.code];
    const posEl = document.getElementById('drv-modal-pos');
    posEl.textContent = rank ? 'P' + rank : '—';
    if      (rank === 1) posEl.style.color = '#ffd700';
    else if (rank === 2) posEl.style.color = '#c0c0c0';
    else if (rank === 3) posEl.style.color = '#cd7f32';
    else                 posEl.style.color = 'var(--bright)';

    const s = interp(drv.positions, tEff);
    document.getElementById('drv-modal-lap').textContent = 'LAP ' + s.lap;

    // ── Telemetry ──
    const tel = interpTel(drv.telemetry || [], tEff);
    document.getElementById('dmt-speed').textContent = tel.speed;
    document.getElementById('dmt-gear').textContent  = tel.gear || 'N';
    document.getElementById('dmt-rpm').textContent   = (tel.rpm / 1000).toFixed(1) + 'k';

    const drsEl = document.getElementById('dmt-drs');
    if (tel.drs) { drsEl.className = 'tel-drs on'; drsEl.textContent = 'DRS ▸'; }
    else         { drsEl.className = 'tel-drs';    drsEl.textContent = 'DRS'; }

    document.getElementById('dmt-throttle').style.width = tel.throttle + '%';
    document.getElementById('dmt-brake').style.width    = (tel.brake ? 100 : 0) + '%';

    // Tyre
    const tyreEl = document.getElementById('dmt-tyre');
    tyreEl.className = `tyre tyre-${s.compound}`;
    tyreEl.textContent = s.compound;
    document.getElementById('dmt-tlife').textContent = s.tyreLife + 'L';

    // ── Sector times (same logic as showSectorTooltip) ──
    const allSectors = drv.sector_times ?? [];
    const curLap     = s.lap;
    const inSector   = currentSector(drv, tEff);
    const preRace    = simTime < GRID_SECS + 2;
    const prevLapData = allSectors.find(x => x.lap === curLap - 1) ?? {};
    const curLapData  = allSectors.find(x => x.lap === curLap)     ?? {};

    const showS1 = preRace ? null : inSector >= 2 ? (curLapData.s1 ?? null) : (prevLapData.s1 ?? null);
    const showS2 = preRace ? null : inSector >= 3 ? (curLapData.s2 ?? null) : (prevLapData.s2 ?? null);
    const showS3 = preRace ? null : (prevLapData.s3 ?? null);

    let bestLapData = null, bestLapTime = Infinity;
    for (const st of allSectors) {
      if (st.lap >= curLap) continue;
      if (st.s1 != null && st.s2 != null && st.s3 != null) {
        const tot = st.s1 + st.s2 + st.s3;
        if (tot < bestLapTime) { bestLapTime = tot; bestLapData = st; }
      }
    }
    const blS1 = bestLapData?.s1 ?? null;
    const blS2 = bestLapData?.s2 ?? null;
    const blS3 = bestLapData?.s3 ?? null;
    const sessBest = liveSessionBestSectors();

    function curClass(val, blv, sbv) {
      if (!val) return 'grey';
      if (sbv !== null && val <= sbv + 0.001) return 'purple';
      if (blv && val < blv - 0.001) return 'green';
      if (blv && val > blv + 0.001) return 'red';
      return 'grey';
    }
    function bestClass(val, sbv) {
      if (!val) return 'grey';
      if (sbv !== null && val <= sbv + 0.001) return 'purple';
      return 'active';
    }

    [[document.getElementById('dmt-cur-s1'),  showS1, blS1, sessBest.s1],
     [document.getElementById('dmt-cur-s2'),  showS2, blS2, sessBest.s2],
     [document.getElementById('dmt-cur-s3'),  showS3, blS3, sessBest.s3]]
      .forEach(([el, val, blv, sbv]) => {
        el.textContent = fmtSec(val);
        el.className   = 'dms-cell stt-time ' + curClass(val, blv, sbv);
      });

    [[document.getElementById('dmt-best-s1'), blS1, sessBest.s1],
     [document.getElementById('dmt-best-s2'), blS2, sessBest.s2],
     [document.getElementById('dmt-best-s3'), blS3, sessBest.s3]]
      .forEach(([el, val, sbv]) => {
        el.textContent = fmtSec(val);
        el.className   = 'dms-cell stt-time ' + bestClass(val, sbv);
      });
  }

  /* ── RACE CONTROL ────────────────────────────────────────────────────── */
  const rcLog=document.getElementById('rc-log');
  rcLog.addEventListener('scroll',()=>{rcScrolled=rcLog.scrollHeight-rcLog.scrollTop-rcLog.clientHeight>40;});
  function updateRaceControl(){
    if(!data.race_control?.length)return;
    const entries=data.race_control;
    if(rcPointer>0&&entries[rcPointer-1].t>simTime){
      let lo=0,hi=rcPointer-1;
      while(lo<hi){const m=(lo+hi)>>1;entries[m].t<=simTime?(lo=m+1):(hi=m);}
      rcPointer=lo;
      rcLog.innerHTML='';rcShown=0;rcScrolled=false;
      for(let i=0;i<rcPointer;i++){
        const e=entries[i];
        const el=document.createElement('div');el.className=`rc-entry type-${e.type}`;
        el.innerHTML=`<div class="rc-time">${fmt(e.t)}</div><div class="rc-msg">${e.msg}</div>`;
        rcLog.appendChild(el);
      }
      if(!rcScrolled)rcLog.scrollTop=rcLog.scrollHeight;
      return;
    }
    while(rcPointer<entries.length&&entries[rcPointer].t<=simTime){
      const e=entries[rcPointer];
      const el=document.createElement('div');el.className=`rc-entry type-${e.type}`;
      el.innerHTML=`<div class="rc-time">${fmt(e.t)}</div><div class="rc-msg">${e.msg}</div>`;
      rcLog.appendChild(el);
      rcPointer++;
    }
    if(!rcScrolled)rcLog.scrollTop=rcLog.scrollHeight;
  }

  function updateLapCounter(){
    let mx=1;
    for(const drv of data.drivers){if(isDNF(drv))continue;const s=interp(drv.positions,simTime);if(s.lap>mx)mx=s.lap;}
    document.getElementById('lap-cur').textContent=mx;
  }

  /* ── WEATHER ─────────────────────────────────────────────────────────── */
  function updateWeather(){
    const wx=data.weather;
    if(!wx||!wx.length)return;
    let cur=wx[0];
    for(const e of wx){ if(e.t<=simTime) cur=e; else break; }
    const airEl   = document.getElementById('wx-air');
    const trkEl   = document.getElementById('wx-track');
    const humEl   = document.getElementById('wx-hum');
    const presEl  = document.getElementById('wx-pres');
    const windEl  = document.getElementById('wx-wind');
    const rainEl  = document.getElementById('wx-rain');
    function setVal(el, val){
      const unit = el.querySelector('.wx-unit');
      el.firstChild.textContent = val;
      if(unit && !el.contains(unit)) el.appendChild(unit);
    }
    setVal(airEl,  cur.air.toFixed(1));
    setVal(trkEl,  cur.track.toFixed(1));
    setVal(humEl,  cur.humidity.toFixed(0));
    setVal(presEl, cur.pressure.toFixed(1));
    const dirs=['N','NE','E','SE','S','SW','W','NW'];
    const compass = dirs[Math.round(cur.wind_dir/45)%8];
    const windSpan = windEl.querySelector('.wx-unit');
    windEl.firstChild.textContent = cur.wind_speed.toFixed(1);
    windSpan.textContent = ` km/h ${compass}`;
    if(cur.rainfall){
      rainEl.textContent='RAIN';
      rainEl.className='wx-val wx-rain-wet';
    } else {
      rainEl.textContent='DRY';
      rainEl.className='wx-val wx-rain-dry';
    }
  }

  function updateHUD(){
    const f=Math.min(simTime/tMax,1);
    document.getElementById('sim-clock').textContent=fmt(simTime);
    document.getElementById('scrub-fill').style.width=(f*100)+'%';
    document.getElementById('scrub-cur').textContent=fmt(simTime);
    document.getElementById('scrub-end').textContent=fmt(tMax);
  }
  function setPlayBtn(){const b=document.getElementById('play-btn');b.textContent=playing?'⏸  PAUSE':'▶  PLAY';b.classList.toggle('active',playing);}

  function animate(ts){
    if(playing&&lastTS!==null){simTime+=((ts-lastTS)/1000)*speed;if(simTime>=tMax){simTime=tMax;playing=false;setPlayBtn();lastTS=null;}}
    if(playing)lastTS=ts;
    if(data){draw();updateHUD();updateRaceControl();
      if(playing)checkFlashEvents();
      if(ts-lbTick>150){
        buildLeaderboard();updateLapCounter();updateWeather();lbTick=ts;
        if(drvModal && drvModal.classList.contains('open')) refreshDriverModal();
        let cl=1;for(const drv of data.drivers){if(!isDNF(drv)){const s=interp(drv.positions,simTime);if(s.lap>cl)cl=s.lap;}}
        if(cl!==lastChartLap){drawPosChart();lastChartLap=cl;}
      }
    }
    requestAnimationFrame(animate);
  }

  document.getElementById('play-btn').addEventListener('click',()=>{playing=!playing;if(!playing)lastTS=null;setPlayBtn();});
  document.querySelectorAll('.speed-btn').forEach(b=>{b.addEventListener('click',()=>{speed=parseInt(b.dataset.speed);document.querySelectorAll('.speed-btn').forEach(x=>x.classList.remove('active'));b.classList.add('active');});});
  const scrubEl=document.getElementById('scrubber');
  let scrubbing=false;
  function scrubTo(e){
    const r=scrubEl.getBoundingClientRect();
    simTime=Math.max(0,Math.min(1,(e.clientX-r.left)/r.width))*tMax;
    Object.keys(dnfCache).forEach(k=>delete dnfCache[k]);
    Object.keys(finishCache).forEach(k=>delete finishCache[k]);
    finishCounter=1;
    rcShown=0;rcPointer=0;rcLog.innerHTML='';rcScrolled=false;
    flashPointer=0;
    if(flBanner)flBanner.classList.remove('show');
    if(ldBanner)ldBanner.classList.remove('show');
    buildLeaderboard();updateRaceControl();
  }
  scrubEl.addEventListener('mousedown',e=>{scrubbing=true;scrubTo(e);});
  window.addEventListener('mousemove',e=>{if(scrubbing)scrubTo(e);});
  window.addEventListener('mouseup',()=>{scrubbing=false;});

  /* ── GP SELECTOR ─────────────────────────────────────────────────────── */
  const GP_LIST = [
    { round:1,  name:'Australian Grand Prix',    flag:'🇦🇺' },
    { round:2,  name:'Chinese Grand Prix',        flag:'🇨🇳' },
    { round:3,  name:'Japanese Grand Prix',       flag:'🇯🇵' },
    { round:4,  name:'Bahrain Grand Prix',        flag:'🇧🇭' },
    { round:5,  name:'Saudi Arabian Grand Prix',  flag:'🇸🇦' },
    { round:6,  name:'Miami Grand Prix',          flag:'🇺🇸' },
    { round:7,  name:'Emilia Romagna Grand Prix', flag:'🇮🇹' },
    { round:8,  name:'Monaco Grand Prix',         flag:'🇲🇨' },
    { round:9,  name:'Canadian Grand Prix',       flag:'🇨🇦' },
    { round:10, name:'Spanish Grand Prix',        flag:'🇪🇸' },
    { round:11, name:'Austrian Grand Prix',       flag:'🇦🇹' },
    { round:12, name:'British Grand Prix',        flag:'🇬🇧' },
    { round:13, name:'Hungarian Grand Prix',      flag:'🇭🇺' },
    { round:14, name:'Belgian Grand Prix',        flag:'🇧🇪' },
    { round:15, name:'Dutch Grand Prix',          flag:'🇳🇱' },
    { round:16, name:'Italian Grand Prix',        flag:'🇮🇹' },
    { round:17, name:'Azerbaijan Grand Prix',     flag:'🇦🇿' },
    { round:18, name:'Singapore Grand Prix',      flag:'🇸🇬' },
    { round:19, name:'United States Grand Prix',  flag:'🇺🇸' },
    { round:20, name:'Mexico City Grand Prix',    flag:'🇲🇽' },
    { round:21, name:'São Paulo Grand Prix',      flag:'🇧🇷' },
    { round:22, name:'Las Vegas Grand Prix',      flag:'🇺🇸' },
    { round:23, name:'Qatar Grand Prix',          flag:'🇶🇦' },
    { round:24, name:'Abu Dhabi Grand Prix',      flag:'🇦🇪' },
  ];

  let currentRound = 1;
  let availableRounds = new Set();

  const gpBtn      = document.getElementById('gp-btn');
  const gpDropdown = document.getElementById('gp-dropdown');

  function openDropdown()  { gpDropdown.classList.add('open'); gpBtn.classList.add('open'); }
  function closeDropdown() { gpDropdown.classList.remove('open'); gpBtn.classList.remove('open'); }

  gpBtn.addEventListener('click', e => {
    e.stopPropagation();
    gpDropdown.classList.contains('open') ? closeDropdown() : openDropdown();
  });

  // Close when tapping outside — but only if the tap wasn't inside the selector wrap.
  // This prevents iOS from closing the dropdown before loadRound() can fire.
  document.addEventListener('click', e => {
    if (!document.getElementById('gp-selector-wrap').contains(e.target)) closeDropdown();
  });

  function buildDropdown() {
    gpDropdown.innerHTML = '';
    GP_LIST.forEach(gp => {
      const avail = availableRounds.has(gp.round);
      const el = document.createElement('div');
      el.className = 'gp-item' + (!avail ? ' unavailable' : '') + (gp.round === currentRound ? ' active' : '');
      el.innerHTML = `<span class="gp-flag">${gp.flag}</span><span class="gp-round">R${String(gp.round).padStart(2,'0')}</span><span class="gp-name">${gp.name.toUpperCase()}</span>`;
      if (avail) {
        // touchend fires reliably on iOS/iPad — handle it before the DOM can change
        el.addEventListener('touchend', e => {
          e.preventDefault(); // suppress the 300ms ghost click
          e.stopPropagation();
          loadRound(gp.round);
          setTimeout(closeDropdown, 0); // defer so DOM removal doesn't abort the event
        });
        // click handles desktop and non-touch fallback
        el.addEventListener('click', e => {
          e.stopPropagation();
          loadRound(gp.round);
          setTimeout(closeDropdown, 0);
        });
      }
      gpDropdown.appendChild(el);
    });
  }

  function resetState() {
    simTime=0; playing=false; lastTS=null; lbTick=-999;
    Object.keys(dnfCache).forEach(k=>delete dnfCache[k]);
    Object.keys(finishCache).forEach(k=>delete finishCache[k]);
    finishCounter=1; rcShown=0; rcPointer=0; rcScrolled=false; rcLog.innerHTML='';
    prevRankMap={}; flashPointer=0; currentLeader=null; lastChartLap=-1;
    if(flBanner){flBanner.classList.remove('show');}
    if(ldBanner){ldBanner.classList.remove('show');}
    setPlayBtn();
  }

  function loadRound(round) {
    currentRound = round;
    resetState();
    document.getElementById('loading').style.display='';
    document.querySelector('.load-label').textContent='Loading Telemetry';
    document.querySelectorAll('.gp-item').forEach((el,i)=>el.classList.toggle('active', GP_LIST[i].round===round));
    fetch(`public/round_${round}.json`)
      .then(r=>{ if(!r.ok) throw new Error('not found'); return r.json(); })
      .then(d=>{
        data=d; tMax=d.meta.duration; arc=d.arc; arcTotal=d.meta.arc_total;
        const gp = GP_LIST.find(g=>g.round===round);
        document.getElementById('event-title').textContent = gp ? gp.name.toUpperCase() : d.meta.event.toUpperCase();
        document.getElementById('lap-tot').textContent = d.meta.total_laps||'?';
        document.getElementById('loading').style.display='none';
        buildSpatialGrid();
        buildSectorBounds();
        buildFlashEvents();
        data.drivers.forEach(drv => buildSmoothProgress(drv));
        buildLapRankings();
        currentLeader=null; lastChartLap=-1;
        initTelCards();
        resize(); buildLeaderboard(); updateLapCounter(); updateWeather(); updateRaceControl();
        setTimeout(drawPosChart, 100);
      })
      .catch(err=>{ document.querySelector('.load-label').textContent='Failed to load data'; console.error(err); });
  }

  Promise.all(GP_LIST.map(gp =>
    fetch(`public/round_${gp.round}.json`,{method:'HEAD'})
      .then(r=>r.ok?gp.round:null).catch(()=>null)
  )).then(results=>{
    results.forEach(r=>{ if(r!==null) availableRounds.add(r); });
    buildDropdown();
  });

  loadRound(1);
  requestAnimationFrame(animate);
})();
