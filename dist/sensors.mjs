// All levels are virtual. SPL is unweighted, in the signal band, not dBA.
export const SOUND_SPEED=343; // m/s, assumed still air near 20 C.
const sDot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
const sNorm=a=>Math.hypot(...a);
export function hearingReference(frequency){
  // Heffner et al. 2013: ~14 dB best sensitivity at 1–4 kHz;
  // mean audiogram bounded by 54–6400 Hz at 60 dB SPL.
  // We do NOT invent an interpolated full audiogram.
  if(frequency>=1000&&frequency<=4000)return {threshold:14,kind:'best-band',note:'Mốc xấp xỉ 14 dB SPL · 1–4 kHz'};
  if(frequency>=54&&frequency<=6400)return {threshold:60,kind:'conservative',note:'Mốc sàng lọc bảo thủ 60 dB SPL · không phải ngưỡng nghe thực tại mọi tần số'};
  return {threshold:null,kind:'unknown',note:'Ngoài miền tham chiếu đã dùng; không suy ra không nghe được'};
}
export function receivedSound(sourcePos,sourceVel,receiverPos,receiverVel,time,p){
  const r=receiverPos.map((x,i)=>x-sourcePos[i]);
  const c=SOUND_SPEED,A=c*c-sDot(sourceVel,sourceVel),B=sDot(r,sourceVel);
  const delay=(B+Math.sqrt(B*B+A*sDot(r,r)))/A;
  const path=r.map((x,i)=>x+sourceVel[i]*delay),range=Math.max(1,sNorm(path));
  const n=path.map(x=>x/(sNorm(path)||1));
  const frequency=p.soundHz*(c-sDot(receiverVel,n))/(c-sDot(sourceVel,n));
  const spl=p.soundLevel-20*Math.log10(range);
  const reference=hearingReference(frequency),criterion=reference.threshold===null?null:Math.max(reference.threshold,p.noiseLevel+p.snrMargin);
  const arrived=time+1e-9>=delay;
  return {delay,range,frequency,spl,reference,criterion,arrived,aboveCriterion:!!p.soundOn&&arrived&&criterion!==null&&spl>=criterion};
}
export function receivedLight(sourcePos,receiverPos,time,p){
  const range=Math.max(1,sNorm(receiverPos.map((x,i)=>x-sourcePos[i])));
  const on=p.lightPulse===0||(time*p.lightPulse)%1<.5;
  // Radiant intensity (mW/sr) / r² = irradiance (mW/m²), converted to µW/m².
  const peak=p.lightIntensity*1000/(range*range),instant=on?peak:0;
  const average=peak*(p.lightPulse===0?1:.5);
  const photonFlux=instant*1e-6*(p.lightNm*1e-9)/(6.62607015e-34*299792458);
  return {range,peak,instant,average,on,photonFlux,aboveCriterion:!!p.lightOn&&instant>=p.lightThreshold};
}
