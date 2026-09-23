import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation,DEFAULTS,PRESETS,segmentBox,closestApproach,FT,KT,DT} from '../dist/model.mjs';

test('Units and true relative closest approach',()=>{
 assert.equal(500*FT,152.4);assert.ok(Math.abs(140*KT-72.0222222222)<1e-6);
 assert.deepEqual(closestApproach([100,30,0],[-10,0,0]),{time:10,distance:30,approaching:true});
 assert.equal(closestApproach([100,0,0],[10,0,0]).approaching,false);
});
test('Swept contact cannot tunnel through a narrow box',()=>{
 const hit=segmentBox([-100,0,0],[100,0,0],[-1,-1,-1],[1,1,1]);
 assert.equal(hit.distance,0);assert.ok(Math.abs(hit.t-.495)<1e-9);
 const miss=segmentBox([-100,3,0],[100,3,0],[-1,-1,-1],[1,1,1]);assert.equal(miss.distance,2);
 const vertical=segmentBox([0,0,-10],[0,0,10],[-1,-1,-1],[1,1,1]);assert.equal(vertical.distance,0);
});
test('Frozen seed is repeatable and render timing does not change physics',()=>{
 const a=new Simulation({count:12}),b=new Simulation({count:12});
 for(let i=0;i<120;i++)a.advance(.025);
 for(let i=0;i<30;i++)b.advance(.1);
 assert.equal(a.stepCount,180);assert.equal(b.stepCount,180);assert.deepEqual(a.birds,b.birds);
 const c=new Simulation({count:12,seed:99});c.advance(3);assert.notDeepEqual(c.birds,a.birds);
});
test('Controlled encounters: disabled detection, early escape and vertical separation',()=>{
 const none=new Simulation({detection:0});const n=none.finish();assert.equal(n.detected,0);assert.equal(n.reacted,0);assert.ok(n.contacts>0);
 const early=new Simulation({detection:600});const e=early.finish();assert.ok(e.contacts<n.contacts);assert.equal(e.contacts,0);
 const separate=new Simulation(PRESETS.separated);const s=separate.finish();assert.equal(s.contacts,0);assert.ok(s.minClearance>100);
});
test('Delay and individual thresholds are honored; contact may precede escape',()=>{
 const m=new Simulation({...DEFAULTS,social:false});m.finish();
 for(const b of m.birds){if(b.directAt!==null)assert.ok(b.detectDistance<=b.detection+1e-8);if(b.reactTime!==null){assert.ok(b.reactTime-b.directAt>=b.delay-1e-8);assert.ok(b.reactTime-b.directAt<b.delay+DT+1e-8);}}
 const late=new Simulation(PRESETS.late).finish();assert.ok(late.contacts>0);assert.equal(late.reacted,0);
});
test('Height, ground termination and speed bounds',()=>{
 const m=new Simulation({centerLock:false,phase:'custom',aircraftAlt:30,verticalRate:-6,escape:'dive',birdAlt:20});m.finish();
 assert.ok(m.plane.pos[2]>=3);assert.ok(m.endReason.includes('mặt đất'));
 for(const b of m.birds){assert.ok(b.pos[2]>=2);assert.ok(b.pos.every(Number.isFinite));assert.ok(Math.hypot(...b.vel)<=28+1e-8);}
 assert.throws(()=>new Simulation({speed:NaN}));assert.throws(()=>new Simulation({heading:'invalid'}));
 const slow=new Simulation({heading:'following',speed:60,birdSpeed:26,distance:1800});assert.ok(slow.duration>slow.nominalTime);
});

test('Forced centroid encounter is exact for climbing, descending and crossing trajectories',()=>{
 for(const phase of ['takeoff','landing'])for(const heading of ['headon','crossing','following']){
  const m=new Simulation({phase,heading,count:12});assert.equal(m.validPlan,true);assert.ok(m.nominalMiss<1e-8);
  const reference=m.referenceCenter(m.nominalTime);
  for(let i=0;i<3;i++)assert.ok(Math.abs(reference[i]-(m.initialPlane[i]+m.plane.vel[i]*m.nominalTime))<1e-8);
  assert.equal(Math.sign(m.plane.vel[2]),phase==='takeoff'?1:-1);
  assert.ok(Math.abs(m.plane.vel[2]/m.plane.vel[0]-(phase==='takeoff'?1:-1)*Math.tan(3*Math.PI/180))<1e-12);
  const z=m.plane.pos[2];m.advance(1);assert.ok(Math.abs(m.plane.pos[2]-z-m.plane.vel[2])<1e-8);
 }
 const invalid=new Simulation({phase:'takeoff',birdAlt:20,flightAngle:6});assert.equal(invalid.validPlan,false);assert.equal(invalid.done,true);invalid.step();assert.equal(invalid.t,0);
});
test('Keeping individual velocities is a controlled counterfactual, not a guarantee every bird contacts',()=>{
 const m=new Simulation({...PRESETS.centerControl,count:36});m.finish();
 assert.equal(m.reacted,0);assert.ok(m.contacts>0);assert.ok(m.contacts<m.p.count);
 for(const b of m.birds)assert.deepEqual(b.vel,m.initialMeanVelocity);
 assert.ok(m.predictionRMSE<1e-8);
});
test('Sensory measurement alone cannot change trajectories or cause escape',()=>{
 const p={count:12,detection:0,social:false};
 const a=new Simulation(p),b=new Simulation({...p,soundOn:true,lightOn:true,lightIntensity:1000,signalResponse:false});a.finish();b.finish();
 assert.ok(b.heard>0);assert.ok(b.lit>0);assert.equal(b.reacted,0);
 assert.deepEqual(a.birds.map(x=>[x.pos,x.vel,x.state]),b.birds.map(x=>[x.pos,x.vel,x.state]));
 assert.equal(a.contacts,b.contacts);
});
test('Signal hypothesis and robot have separate first triggers; weak signals give no guaranteed avoidance',()=>{
 const sound=new Simulation({count:12,detection:0,social:false,soundOn:true,signalResponse:true});sound.finish();
 assert.ok(sound.reacted>0);assert.ok(sound.events.some(e=>e.kind==='alert'&&e.source==='sound'));
 const light=new Simulation({count:12,detection:0,social:false,lightOn:true,lightIntensity:1000,lightPulse:0,signalResponse:true});light.finish();
 assert.ok(light.events.some(e=>e.kind==='alert'&&e.source==='light'));
 const weak=new Simulation({count:12,detection:0,social:false,soundOn:true,soundLevel:60,noiseLevel:90,signalResponse:true});weak.finish();assert.equal(weak.reacted,0);assert.ok(weak.contacts>0);
 const predator=new Simulation({...PRESETS.falcon,count:12});predator.advance(2);assert.ok(predator.reacted>0);assert.equal(predator.events.find(e=>e.kind==='alert').source,'predator');
});
test('CV forecast error is measured prospectively and changes after turning',()=>{
 const m=new Simulation({count:12,centerLock:false,phase:'level',aircraftAlt:700,ballistic:true});m.advance(1);assert.equal(m.predictionRMSE,null);m.advance(2);assert.ok(m.predictionN>0);assert.ok(m.predictionRMSE<1e-8);
 const turn=new Simulation({...PRESETS.falcon,count:12});turn.advance(5);assert.ok(turn.predictionRMSE>1);
 const bound=new Simulation({count:12,detection:800,accel:12,horizon:2});const start=bound.birds.map(b=>b.pos.map((x,i)=>x+b.vel[i]*2));bound.advance(2);
 for(let i=0;i<start.length;i++)assert.ok(Math.hypot(...bound.birds[i].pos.map((x,j)=>x-start[i][j]))<=.5*12*2**2+1e-8);
});
