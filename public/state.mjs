export function transition(previous,action) {
  if(action==='visit')return {saved:true,visited:true};
  if(action==='toggle-save')return previous?.saved?{saved:false,visited:false}:{saved:true,visited:false};
  throw new Error('Unknown action');
}
// Display grouping is intentionally approximate; navigation uses original coordinates.
export function cluster(points,radius=32) {
  const groups=[];
  for(const point of points){let group=groups.find(g=>Math.hypot(g.x-point.x,g.y-point.y)<radius);if(!group){group={x:point.x,y:point.y,points:[]};groups.push(group);}group.points.push(point);}
  return groups;
}
