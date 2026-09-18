export function routesFromResponse(result){
  const rows=Array.isArray(result.routes)?result.routes:result.route?[result.route]:[];
  return rows.filter(r=>r.result_code==null||r.result_code===0).map(route=>({...route,
    steps:route.steps||route.legs?.flatMap(leg=>leg.steps||[])||[]
  }));
}
export function routeLegs(route){
 return (route.steps||route.legs?.flatMap(l=>l.steps||[])||[]).map(step=>{
  const p=step.properties||step;
  return {type:p.type||'WALKING',guidance:p.guidance||'',seconds:Number.isFinite(p.time)?p.time:null,distance:Number.isFinite(p.distance)?p.distance:null,stops:(p.stops||[]).map(s=>s.name).filter(Boolean),vehicles:(p.vehicles||[]).map(v=>v.name).filter(Boolean)};
 });
}
export function routeOverview(route){return routeLegs(route).filter(s=>s.type!=='WALKING').map(s=>s.vehicles.join(' / ')||s.guidance).filter(Boolean).join(' → ');}

// Simplify only the displayed line; route instructions and distances stay intact.
export function simplifyRoutePaths(paths,tolerance=30){
 const groups=[];
 for(const path of paths){
  const last=groups.at(-1),a=last?.at(-1),b=path[0];
  if(a&&Math.hypot((a[0]-b[0])*88000,(a[1]-b[1])*111320)<0.5)last.push(...path.slice(1));
  else groups.push([...path]);
 }
 return groups.map(points=>{
  if(points.length<3)return points;
  const scaleX=111320*Math.cos(points[0][1]*Math.PI/180);
  const xy=points.map(p=>[p[0]*scaleX,p[1]*111320]);
  const keep=new Set([0,points.length-1]),stack=[[0,points.length-1]];
  while(stack.length){
   const [first,last]=stack.pop(),a=xy[first],b=xy[last],dx=b[0]-a[0],dy=b[1]-a[1],len=dx*dx+dy*dy;
   let max=tolerance*tolerance,index=-1;
   for(let i=first+1;i<last;i++){
    const p=xy[i],t=len?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/len)):0;
    const d=(p[0]-a[0]-t*dx)**2+(p[1]-a[1]-t*dy)**2;
    if(d>max){max=d;index=i;}
   }
   if(index!==-1){keep.add(index);stack.push([first,index],[index,last]);}
  }
  return points.filter((_,i)=>keep.has(i));
 });
}
