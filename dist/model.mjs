// Exploratory agent model. SI internally; no empirical aircraft detection calibration.
import {receivedSound,receivedLight} from './sensors.mjs';
export const FT = 0.3048, KT = 1852/3600, DT = 1/60;
export const DEFAULTS = Object.freeze({count:36,speed:140,aircraftAlt:300,birdAlt:300,detection:220,latency:0.6,birdSpeed:16,accel:12,offset:0,distance:900,heading:'headon',escape:'heading',verticalRate:0,social:true,seed:42,phase:'landing',flightAngle:3,centerLock:true,ballistic:false,predator:false,soundOn:false,soundHz:2000,soundLevel:100,noiseLevel:40,snrMargin:6,lightOn:false,lightNm:470,lightPulse:2,lightIntensity:100,lightThreshold:1,signalResponse:false,horizon:2});
export const PRESETS = {
  landing:{...DEFAULTS},
  takeoff:{...DEFAULTS,phase:'takeoff'},
  centerControl:{...DEFAULTS,ballistic:true,detection:0,social:false},
  signals:{...DEFAULTS,soundOn:true,lightOn:true,signalResponse:true},
  falcon:{...DEFAULTS,predator:true},
  headon:{...DEFAULTS,phase:'level'},
  late:{...DEFAULTS,detection:45,latency:0.9},
  crossing:{...DEFAULTS,heading:'crossing',detection:200},
  separated:{...DEFAULTS,centerLock:false,aircraftAlt:700,birdAlt:300,phase:'level'}
};
// Conservative block geometry; only overall length/span reference Airbus A320.
export const BOXES = [
  {name:'Thân',min:[-18.785,-2.1,-2.1],max:[18.785,2.1,2.1]},
  {name:'Cánh',min:[-5,-17.9,-0.55],max:[2,17.9,0.55]},
  {name:'Đuôi ngang',min:[-16,-6.2,-0.8],max:[-12,6.2,0.8]},
  {name:'Đuôi đứng',min:[-16,-0.5,0],max:[-11,0.5,8]},
  {name:'Động cơ trái',min:[-4,-6.2,-2.5],max:[1,-4,-0.6]},
  {name:'Động cơ phải',min:[-4,4,-2.5],max:[1,6.2,-0.6]}
];
export const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const add=(a,b)=>a.map((x,i)=>x+b[i]);
const sub=(a,b)=>a.map((x,i)=>x-b[i]);
const mul=(a,s)=>a.map(x=>x*s);
const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
const length=a=>Math.hypot(...a);
const unit=a=>mul(a,1/(length(a)||1));
function random(seed){let a=seed>>>0;return()=>{a+=0x6D2B79F5;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
export function sanitize(input={}){
  const p={...DEFAULTS,...input};
  for(const [key,min,max] of [['count',1,100],['speed',60,250],['aircraftAlt',30,3000],['birdAlt',20,1500],['detection',0,800],['latency',0,3],['birdSpeed',8,26],['accel',3,20],['offset',-200,200],['distance',850,1800],['verticalRate',-6,6],['seed',1,999999],['flightAngle',1,6],['soundHz',20,24000],['soundLevel',60,130],['noiseLevel',0,90],['snrMargin',0,20],['lightNm',350,700],['lightPulse',0,10],['lightIntensity',1,1000],['lightThreshold',.1,10],['horizon',.5,5]]){
    if(!Number.isFinite(Number(p[key])))throw new TypeError(`Giá trị không hợp lệ: ${key}`);
    p[key]=clamp(Number(p[key]),min,max);
  }
  p.count=Math.round(p.count);p.seed=Math.round(p.seed);
  if(!['headon','crossing','following'].includes(p.heading))throw new TypeError('Hướng bay không hợp lệ');
  if(!['heading','split','together','dive'].includes(p.escape))throw new TypeError('Cách tránh né không hợp lệ');
  if(!['landing','takeoff','level','custom'].includes(p.phase))throw new TypeError('Pha bay không hợp lệ');
  for(const key of ['social','centerLock','ballistic','predator','soundOn','lightOn','signalResponse'])p[key]=!!p[key];
  return p;
}
export function aircraftVelocity(p){return [p.speed*KT,0,p.phase==='custom'?p.verticalRate:p.phase==='level'?0:(p.phase==='takeoff'?1:-1)*p.speed*KT*Math.tan(p.flightAngle*Math.PI/180)];}
// Exact minimum Euclidean distance from a swept point to an AABB.
export function segmentBox(a,b,min,max){
  const d=sub(b,a), cuts=[0,1];
  for(let i=0;i<3;i++)if(Math.abs(d[i])>1e-12)for(const edge of [min[i],max[i]]){const t=(edge-a[i])/d[i];if(t>0&&t<1)cuts.push(t);}
  cuts.sort((x,y)=>x-y);
  let best=Infinity,bestT=0;
  const at=t=>{let q=0;for(let i=0;i<3;i++){const x=a[i]+d[i]*t;q+=Math.max(min[i]-x,0,x-max[i])**2;}if(q<best){best=q;bestT=t;}};
  for(let j=0;j<cuts.length-1;j++){
    const lo=cuts[j],hi=cuts[j+1],mid=(lo+hi)/2;let aa=0,bb=0;
    for(let i=0;i<3;i++){const x=a[i]+d[i]*mid;const edge=x<min[i]?min[i]:x>max[i]?max[i]:null;if(edge!==null){aa+=d[i]*d[i];bb+=d[i]*(a[i]-edge);}}
    at(lo);at(hi);if(aa>0)at(clamp(-bb/aa,lo,hi));
  }
  return {distance:Math.sqrt(best),t:bestT};
}
export function closestApproach(r,v){const vv=dot(v,v);const t=vv>1e-12?Math.max(0,-dot(r,v)/vv):0;return {time:t,distance:length(add(r,mul(v,t))),approaching:dot(r,v)<0};}
const CONTACT_BOXES=BOXES.map(b=>({...b,min:b.min.map(v=>v-.18),max:b.max.map(v=>v+.18)}));
export class Simulation {
  constructor(params={}){
    this.p=sanitize(params);const p=this.p,rng=random(p.seed);
    this.t=0;this.stepCount=0;this.done=false;this.events=[];this.series=[];this.accumulator=0;
    this.plane={pos:[-p.distance,0,p.aircraftAlt*FT],vel:aircraftVelocity(p)};
    this.heading=p.heading==='headon'?[-1,0,0]:p.heading==='crossing'?[0,-1,0]:[1,0,0];
    this.nominalTime=p.distance/(p.speed*KT-this.heading[0]*p.birdSpeed);
    this.duration=this.nominalTime+8;
    this.birds=Array.from({length:p.count},(_,i)=>{
      const angle=rng()*Math.PI*2,rad=Math.sqrt(rng())*16;
      const pos=[Math.cos(angle)*rad,Math.sin(angle)*rad+p.offset+(p.heading==='crossing'?p.birdSpeed*this.nominalTime:0),p.birdAlt*FT+(rng()-.5)*4];
      const speed=p.birdSpeed+(rng()-.5)*4;
      return {id:i+1,pos,vel:mul(this.heading,p.birdSpeed),speed,detection:p.detection*(.85+rng()*.3),delay:p.latency*(.85+rng()*.3),state:'cruise',alertAt:null,reactAt:Infinity,directAt:null,detectDistance:null,reactDistance:null,reactTime:null,contactTime:null,contactPart:null,socialAlert:false,side:rng()>.5?1:-1,minClearance:Infinity,trail:[pos.slice()],soundAt:null,lightAt:null,predatorAt:null,trigger:null,escapeVector:null,receivedSPL:null,receivedHz:null};
    });
    // Centre random positions exactly, and set a known mean initial velocity.
    const rawCenter=mul(this.birds.reduce((a,b)=>add(a,b.pos),[0,0,0]),1/p.count);
    const targetCenter=[0,p.centerLock?-this.heading[1]*p.birdSpeed*this.nominalTime:p.offset-this.heading[1]*p.birdSpeed*this.nominalTime,p.birdAlt*FT];
    for(const bird of this.birds){bird.pos=add(sub(bird.pos,rawCenter),targetCenter);bird.trail=[bird.pos.slice()];}
    this.initialCenter=targetCenter;this.initialMeanVelocity=mul(this.heading,p.birdSpeed);
    if(p.centerLock)this.plane.pos[2]=targetCenter[2]-this.plane.vel[2]*this.nominalTime;
    this.initialPlane=this.plane.pos.slice();
    this.nominalPoint=add(this.initialCenter,mul(this.initialMeanVelocity,this.nominalTime));
    this.nominalMiss=length(sub(this.nominalPoint,add(this.initialPlane,mul(this.plane.vel,this.nominalTime))));
    this.validPlan=this.plane.pos[2]>=3&&Math.min(...this.birds.map(b=>b.pos[2]))>=2;
    this.planNote=this.validPlan?'': 'Cấu hình không khả thi trên mặt đất: tăng độ cao đàn, giảm góc lấy độ cao hoặc bỏ khóa tâm.';
    if(!this.validPlan){this.done=true;this.endReason=this.planNote;}
    this.predator={pos:add(targetCenter,add(mul(this.heading,-35),[0,0,5])),vel:mul(this.heading,p.birdSpeed*1.5),trail:[]};
    this.forecasts=[];this.predictionSSE=0;this.predictionN=0;
    this.recordForecast();
    this.measure();
  }
  referenceCenter(time){return add(this.initialCenter,mul(this.initialMeanVelocity,time));}
  recordForecast(){this.forecasts.push({at:this.stepCount+Math.round(this.p.horizon/DT),birds:this.birds.filter(b=>b.state!=='contact').map(b=>({id:b.id,pos:add(b.pos,mul(b.vel,Math.round(this.p.horizon/DT)*DT))}))});}
  evaluateForecasts(){
    while(this.forecasts.length&&this.forecasts[0].at<=this.stepCount){const forecast=this.forecasts.shift();for(const point of forecast.birds){const b=this.birds[point.id-1];if(b.state==='contact')continue;this.predictionSSE+=length(sub(b.pos,point.pos))**2;this.predictionN++;}}
    if(this.stepCount%12===0)this.recordForecast();
  }
  alert(b,source,d){if(b.alertAt!==null||this.p.ballistic)return;b.alertAt=this.t;b.reactAt=this.t+b.delay;b.state='alert';b.trigger=source;this.event(b,'alert',d,{source});}
  threatFor(b){return b.trigger==='predator'?this.predator:this.plane;}
  escapeTarget(b){
    const threat=this.threatFor(b),h=unit([threat.vel[0],threat.vel[1],0]);
    const normal=[-h[1],h[0],0];
    const lateral=mul(normal,b.side);
    if(this.p.escape==='dive')return unit(add(mul(lateral,.3),[0,0,-1]));
    return unit(add(mul(this.heading,.25),this.p.escape==='heading'?lateral:[0,b.side,0]));
  }
  event(b,kind,d,extra={}){this.events.push({time:this.t,bird:b.id,kind,distance:d,...extra});}
  measure(){
    const live=this.birds.filter(b=>b.state!=='contact');
    const birds=live.length?live:this.birds;
    this.center=mul(birds.reduce((a,b)=>add(a,b.pos),[0,0,0]),1/birds.length);
    this.meanVelocity=mul(birds.reduce((a,b)=>add(a,b.vel),[0,0,0]),1/birds.length);
    this.predictedCenter=add(this.center,mul(this.meanVelocity,this.p.horizon));
    this.predictionRadius=.5*this.p.accel*this.p.horizon**2;
    this.centerCPA=live.length?closestApproach(sub(this.center,this.plane.pos),sub(this.meanVelocity,this.plane.vel)):null;
    this.sound=receivedSound(this.plane.pos,this.plane.vel,this.center,this.meanVelocity,this.t,this.p);
    this.light=receivedLight(this.plane.pos,this.center,this.t,this.p);
    this.heard=this.birds.filter(b=>b.soundAt!==null).length;
    this.lit=this.birds.filter(b=>b.lightAt!==null).length;
    this.predatorAlerts=this.birds.filter(b=>b.predatorAt!==null).length;
    this.directions={left:0,right:0,down:0};
    for(const b of this.birds)if(b.escapeVector){if(b.escapeVector[1]>=0)this.directions.left++;else this.directions.right++;if(b.escapeVector[2]<-.25)this.directions.down++;}
    this.predictionRMSE=this.predictionN?Math.sqrt(this.predictionSSE/this.predictionN):null;
    this.centerDistance=length(sub(this.center,this.plane.pos));
    this.nearestDistance=Math.min(...birds.map(b=>length(sub(b.pos,this.plane.pos))));
    const reacted=this.birds.filter(b=>b.reactDistance!==null).map(b=>b.reactDistance).sort((a,b)=>a-b);
    this.reactionMedian=reacted.length?(reacted[(reacted.length-1)>>1]+reacted[reacted.length>>1])/2:null;
    this.detected=this.birds.filter(b=>b.directAt!==null).length;
    this.warned=this.birds.filter(b=>b.alertAt!==null).length;
    this.reacted=reacted.length;
    this.contacts=this.birds.filter(b=>b.state==='contact').length;
    this.near=this.birds.filter(b=>b.minClearance<=10).length;
    this.clearance=Math.min(...this.birds.map(b=>b.minClearance));
    this.cpa=live.map(b=>closestApproach(sub(b.pos,this.plane.pos),sub(b.vel,this.plane.vel))).filter(c=>c.approaching).sort((a,b)=>a.distance-b.distance)[0]||null;
  }
  step(){
    if(this.done)return;
    const dt=DT,p=this.p,prevPlane=this.plane.pos.slice();
    const nextPlane=add(prevPlane,mul(this.plane.vel,dt));
    // Ground ends the encounter instead of making an aircraft bounce or tunnel through it.
    if(nextPlane[2]<3){this.done=true;this.endReason='Máy bay chạm giới hạn mặt đất của mô hình.';return;}
    const live=this.birds.filter(b=>b.state!=='contact');
    if(p.predator&&live.length){
      const target=live.reduce((best,b)=>length(sub(b.pos,this.predator.pos))<length(sub(best.pos,this.predator.pos))?b:best,live[0]);
      this.predator.vel=mul(unit(sub(target.pos,this.predator.pos)),p.birdSpeed*1.5);
      this.predator.pos=add(this.predator.pos,mul(this.predator.vel,dt));
      if(this.stepCount%6===0){this.predator.trail.push(this.predator.pos.slice());if(this.predator.trail.length>100)this.predator.trail.shift();}
    }
    const snapshots=live.map(b=>({b,pos:b.pos.slice(),vel:b.vel.slice(),state:b.state,reactTime:b.reactTime}));
    for(const s of snapshots){
      const b=s.b,r=sub(b.pos,prevPlane),d=length(r),rv=sub(b.vel,this.plane.vel);
      const facing=unit([b.vel[0],b.vel[1],0]);
      const neighbors=snapshots.filter(n=>n.b!==b).map(n=>({...n,d:length(sub(n.pos,b.pos))})).filter(n=>{const q=sub(n.pos,b.pos);return dot(facing,unit([q[0],q[1],0]))>=Math.cos(107.5*Math.PI/180);}).sort((a,c)=>a.d-c.d).slice(0,7);
      const sound=receivedSound(prevPlane,this.plane.vel,b.pos,b.vel,this.t,p),light=receivedLight(prevPlane,b.pos,this.t,p);
      if(sound.aboveCriterion&&b.soundAt===null){b.soundAt=this.t;b.receivedSPL=sound.spl;b.receivedHz=sound.frequency;this.event(b,'sound',d,{spl:sound.spl,frequency:sound.frequency});}
      if(light.aboveCriterion&&b.lightAt===null){b.lightAt=this.t;this.event(b,'light',d,{irradiance:light.instant});}
      if(p.signalResponse&&(sound.aboveCriterion||light.aboveCriterion))this.alert(b,sound.aboveCriterion?'sound':'light',d);
      if(p.predator&&length(sub(b.pos,this.predator.pos))<=50){
        if(b.predatorAt===null){b.predatorAt=this.t;this.event(b,'predator',d,{predatorDistance:length(sub(b.pos,this.predator.pos))});}
        this.alert(b,'predator',d);
      }
      if(b.directAt===null&&p.detection>0&&d<=b.detection&&(dot(r,rv)<0||d<40)){
        b.directAt=this.t;b.detectDistance=d;this.event(b,'detect',d);
        this.alert(b,'aircraft',d);
      }
      if(p.social&&b.alertAt===null&&neighbors.some(n=>n.reactTime!==null&&this.t-n.reactTime>=.15)){
        const neighbor=neighbors.find(n=>n.reactTime!==null&&this.t-n.reactTime>=.15);
        b.socialAlert=true;this.alert(b,neighbor.b.trigger==='predator'?'predator':'social',d);this.event(b,'social',d);
      }
      if(b.state==='alert'&&this.t+1e-9>=b.reactAt){
        b.state='escape';b.reactDistance=d;b.reactTime=this.t;
        const threat=this.threatFor(b),hv=unit([threat.vel[0],threat.vel[1],0]),normal=[-hv[1],hv[0],0],across=p.escape==='split'?b.pos[1]:dot(sub(b.pos,threat.pos),normal);
        b.side=p.escape==='together'?1:Math.abs(across)>.01?Math.sign(across):b.side;
        b.escapeVector=this.escapeTarget(b);this.event(b,'react',d,{source:b.trigger,direction:b.escapeVector});
      }
      let force=[0,0,0];
      if(neighbors.length){
        const meanV=mul(neighbors.reduce((a,n)=>add(a,n.vel),[0,0,0]),1/neighbors.length);
        const meanP=mul(neighbors.reduce((a,n)=>add(a,n.pos),[0,0,0]),1/neighbors.length);
        force=add(mul(sub(meanV,b.vel),.8),mul(sub(meanP,b.pos),.08));
        const n=neighbors[0];if(n&&n.d<1&&n.d>.001)force=add(force,mul(unit(sub(b.pos,n.pos)),(1-n.d)*6));
      }
      const target=b.state==='escape'?this.escapeTarget(b):this.heading;
      const targetSpeed=b.state==='escape'?Math.min(28,b.speed+2):b.speed;
      force=add(force,mul(sub(mul(target,targetSpeed),b.vel),b.state==='escape'?2:.5));
      // Nominal altitude is maintained before escape; turn modes stay near it.
      if(b.state!=='escape'||p.escape!=='dive')force[2]+=(p.birdAlt*FT-b.pos[2])*.6-b.vel[2]*1.2;
      force=mul(force,Math.min(1,p.accel/(length(force)||1)));
      let v=p.ballistic?b.vel.slice():add(b.vel,mul(force,dt));
      v[2]=clamp(v[2],-5,5);
      const n=length(v);if(n>28)v=mul(v,28/n);
      let pos=add(b.pos,mul(add(b.vel,v),dt/2));if(pos[2]<2){pos[2]=2;v[2]=Math.max(0,v[2]);}
      const a=sub(b.pos,prevPlane),c=sub(pos,nextPlane),cv=sub(c,a);
      const tc=clamp(-dot(a,cv)/(dot(cv,cv)||1),0,1);
      const lower=length(add(a,mul(cv,tc)))-28;
      let hit=null;
      if(lower<=Math.max(b.minClearance,10))for(const box of CONTACT_BOXES){
        const result=segmentBox(a,c,box.min,box.max);
        b.minClearance=Math.min(b.minClearance,result.distance);
        if(result.distance<1e-9&&(!hit||result.t<hit.t))hit={...result,part:box.name};
      }
      if(hit){
        b.state='contact';b.contactTime=this.t+hit.t*dt;b.contactPart=hit.part;
        pos=add(b.pos,mul(sub(pos,b.pos),hit.t));
        this.events.push({time:b.contactTime,bird:b.id,kind:'contact',distance:length(sub(pos,add(prevPlane,mul(this.plane.vel,hit.t*dt)))),part:hit.part});
      }
      b.pos=pos;b.vel=v;
      if(this.stepCount%6===0){b.trail.push(pos.slice());if(b.trail.length>100)b.trail.shift();}
    }
    this.plane.pos=nextPlane;this.stepCount++;this.t=this.stepCount*DT;
    this.evaluateForecasts();this.measure();
    if(this.stepCount%12===0)this.series.push({t:this.t,plane:this.plane.pos.slice(),center:this.center.slice(),meanVelocity:this.meanVelocity.slice(),predictedCenter:this.predictedCenter.slice(),predictionRMSE:this.predictionRMSE,centerCPA:this.centerCPA,clearance:Number.isFinite(this.clearance)?this.clearance:null,centerDistance:this.centerDistance,detected:this.detected,reacted:this.reacted,heard:this.heard,lit:this.lit,contacts:this.contacts,soundSPL:this.p.soundOn&&this.sound.arrived?this.sound.spl:null,soundHz:this.sound.frequency,irradiance:this.p.lightOn?this.light.instant:null});
    if(this.t>=this.duration){this.done=true;this.endReason='Đã kết thúc lượt mô phỏng.';}
  }
  advance(seconds){this.accumulator+=Math.max(0,seconds);while(this.accumulator+1e-9>=DT&&!this.done){this.step();this.accumulator-=DT;}}
  finish(){while(!this.done)this.step();return this.summary();}
  summary(){return {modelVersion:'2.0',parameters:{...this.p},validPlan:this.validPlan,time:this.t,finished:this.done,total:this.p.count,detected:this.detected,heard:this.heard,lit:this.lit,predatorAlerts:this.predatorAlerts,warned:this.warned,reacted:this.reacted,contacts:this.contacts,within10m:this.near,minClearance:Number.isFinite(this.clearance)?this.clearance:null,reactionMedian:this.reactionMedian,nominalTime:this.nominalTime,nominalMiss:this.validPlan?this.nominalMiss:null,initialAircraftAltitudeFt:this.initialPlane[2]/FT,predictionRMSE:this.predictionRMSE,predictionSamples:this.predictionN,firstDetection:this.events.find(e=>e.kind==='detect')||null,events:this.events};}
}
