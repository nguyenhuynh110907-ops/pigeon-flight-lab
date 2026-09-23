import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULTS} from '../dist/model.mjs';
import {receivedSound,receivedLight,hearingReference,SOUND_SPEED} from '../dist/sensors.mjs';
const zero=[0,0,0];

test('Free-field sound: inverse distance pressure, causal arrival, and Doppler',()=>{
 const p={...DEFAULTS,soundOn:true};
 const a=receivedSound(zero,zero,[100,0,0],zero,1,p),b=receivedSound(zero,zero,[200,0,0],zero,1,p);
 assert.ok(Math.abs(a.spl-60)<1e-10);assert.ok(Math.abs(a.spl-b.spl-6.020599913)<1e-8);assert.ok(Math.abs(a.delay-100/SOUND_SPEED)<1e-12);assert.equal(a.frequency,2000);
 assert.equal(receivedSound(zero,zero,[100,0,0],zero,0,p).aboveCriterion,false);
 const moving=receivedSound(zero,[72,0,0],[100,0,0],[-16,0,0],2,p);
 assert.ok(Math.abs(moving.frequency-2000*(343+16)/(343-72))<1e-8);assert.ok(moving.range>100);
 assert.ok(Math.abs(moving.range-343*moving.delay)<1e-8);
});
test('Hearing anchors preserve unknown regions and noise is an explicit hypothesis',()=>{
 assert.equal(hearingReference(2000).threshold,14);assert.equal(hearingReference(100).threshold,60);
 assert.equal(hearingReference(20000).threshold,null);assert.equal(hearingReference(20).threshold,null);
 const ultrasonic=receivedSound(zero,zero,[1,0,0],zero,1,{...DEFAULTS,soundOn:true,soundHz:20000,soundLevel:130});assert.equal(ultrasonic.criterion,null);assert.equal(ultrasonic.aboveCriterion,false);
 const masked=receivedSound(zero,zero,[100,0,0],zero,1,{...DEFAULTS,soundOn:true,noiseLevel:70,snrMargin:6});assert.equal(masked.criterion,76);assert.equal(masked.aboveCriterion,false);
});
test('Radiant inverse square, pulse duty, photons; no invented wavelength fear effect',()=>{
 const p={...DEFAULTS,lightOn:true,lightPulse:0,lightIntensity:100};
 const a=receivedLight(zero,[100,0,0],0,p),b=receivedLight(zero,[200,0,0],0,p);
 assert.equal(a.peak,10);assert.equal(b.peak,2.5);assert.equal(a.average,10);
 const expected=10e-6*470e-9/(6.62607015e-34*299792458);assert.ok(Math.abs(a.photonFlux/expected-1)<1e-12);
 const blue=receivedLight(zero,[100,0,0],0,{...p,lightNm:470}),red=receivedLight(zero,[100,0,0],0,{...p,lightNm:630});assert.equal(blue.aboveCriterion,red.aboveCriterion);assert.equal(blue.instant,red.instant);
 const pulse=receivedLight(zero,[100,0,0],.3,{...p,lightPulse:2});assert.equal(pulse.on,false);assert.equal(pulse.instant,0);assert.equal(pulse.average,5);
});
