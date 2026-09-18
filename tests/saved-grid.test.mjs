import test from 'node:test';
import assert from 'node:assert/strict';
import {makeDotGrid,assignToDots} from '../public/saved-grid.mjs';
const land=[[[20,20],[60,20],[60,60],[20,60]]];
test('nearby and offshore places color existing lattice cells only',()=>{
 const cells=makeDotGrid(land,8),points=[{id:'a',x:29,y:29},{id:'b',x:30,y:29},{id:'coast',x:10,y:29}];
 const groups=assignToDots(points,cells);assert.equal(groups.size,2);assert.equal([...groups.values()].flat().length,3);
 for(const key of groups.keys())assert.ok(cells.some(c=>c.key===key));
 assert.equal([...groups.values()].find(items=>items.some(p=>p.id==='a')).length,2);
});
test('zoom refinement separates spaces while identical coordinates stay grouped',()=>{
 const points=[{id:'a',x:29,y:29},{id:'b',x:31,y:29},{id:'c',x:29,y:29}];
 assert.equal(assignToDots(points,makeDotGrid(land,8)).size,1);
 const groups=assignToDots(points,makeDotGrid(land,1));assert.equal(groups.size,2);
 assert.equal([...groups.values()].find(items=>items.some(p=>p.id==='a')).length,2);
});
