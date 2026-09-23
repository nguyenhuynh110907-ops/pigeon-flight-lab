import {Simulation,DEFAULTS,PRESETS,BOXES,FT,KT,clamp,aircraftVelocity} from './model.mjs';
const $=id=>document.getElementById(id);
const number=(x,d=0)=>Number(x).toLocaleString('vi-VN',{minimumFractionDigits:d,maximumFractionDigits:d});
const rangeKeys=['count','speed','aircraftAlt','birdAlt','detection','latency','birdSpeed','accel','offset','distance','flightAngle','soundLevel','noiseLevel','snrMargin','lightIntensity','lightPulse','lightThreshold','horizon'];
const numericSelects=['verticalRate','soundHz','lightNm'];
const checkKeys=['social','centerLock','ballistic','predator','soundOn','lightOn','signalResponse'];
const phaseNames={landing:'Hạ cánh',takeoff:'Cất cánh',level:'Bay ngang',custom:'Đứng thủ công'};
const triggerNames={aircraft:'ngưỡng phát hiện máy bay',sound:'mốc âm thanh giả định',light:'mốc ánh sáng giả định',predator:'chim cắt robot',social:'cảnh báo từ chim lân cận'};
let params={...DEFAULTS},sim=new Simulation(params),playing=false,calculating=false,lastFrame=0,uiElapsed=0,toastTimer;
const colors={cruise:'#68d9d0',alert:'#f2bc66',escape:'#def48a',contact:'#f78092'};
const formats={count:x=>`${x} con`,speed:x=>`${x} kt`,aircraftAlt:x=>`${number(x)} ft`,birdAlt:x=>`${number(x)} ft`,detection:x=>`${number(x)} m`,latency:x=>`${number(x,2)} s`,birdSpeed:x=>`${x} m/s`,accel:x=>`${x} m/s²`,offset:x=>`${x>0?'+':''}${x} m`,distance:x=>`${number(x)} m`,flightAngle:x=>`${number(x,1)}°`,soundLevel:x=>`${x} dB SPL`,noiseLevel:x=>`${x} dB SPL`,snrMargin:x=>`${x} dB`,lightIntensity:x=>`${x} mW/sr`,lightPulse:x=>x?`${number(x,1)} Hz`:'Liên tục',lightThreshold:x=>`${number(x,1)} µW/m²`,horizon:x=>`${number(x,1)} s`};
function syncControls(){
  for(const key of rangeKeys){const el=$(key);el.value=params[key];$(key+'-out').textContent=formats[key](params[key]);el.style.setProperty('--pct',`${(params[key]-Number(el.min))/(Number(el.max)-Number(el.min))*100}%`);}
  for(const k of ['heading','escape','phase','seed',...numericSelects])$(k).value=params[k];
  for(const k of checkKeys)$(k).checked=params[k];
  $('aircraftAlt').disabled=params.centerLock;$('offset').disabled=params.centerLock;
  if(params.centerLock){$('aircraftAlt-out').textContent=`${number(sim.initialPlane[2]/FT)} ft · tự căn`;$('offset-out').textContent='0 m · tự căn';}
  $('flightAngle').disabled=['level','custom'].includes(params.phase);
  $('manual-rate').hidden=params.phase!=='custom';
  $('phase-note').textContent=params.phase==='landing'?'3° là đường lượn ILS thông thường theo FAA. Chưa mô phỏng flare/chạm bánh.':params.phase==='takeoff'?'Góc lấy độ cao là giả định để khảo sát, không phải dữ liệu hiệu năng A320. Đoạn bay sau nhấc bánh.':params.phase==='level'?'Giữ nguyên độ cao máy bay trong lượt này.':'Tốc độ đứng do người dùng chọn, không gắn với hiệu năng máy bay.';
  $('sound-preview').disabled=params.soundHz>6400;
  const vx=params.speed*KT-(params.heading==='headon'?-1:params.heading==='following'?1:0)*params.birdSpeed;
  const vy=params.heading==='crossing'?params.birdSpeed:0;
  const relSpeed=Math.hypot(vx,vy,aircraftVelocity(params)[2]),available=params.detection/relSpeed;
  $('available-time').textContent=`${number(available,2)} s`;
  const margin=available-params.latency;
  $('available-note').textContent=`Trừ độ trễ: ${number(margin,2)} s. Ước lượng nếu bay vào cùng điểm; chưa trừ thời gian rẽ.`;
  $('available-time').style.color=margin<=0?'var(--pink)':'var(--lime)';
}
function setParams(p,preset='custom'){
  const next=new Simulation({...params,...p});
  params={...next.p};sim=next;playing=false;calculating=false;$('preset').value=preset;
  syncControls();update();draw();
}
function restart(){sim=new Simulation(params);playing=false;calculating=false;update();draw();}
function togglePlay(){if(!sim.validPlan)return;calculating=false;if(sim.done)sim=new Simulation(params);playing=!playing;lastFrame=0;update();}
for(const key of rangeKeys)$(key).addEventListener('input',()=>setParams({[key]:Number($(key).value)}));
for(const key of ['heading','escape','phase',...numericSelects])$(key).addEventListener('change',()=>setParams({[key]:numericSelects.includes(key)?Number($(key).value):$(key).value}));
$('seed').addEventListener('change',()=>{try{setParams({seed:Number($('seed').value)});}catch{syncControls();toast('Nhập hạt giống từ 1 đến 999999.');}});
for(const key of checkKeys)$(key).addEventListener('change',()=>setParams({[key]:$(key).checked}));
$('preset').addEventListener('change',()=>{if(PRESETS[$('preset').value])setParams(PRESETS[$('preset').value],$('preset').value);});
$('new-seed').addEventListener('click',()=>setParams({seed:params.seed===999999?1:params.seed+1}));
$('play').addEventListener('click',togglePlay);$('reset').addEventListener('click',restart);
async function finishRun(){
  playing=false;calculating=true;const run=sim;update();
  while(!run.done&&sim===run&&calculating){
    const started=performance.now();
    do{run.step();}while(!run.done&&performance.now()-started<12);
    update();draw();
    // Yield between chunks even if this tab is backgrounded (rAF pauses there).
    await new Promise(resolve=>{const channel=new MessageChannel();channel.port1.onmessage=()=>{channel.port1.close();channel.port2.close();resolve();};channel.port2.postMessage(null);});
  }
  if(sim===run){calculating=false;update();draw();}
  return run.summary();
}
$('finish').addEventListener('click',finishRun);
$('sound-preview').addEventListener('click',async()=>{
  const AudioContext=window.AudioContext||window.webkitAudioContext;if(!AudioContext){toast('Trình duyệt không hỗ trợ nghe âm mẫu.');return;}
  try{const ctx=new AudioContext();await ctx.resume();const oscillator=ctx.createOscillator(),gain=ctx.createGain();oscillator.type='sine';oscillator.frequency.value=params.soundHz;gain.gain.setValueAtTime(0,ctx.currentTime);gain.gain.linearRampToValueAtTime(.015,ctx.currentTime+.025);gain.gain.setValueAtTime(.015,ctx.currentTime+.35);gain.gain.linearRampToValueAtTime(0,ctx.currentTime+.4);oscillator.connect(gain);gain.connect(ctx.destination);oscillator.start();oscillator.stop(ctx.currentTime+.41);oscillator.onended=()=>ctx.close();toast(`Âm mẫu ${number(params.soundHz)} Hz · âm lượng không tương ứng dB mô hình.`);}catch{toast('Chưa phát được âm mẫu trên thiết bị này.');}
});
document.addEventListener('keydown',e=>{if(e.code==='Space'&&!['INPUT','SELECT','TEXTAREA','BUTTON'].includes(e.target.tagName)&&!$('method-dialog').open){e.preventDefault();togglePlay();}});
function showMethod(){playing=false;calculating=false;update();$('method-dialog').showModal();}
$('open-method').addEventListener('click',showMethod);$('open-method-bottom').addEventListener('click',showMethod);
$('close-method').addEventListener('click',()=>$('method-dialog').close());
$('method-dialog').addEventListener('click',e=>{if(e.target===$('method-dialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}});
function toast(message){$('toast').textContent=message;$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),2800);}
function update(){
  $('distance-value').innerHTML=`${number(sim.centerDistance)} <em>m</em>`;
  $('reaction-value').innerHTML=sim.reactionMedian===null?'—':`${number(sim.reactionMedian)} <em>m</em>`;
  $('clearance-value').innerHTML=Number.isFinite(sim.clearance)?`${number(sim.clearance,1)} <em>m</em>`:'—';
  $('contact-value').innerHTML=`${sim.contacts} <em>/ ${params.count}</em>`;
  $('contact-value').classList.toggle('danger',sim.contacts>0);
  $('clearance-value').classList.toggle('danger',sim.clearance<=10);
  $('detected-count').textContent=sim.detected;$('reacted-count').textContent=sim.reacted;$('near-count').textContent=sim.near;
  $('cpa-value').textContent=sim.cpa?`${number(sim.cpa.time,1)} s`:sim.t?'Đã qua':'—';
  $('sim-status').textContent=!sim.validPlan?'Cần chỉnh độ cao':sim.done?'Hoàn tất':calculating?'Đang tính':playing?'Đang mô phỏng':sim.t?'Tạm dừng':'Sẵn sàng';
  $('sim-status').style.color=sim.contacts?'var(--pink)':'var(--lime)';
  $('play').innerHTML=playing?'<span aria-hidden="true">Ⅱ</span> Tạm dừng':sim.done?'<span aria-hidden="true">↺</span> Chạy lại':'<span aria-hidden="true">▶</span> Chạy mô phỏng';
  $('play').disabled=!sim.validPlan;$('finish').disabled=sim.done||calculating;
  $('time-value').textContent=`${number(sim.t,1)} s`;$('duration-value').textContent=`/ ${number(sim.duration,1)} s`;
  $('timeline-progress').style.width=`${Math.min(100,sim.t/sim.duration*100)}%`;
  const first=sim.events.find(e=>e.kind==='alert');
  let text=params.ballistic?'Đối chứng: từng chim giữ nguyên vận tốc, kể cả khi nhận tín hiệu. Cắt tâm không đồng nghĩa mọi chim giao cắt.':'Nhấn Chạy mô phỏng. Các dấu chim được phóng to; vị trí và khoảng cách dùng đơn vị thật.';
  if(sim.t>0&&!first&&!params.ballistic)text='Chưa có kênh nào kích hoạt chờ né. Đàn đang giữ hướng bay và tương tác với láng giềng.';
  if(first)text=`Kích hoạt đầu tiên: ${triggerNames[first.source]}, lúc ${number(first.time,2)} s; máy bay cách ${number(first.distance)} m. ${sim.reacted}/${params.count} chim đã bắt đầu né.`;
  if(sim.contacts)text+=` Có ${sim.contacts} đường đi giao cắt khối máy bay.`;
  if(sim.done)text=(sim.endReason||'Hoàn tất.')+' '+(first?`Kênh đầu tiên: ${triggerNames[first.source]}. `:params.ballistic?'Đối chứng giữ vận tốc. ':'Không kích hoạt né. ')+`${sim.contacts}/${params.count} chim giao cắt; ${sim.near} chim từng cách khối máy bay ≤10 m. Đây là kết quả mô hình.`;
  if(!sim.validPlan)text=sim.planNote;
  if($('narrative').textContent!==text)$('narrative').textContent=text;
  const alt=sim.plane.pos[2]/FT;
  $('altitude-context').textContent=`Máy bay hiện ở ${number(alt)} ft (${number(sim.plane.pos[2])} m) AGL — ${alt<=500?'nằm trong dải 0–500 ft':'cao hơn dải 0–500 ft'}. Độ chênh với tâm đàn: ${number(Math.abs(sim.center[2]-sim.plane.pos[2]))} m.`;
  $('intercept-status').textContent=!sim.validPlan?sim.planNote:params.centerLock?`Giao cắt danh định: ${number(sim.nominalMiss,3)} m sai lệch tại ${number(sim.nominalTime,2)} s · ${number(params.birdAlt)} ft AGL. Chim có thể rời điểm hẹn khi rẽ.`:`Không khóa tâm · lệch ${number(sim.nominalMiss,1)} m khi bằng tọa độ dọc trục bay.`;
  $('intercept-status').classList.toggle('danger',!sim.validPlan);
  $('phase-badge').textContent=`${phaseNames[params.phase]} · ${sim.plane.vel[2]>0?'+':''}${number(sim.plane.vel[2],2)} m/s`;
  $('horizon-label').textContent=number(params.horizon,1);
  $('center-cpa').textContent=sim.contacts===params.count?'Không còn chim bay':sim.centerCPA?.approaching?`${number(sim.centerCPA.distance,1)} m / ${number(sim.centerCPA.time,1)} s`:'Đã qua cận tiếp';
  $('future-alt').textContent=sim.contacts===params.count?'—':`${number(sim.predictedCenter[2]/FT,1)} ft`;
  const heading=Math.atan2(sim.meanVelocity[1],sim.meanVelocity[0])*180/Math.PI;
  $('future-heading').textContent=`Vận tốc tâm ${number(Math.hypot(...sim.meanVelocity),1)} m/s · hướng ${number(heading)}° từ +X`;
  $('prediction-error').textContent=sim.predictionRMSE===null?'Chờ đủ H giây':`${number(sim.predictionRMSE,2)} m`;
  for(const [key,label] of [['left','Trái +Y'],['right','Phải −Y'],['down','Xuống']])$('direction-'+key).textContent=`${label}: ${sim.directions[key]}`;
  $('signal-mode').textContent=params.ballistic?'Đối chứng · không phản ứng':params.signalResponse?'Giả thuyết phản ứng':'Chỉ đo tín hiệu';
  const sound=sim.sound,light=sim.light;
  $('sound-level').textContent=!params.soundOn?'Tắt':!sound.arrived?'Âm chưa tới':`${number(sound.spl,1)} dB SPL`;
  $('sound-detail').textContent=`Doppler: ${number(sound.frequency)} Hz · trễ truyền ${number(sound.delay,2)} s`;
  $('sound-evidence').textContent=sound.criterion===null?sound.reference.note:`${sound.reference.note}. Mốc có nền âm: ${number(sound.criterion)} dB SPL. ${!params.soundOn?'Nguồn đang tắt; các trị số trên là tính toán nếu bật.':sound.arrived?(sound.aboveCriterion?'Đang vượt mốc sàng lọc.':'Chưa vượt mốc sàng lọc.'):'Nguồn bắt đầu phát tại t = 0.'}`;
  $('light-level').textContent=params.lightOn?`${number(light.instant,2)} µW/m²`:'Tắt';
  $('light-detail').textContent=`${params.lightNm} nm · ${params.lightPulse?number(params.lightPulse,1)+' Hz, duty 50%':'sáng liên tục'} · đỉnh ${number(light.peak,2)} µW/m²`;
  $('light-evidence').textContent=`Mốc giả định: ${number(params.lightThreshold,1)} µW/m². Dòng photon ${params.lightOn?light.photonFlux.toExponential(2):'0'} photon/(m²·s). Chưa gán độ nhạy sinh học theo màu.`;
  $('signal-counts').textContent=`Đã vượt mốc: âm ${sim.heard}/${params.count} · đèn ${sim.lit}/${params.count} · vào vùng robot ${sim.predatorAlerts}/${params.count}.`;
}
function prepare(canvas){
  const r=canvas.getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio||1,2);
  const w=Math.max(1,r.width),h=Math.max(1,r.height);
  if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}
  const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);return {ctx,w,h};
}
function line(c,x1,y1,x2,y2,color,width=1,dash=[]){c.beginPath();c.setLineDash(dash);c.moveTo(x1,y1);c.lineTo(x2,y2);c.strokeStyle=color;c.lineWidth=width;c.stroke();c.setLineDash([]);}
function caption(c,text,x,y,color='#9caeb9',align='left'){c.fillStyle=color;c.font='11px ui-monospace, SFMono-Regular, Consolas, monospace';c.textAlign=align;c.fillText(text,x,y);c.textAlign='left';}
function arrow(c,x,y,angle,size,color){c.save();c.translate(x,y);c.rotate(angle);c.beginPath();c.moveTo(size,0);c.lineTo(-size*.7,-size*.55);c.lineTo(-size*.15,0);c.lineTo(-size*.7,size*.55);c.closePath();c.fillStyle=color;c.fill();c.restore();}
function bounds(w,h){
  const live=sim.birds.filter(b=>b.state!=='contact'),pts=[sim.plane.pos,sim.nominalPoint,sim.predictedCenter,...(live.length?live:sim.birds).map(b=>b.pos)];
  if(params.predator)pts.push(sim.predator.pos);
  let xmin=Math.min(...pts.map(p=>p[0])),xmax=Math.max(...pts.map(p=>p[0]));
  let ymin=Math.min(-40,...pts.map(p=>p[1])),ymax=Math.max(40,...pts.map(p=>p[1]));
  const cx=(xmin+xmax)/2,cy=(ymin+ymax)/2;
  const span=Math.max(450,xmax-xmin+200,(ymax-ymin+130)*(w-70)/(h-100));
  const s=(w-70)/span;return {xmin:cx-span/2,xmax:cx+span/2,cx,cy,s};
}
function drawPlan(){
  const {ctx:c,w,h}=prepare($('plan-canvas')),b=bounds(w,h),s=b.s;
  const X=x=>w/2+(x-b.cx)*s,Y=y=>h/2+15-(y-b.cy)*s;
  const grid=s>.85?50:100;
  const ymin=b.cy-h/(2*s)-30,ymax=b.cy+h/(2*s)+30;
  for(let x=Math.ceil(b.xmin/grid)*grid;x<b.xmax;x+=grid)line(c,X(x),40,X(x),h,'#1e2c36');
  for(let y=Math.ceil(ymin/grid)*grid;y<ymax;y+=grid)line(c,0,Y(y),w,Y(y),'#1e2c36');
  // Geometric projection of the nominal spherical detection threshold onto mean flock altitude.
  const px=X(sim.plane.pos[0]),py=Y(0),dz=sim.center[2]-sim.plane.pos[2];
  if(params.detection>Math.abs(dz)){
    const radius=Math.sqrt(params.detection**2-dz**2)*s;
    c.beginPath();c.arc(px,py,radius,0,Math.PI*2);c.fillStyle='#68d9d004';c.fill();c.setLineDash([5,6]);c.strokeStyle='#68d9d052';c.lineWidth=1;c.stroke();c.setLineDash([]);
  }
  const corridor=Math.max(3,17.9*s);c.fillStyle='#9cb2c008';c.fillRect(0,py-corridor,w,corridor*2);
  line(c,0,py,w,py,'#a1b7c247',1,[7,8]);
  const lastX=Math.min(w-22,px+150);arrow(c,lastX,py,0,4,'#93a5b1');
  // Known encounter point for the frozen-velocity counterfactual, not a live homing target.
  const ix=X(sim.nominalPoint[0]),iy=Y(sim.nominalPoint[1]);
  line(c,ix-7,iy,ix+7,iy,'#a9b4c4',1.5);line(c,ix,iy-7,ix,iy+7,'#a9b4c4',1.5);
  caption(c,'ĐIỂM HẸN CV',clamp(ix+12,10,w-95),clamp(iy+23,60,h-40),'#a9b4c4');
  if(sim.contacts<params.count){
    const cx=X(sim.center[0]),cy=Y(sim.center[1]),fx=X(sim.predictedCenter[0]),fy=Y(sim.predictedCenter[1]);
    c.beginPath();c.arc(fx,fy,sim.predictionRadius*s,0,Math.PI*2);c.fillStyle='#f2bc6609';c.fill();c.strokeStyle='#f2bc6660';c.setLineDash([3,5]);c.lineWidth=1;c.stroke();c.setLineDash([]);
    line(c,cx,cy,fx,fy,'#f2bc66',1.5,[4,3]);c.beginPath();c.arc(fx,fy,4,0,Math.PI*2);c.strokeStyle='#f2bc66';c.stroke();
    caption(c,`CV +${number(params.horizon,1)} s`,clamp(fx+10,10,w-100),clamp(fy-10,65,h-50),'#f2bc66');
  }
  for(const bird of sim.birds){
    if(bird.trail.length>1){c.beginPath();bird.trail.forEach((p,i)=>i?c.lineTo(X(p[0]),Y(p[1])):c.moveTo(X(p[0]),Y(p[1])));c.strokeStyle=colors[bird.state]+'35';c.lineWidth=1;c.stroke();}
  }
  // Blocks shown to scale; these are the same geometry used in contact checks.
  c.fillStyle='#e9eff2';c.strokeStyle='#d8e6ed';c.lineWidth=.5;
  for(const box of BOXES){const x=X(sim.plane.pos[0]+box.min[0]),y=Y(box.max[1]);const bw=(box.max[0]-box.min[0])*s,bh=(box.max[1]-box.min[1])*s;c.fillRect(x,y,Math.max(.8,bw),Math.max(.8,bh));}
  if(params.lightOn){c.beginPath();c.arc(px+18.785*s,py,3,0,Math.PI*2);c.fillStyle=sim.light.on?({380:'#b993ff',470:'#78afff',525:'#7bea9c',630:'#ff8a87'}[params.lightNm]||'#ffffff'):'#4b5963';c.fill();}
  if(params.predator){
    c.beginPath();sim.predator.trail.forEach((p,i)=>i?c.lineTo(X(p[0]),Y(p[1])):c.moveTo(X(p[0]),Y(p[1])));c.strokeStyle='#c3a3f975';c.lineWidth=1;c.stroke();
    const rx=X(sim.predator.pos[0]),ry=Y(sim.predator.pos[1]);arrow(c,rx,ry,Math.atan2(-sim.predator.vel[1],sim.predator.vel[0]),7,'#c3a3f9');caption(c,'CHIM CẮT ROBOT',clamp(rx+10,10,w-130),clamp(ry+22,70,h-40),'#c3a3f9');
  }
  for(const bird of sim.birds){const x=X(bird.pos[0]),y=Y(bird.pos[1]);if(bird.state==='contact'){line(c,x-4,y-4,x+4,y+4,colors.contact,1.5);line(c,x-4,y+4,x+4,y-4,colors.contact,1.5);}else arrow(c,x,y,Math.atan2(-bird.vel[1],bird.vel[0]),3.7,colors[bird.state]);}
  caption(c,'MÁY BAY',clamp(px,50,w-100),py+35,'#dee6e9');
  if(!sim.done&&sim.contacts<params.count){const cx=X(sim.center[0]),cy=Y(sim.center[1]);caption(c,`${params.count-sim.contacts} BỒ CÂU`,clamp(cx+22,20,w-100),clamp(cy-27,75,h-30),'#9de0d7');}
  const barLength=100*s;line(c,w-22-barLength,h-23,w-22,h-23,'#a2b3bd',1);line(c,w-22-barLength,h-27,w-22-barLength,h-19,'#a2b3bd');line(c,w-22,h-27,w-22,h-19,'#a2b3bd');caption(c,'100 m',w-22-barLength/2,h-32,'#9caeb9','center');
  $('scale-label').textContent=`Lưới ${grid} m · tự căn khung`;
  $('view-note').textContent=params.detection===0?'Phát hiện máy bay đã tắt':Math.abs(dz)>params.detection?'Chênh cao lớn hơn ngưỡng phát hiện':`Phát hiện ${params.detection} m · chiếu tại độ cao tâm đàn`;
}
function drawSide(){
  const {ctx:c,w,h}=prepare($('side-canvas')),b=bounds(w,$('plan-canvas').getBoundingClientRect().height),X=x=>w/2+(x-b.cx)*b.s;
  const zmax=Math.max(700,Math.ceil(Math.max(sim.plane.pos[2]/FT+100,sim.initialPlane[2]/FT+100,sim.center[2]/FT+100,sim.predictedCenter[2]/FT+100)/100)*100),Z=z=>h-23-z/zmax*(h-65);
  c.fillStyle='#def48a0a';c.fillRect(48,Z(500),w-60,Z(0)-Z(500));
  line(c,48,Z(500),w-12,Z(500),'#def48a4a',1,[4,5]);
  line(c,48,Z(0),w-12,Z(0),'#586957');
  caption(c,'500',11,Z(500)+4,'#b6ca88');caption(c,'0',24,Z(0)+4);
  if(zmax>850)caption(c,`${zmax}`,8,Z(zmax)+4);
  caption(c,'SOL / MẶT ĐẤT',60,h-7,'#728578');
  const pathTime=sim.plane.vel[2]<0?Math.min(sim.duration,(3-sim.initialPlane[2])/sim.plane.vel[2]):sim.duration;
  const pathEnd=[sim.initialPlane[0]+sim.plane.vel[0]*pathTime,sim.initialPlane[2]+sim.plane.vel[2]*pathTime];
  line(c,X(sim.initialPlane[0]),Z(sim.initialPlane[2]/FT),X(pathEnd[0]),Z(pathEnd[1]/FT),'#99aaba55',1,[6,6]);
  const ix=X(sim.nominalPoint[0]),iz=Z(sim.nominalPoint[2]/FT);line(c,ix-5,iz,ix+5,iz,'#a9b4c4');line(c,ix,iz-5,ix,iz+5,'#a9b4c4');
  if(sim.contacts<params.count)line(c,X(sim.center[0]),Z(sim.center[2]/FT),X(sim.predictedCenter[0]),Z(sim.predictedCenter[2]/FT),'#f2bc66',1.5,[4,3]);
  if(params.predator){c.fillStyle='#c3a3f9';c.beginPath();c.arc(X(sim.predator.pos[0]),Z(sim.predator.pos[2]/FT),4,0,Math.PI*2);c.fill();}
  for(const bird of sim.birds){
    if(bird.trail.length>1){c.beginPath();bird.trail.forEach((p,i)=>i?c.lineTo(X(p[0]),Z(p[2]/FT)):c.moveTo(X(p[0]),Z(p[2]/FT)));c.strokeStyle=colors[bird.state]+'33';c.lineWidth=.8;c.stroke();}
    const x=X(bird.pos[0]),y=Z(bird.pos[2]/FT);c.fillStyle=colors[bird.state];c.beginPath();c.arc(x,y,2.4,0,Math.PI*2);c.fill();
  }
  const px=X(sim.plane.pos[0]),pz=Z(sim.plane.pos[2]/FT);line(c,px-18.785*b.s,pz,px+18.785*b.s,pz,'#e7f0f4',3);arrow(c,px+18.785*b.s,pz,0,3,'#e7f0f4');
  caption(c,`${number(sim.plane.pos[2]/FT)} ft`,clamp(px+10,55,w-75),Math.max(48,pz-13),'#ecf1f3');
}
function draw(){drawPlan();drawSide();}
new ResizeObserver(draw).observe($('top-wrap'));
function frame(timestamp){
  if(lastFrame&&playing){const elapsed=Math.min((timestamp-lastFrame)/1000,.1);sim.advance(elapsed*Number($('playback-speed').value));uiElapsed+=elapsed;if(sim.done)playing=false;if(uiElapsed>.09||sim.done){update();uiElapsed=0;}draw();}
  lastFrame=timestamp;requestAnimationFrame(frame);
}
function csvValue(x){if(x===null||x===undefined||x===Infinity)return '';return '"'+String(x).replaceAll('"','""')+'"';}
function exportCSV(){
  const headers=['model_version','valid_plan','run_finished','elapsed_s','bird_id','state','direct_detection_time_s','direct_detection_distance_m','warned_by_neighbor','alert_time_s','reaction_time_s','reaction_aircraft_distance_m','minimum_clearance_m','contact_time_s','contact_part','first_trigger','sound_time_s','sound_at_detection_dBSPL','sound_at_detection_Hz','light_time_s','predator_time_s','escape_target_x','escape_target_y','escape_target_z','final_x_m','final_y_m','final_z_m','velocity_x_ms','velocity_y_ms','velocity_z_ms','nominal_intersection_time_s','nominal_miss_m','effective_initial_aircraft_alt_ft','cv_rmse_m','cv_samples',...Object.keys(params).map(k=>'input_'+k)];
  const rows=sim.birds.map(b=>['2.0',sim.validPlan,sim.done,sim.t,b.id,b.state,b.directAt,b.detectDistance,b.socialAlert,b.alertAt,b.reactTime,b.reactDistance,b.minClearance,b.contactTime,b.contactPart,b.trigger,b.soundAt,b.receivedSPL,b.receivedHz,b.lightAt,b.predatorAt,...(b.escapeVector||[null,null,null]),...b.pos,...b.vel,sim.nominalTime,sim.nominalMiss,sim.initialPlane[2]/FT,sim.predictionRMSE,sim.predictionN,...Object.values(params)]);
  const csv='\uFEFF'+[headers,...rows].map(row=>row.map(csvValue).join(',')).join('\r\n');
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`pigeon-lab-seed-${params.seed}-${sim.done?'complete':'partial'}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  toast(sim.done?'Đã xuất CSV của lượt hoàn tất.':'Đã xuất CSV một phần; lượt mô phỏng chưa kết thúc.');
}
$('export').addEventListener('click',exportCSV);
$('export-json').addEventListener('click',()=>{
  const data={...sim.summary(),units:'SI except input aircraftAlt/birdAlt (ft), speed (kt), lightIntensity (mW/sr), wavelength (nm)',seriesIntervalSeconds:.2,series:sim.series};
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`pigeon-lab-seed-${params.seed}-trace.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Đã xuất tham số, sự kiện và chuyển động tâm đàn · JSON.');
});
syncControls();update();draw();requestAnimationFrame(frame);
// Optional browser-native structured interface; same state as visible controls.
if(document.modelContext?.registerTool){
  const lifecycle=new AbortController();
  const defs=[{
    name:'read_pigeon_simulation',title:'Đọc kết quả mô phỏng bồ câu',description:'Read the current exploratory simulation parameters and results. This is not a real-world risk estimate.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute:()=>sim.summary()
  },{
    name:'configure_pigeon_simulation',title:'Chọn kịch bản bồ câu',description:'Reset the visible simulation to a preset and optionally finish that one model run.',inputSchema:{type:'object',properties:{preset:{type:'string',enum:Object.keys(PRESETS)},finish:{type:'boolean'}},required:['preset'],additionalProperties:false},annotations:{readOnlyHint:false},execute:async input=>{
      if(!input||!Object.hasOwn(PRESETS,input.preset)||Object.keys(input).some(k=>!['preset','finish'].includes(k))||('finish' in input&&typeof input.finish!=='boolean'))throw new TypeError('Kịch bản không hợp lệ');
      setParams(PRESETS[input.preset],input.preset);if(input.finish)return await finishRun();return sim.summary();
    }
  }];
  for(const def of defs)try{Promise.resolve(document.modelContext.registerTool(def,{signal:lifecycle.signal})).catch(()=>{});}catch{}
  window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
}
