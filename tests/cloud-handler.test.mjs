import test from 'node:test';
import assert from 'node:assert/strict';
import {createCloudHandler} from '../lib/cloud-handler.mjs';
async function request(handler,url,method='GET',body,origin='https://agio-test.vercel.app'){
 let status,data;await handler({url,method,body,headers:{host:'agio-test.vercel.app',origin}},{writeHead(s){status=s;},end(s){data=JSON.parse(s);}});return {status,data};
}
test('cloud config never returns REST keys and catalog is readable across instances',async()=>{
 const make=()=>createCloudHandler({env:{KAKAO_REST_KEY:'test-secret'},load:async()=>[{id:'a',status:'draft'},{id:'b',status:'closed'}]});
 const config=await request(make(),'/api/index?endpoint=config');assert.equal(config.status,200);assert.equal(config.data.readOnly,true);assert.ok(!JSON.stringify(config).includes('test-secret'));
 assert.deepEqual((await request(make(),'/api/places')).data,[{id:'a',status:'draft'}]);
});
test('cloud rejects catalog mutations and cross-origin API requests',async()=>{
 const handler=createCloudHandler({env:{}});
 for(const [url,method] of [['/api/places','POST'],['/api/places/a','PUT'],['/api/upload','POST']])assert.equal((await request(handler,url,method,{})).status,403);
 assert.equal((await request(handler,'/api/routes','POST',{},'https://other.example')).status,403);
});
test('transit requests are forwarded with server key, with input and missing-key validation',async()=>{
 let seen;const handler=createCloudHandler({env:{KAKAO_REST_KEY:'test-key'},fetchImpl:async(url,options)=>{seen={url:String(url),options};return {ok:true,json:async()=>({routes:[{steps:[]}]})};}});
 const body={mode:'transit',startLat:37,startLng:127,endLat:37.1,endLng:127.1};
 assert.equal((await request(handler,'/api/index?endpoint=routes','POST',body)).status,200);
 assert.ok(seen.url.includes('/routing/publictraffic'));assert.equal(seen.options.headers.Authorization,'KakaoAK test-key');
 assert.equal((await request(handler,'/api/routes','POST',{...body,startLat:100})).status,400);
 assert.equal((await request(createCloudHandler({env:{}}),'/api/routes','POST',body)).status,503);
});
test('place names use keyword search when address lookup is empty',async()=>{
 const urls=[];const handler=createCloudHandler({env:{KAKAO_REST_KEY:'test'},fetchImpl:async url=>{urls.push(url);return {ok:true,json:async()=>({documents:url.includes('keyword.json')?[{place_name:'서울역',road_address_name:'서울 용산구 한강대로 405',x:'126.97',y:'37.55'}]:[]})};}});
 const result=await request(handler,'/api/geocode','POST',{address:'서울역'});
 assert.equal(result.status,200);assert.equal(result.data[0].name,'서울역');assert.equal(result.data[0].lat,37.55);assert.equal(urls.length,2);
 assert.ok(urls[1].includes('keyword.json'));
});
test('street address results do not trigger extra keyword requests',async()=>{
 let calls=0;const handler=createCloudHandler({env:{KAKAO_REST_KEY:'test'},fetchImpl:async()=>{calls++;return {ok:true,json:async()=>({documents:[{address_name:'서울 중구 퇴계로87길 53',x:'127',y:'37'}]})};}});
 const result=await request(handler,'/api/geocode','POST',{address:'퇴계로87길 53'});
 assert.equal(result.data[0].address,'서울 중구 퇴계로87길 53');assert.equal(calls,1);
});
