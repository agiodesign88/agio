import test from 'node:test';
import assert from 'node:assert/strict';
import {routesFromResponse} from '../public/routes.mjs';
test('walking single route and legs retain summary and path steps',()=>{
  const step={path:{points:[[127,37],[127.01,37.01]]}};
  const [route]=routesFromResponse({route:{properties:{totalTime:120},legs:[{steps:[step]}]}});
  assert.equal(route.properties.totalTime,120);assert.deepEqual(route.steps,[step]);
});
test('transit routes stay separate and failed driving routes are excluded',()=>{
  assert.equal(routesFromResponse({routes:[{steps:[]},{steps:[]}]}).length,2);
  assert.equal(routesFromResponse({routes:[{result_code:104},{result_code:0}]}).length,1);
});
import {routeLegs,routeOverview} from '../public/routes.mjs';
test('transit details retain alternative buses, stop order and walking transfers',()=>{
 const route={steps:[{properties:{type:'BUS',vehicles:[{name:'143'},{name:'401'}],stops:[{name:'승차역'},{name:'중간역'},{name:'하차역'}],time:505,distance:2752}},{properties:{type:'WALKING',guidance:'6번 출구로 이동',time:442}},{properties:{type:'SUBWAY',vehicles:[{name:'2호선'}],stops:[{name:'을지로입구'},{name:'신당'}]}}]};
 const legs=routeLegs(route);assert.deepEqual(legs[0].vehicles,['143','401']);assert.equal(legs[0].stops.at(-1),'하차역');assert.equal(legs[1].guidance,'6번 출구로 이동');assert.equal(legs[2].seconds,null);assert.equal(routeOverview(route),'143 / 401 → 2호선');
});

import {simplifyRoutePaths} from '../public/routes.mjs';
test('display simplification removes small bends, preserves turns and separate paths',()=>{
 const a=[127,37],jitter=[127.0005,37.00002],corner=[127.001,37],end=[127.001,37.001];
 const remote=[[128,38],[128.001,38]];
 const paths=[[a,jitter],[jitter,corner,end],remote];
 assert.deepEqual(simplifyRoutePaths(paths),[[a,corner,end],remote]);
 assert.equal(paths[0].length,2);
});

test('short crossing detours are flattened while a major corner remains',()=>{
 const start=[127,37],before=[127,37.0006],offset=[127.0002,37.0006],after=[127,37.0008],corner=[127,37.002],end=[127.002,37.002];
 assert.deepEqual(simplifyRoutePaths([[start,before,offset,after,corner,end]]),[[start,corner,end]]);
});
