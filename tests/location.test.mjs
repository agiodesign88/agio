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
