// A fixed lattice at each zoom level: panning never moves the dots.
export function makeDotGrid(polygons,step){
 const inside=(x,y,poly)=>{let yes=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const[a,b]=poly[i],[c,d]=poly[j];if((b>y)!==(d>y)&&x<(c-a)*(y-b)/(d-b)+a)yes=!yes;}return yes;};
 const cells=[];
 for(let row=0;20+row*step<510;row++)for(let col=0;20+col*step<396;col++){
  const x=20+col*step,y=20+row*step;if(polygons.some(p=>inside(x,y,p)))cells.push({key:`${col}:${row}`,x,y});
 }return cells;
}
export function assignToDots(points,cells){
 const groups=new Map();
 for(const p of points){let nearest=null,distance=Infinity;for(const cell of cells){const d=(p.x-cell.x)**2+(p.y-cell.y)**2;if(d<distance){nearest=cell;distance=d;}}
  if(nearest){if(!groups.has(nearest.key))groups.set(nearest.key,[]);groups.get(nearest.key).push(p);}
 }return groups;
}
