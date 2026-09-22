export function bindSavedGestures(svg,{getState,setState,onStart}){
 const pointers=new Map();let baseline=null,moved=false,frame=0,next=null,tapTarget=null;
 const pair=()=>{const p=[...pointers.values()];return {x:p.reduce((n,p)=>n+p.x,0)/p.length,y:p.reduce((n,p)=>n+p.y,0)/p.length,distance:p.length>1?Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y):0};};
 function begin(){const mid=pair(),matrix=svg.getScreenCTM();if(!matrix)return;const point=new DOMPoint(mid.x,mid.y).matrixTransform(matrix.inverse());baseline={...mid,...getState(),anchor:[point.x,point.y],scale:matrix.a};}
 const flush=()=>{frame=0;if(next){setState(next);next=null;}};
 svg.addEventListener('pointerdown',e=>{if(e.button!==0)return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===1){moved=false;tapTarget=e.target.closest('[role=button]');}else{moved=true;tapTarget=null;}svg.setPointerCapture(e.pointerId);begin();});
 svg.addEventListener('pointermove',e=>{
  if(!pointers.has(e.pointerId)||!baseline)return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});const mid=pair();
  if(!moved&&Math.hypot(mid.x-baseline.x,mid.y-baseline.y)<5)return;
  moved=true;onStart();const zoom=Math.max(1,Math.min(16,baseline.zoom*(baseline.distance&&mid.distance?mid.distance/baseline.distance:1)));
  const ratio=zoom/baseline.zoom;
  const center=baseline.anchor.map((v,i)=>v-(v-baseline.center[i])/ratio-([mid.x-baseline.x,mid.y-baseline.y][i])/(baseline.scale*ratio));
  next={zoom,center:zoom===1?[200,270]:[Math.max(0,Math.min(400,center[0])),Math.max(0,Math.min(540,center[1]))]};
  if(!frame)frame=requestAnimationFrame(flush);
 });
 function end(e){if(!pointers.has(e.pointerId))return;if(frame){cancelAnimationFrame(frame);flush();}if(e.type==='pointerup'&&pointers.size===1&&!moved&&tapTarget?.isConnected)tapTarget.dispatchEvent(new MouseEvent('click',{bubbles:true}));tapTarget=null;pointers.delete(e.pointerId);if(pointers.size)begin();else baseline=null;}
 svg.addEventListener('pointerup',end);svg.addEventListener('pointercancel',end);svg.addEventListener('lostpointercapture',end);
 // A drag that began over an occupied pixel must not open its place card.
 svg.addEventListener('click',e=>{if(moved){e.preventDefault();e.stopImmediatePropagation();moved=false;}},true);
}
