import test from 'node:test';
import assert from 'node:assert/strict';
import {currentPosition} from '../public/location.mjs';
test('location uses high accuracy and returns the supplied device position',async()=>{
  let options;
  const result=await currentPosition({getCurrentPosition(ok,fail,o){options=o;ok({coords:{latitude:37,longitude:127,accuracy:25}});}});
  assert.deepEqual(result,{latitude:37,longitude:127,accuracy:25});
  assert.equal(options.enableHighAccuracy,true);assert.equal(options.timeout,15000);
});
test('permission denial and timeout give actionable messages, with no invented location',async()=>{
  for(const [code,pattern] of [[1,/위치 권한/],[2,/위치 서비스/],[3,/시간이 초과/]])
    await assert.rejects(currentPosition({getCurrentPosition(ok,fail){fail({code});}}),pattern);
  await assert.rejects(currentPosition(undefined),/브라우저/);
});
import {stablePosition,createAddressCache} from '../public/location.mjs';
test('stationary fixes reuse the anchor; movement and improved accuracy refresh it',()=>{
 const first=stablePosition(null,{latitude:37,longitude:127,accuracy:20},0);
 assert.equal(stablePosition(first,{latitude:37.0001,longitude:127,accuracy:20},100).latitude,37);
 assert.equal(stablePosition(first,{latitude:37.001,longitude:127,accuracy:20},200).latitude,37.001);
 assert.equal(stablePosition({...first,accuracy:1000},{latitude:37.0001,longitude:127,accuracy:10},300).latitude,37.0001);
});
test('address cache shares in-flight and completed lookups but retries failures and movement',async()=>{
 let calls=0;const cache=createAddressCache(async p=>{calls++;return {address:p.latitude===0?'':'주소'};});
 const p={latitude:37,longitude:127};await Promise.all([cache(p),cache(p)]);await cache(p);assert.equal(calls,1);
 await cache({...p,latitude:38});assert.equal(calls,2);
 await assert.rejects(cache({...p,latitude:0}));await assert.rejects(cache({...p,latitude:0}));assert.equal(calls,4);
});
