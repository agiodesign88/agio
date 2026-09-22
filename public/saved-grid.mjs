// A fixed lattice at each zoom level: panning never moves the dots.
export function makeDotGrid(polygons,step,bounds=null){
 const inside=(x,y,poly)=>{let yes=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const[a,b]=poly[i],[c,d]=poly[j];if((b>y)!==(d>y)&&x<(c-a)*(y-b)/(d-b)+a)yes=!yes;}return yes;};
 const cells=[];
 const firstRow=bounds?Math.max(0,Math.ceil((bounds.top-20)/step)):0;
 const firstCol=bounds?Math.max(0,Math.ceil((bounds.left-20)/step)):0;
 const bottom=bounds?Math.min(510,bounds.bottom):510,right=bounds?Math.min(396,bounds.right):396;
 for(let row=firstRow;20+row*step<bottom;row++)for(let col=firstCol;20+col*step<right;col++){
  const x=20+col*step,y=20+row*step;if(polygons.some(p=>inside(x,y,p)))cells.push({key:`${col}:${row}`,x,y});
 }return cells;
}
export function assignToDots(points,cells){
 const groups=new Map();
 for(const p of points){let nearest=null,distance=Infinity;for(const cell of cells){const d=(p.x-cell.x)**2+(p.y-cell.y)**2;if(d<distance){nearest=cell;distance=d;}}
  if(nearest){if(!groups.has(nearest.key))groups.set(nearest.key,[]);groups.get(nearest.key).push(p);}
 }return groups;
}
