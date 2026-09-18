// Map a point on a centered object-fit:cover thumbnail back to its source image.
export function sourcePoint(width,height,boxWidth,boxHeight,x,y){
  if(![width,height,boxWidth,boxHeight].every(n=>Number.isFinite(n)&&n>0))throw new Error('사진이 아직 준비되지 않았습니다.');
  const scale=Math.max(boxWidth/width,boxHeight/height);
  return {
    x:Math.max(0,Math.min(width-1,Math.floor((x+(width*scale-boxWidth)/2)/scale))),
    y:Math.max(0,Math.min(height-1,Math.floor((y+(height*scale-boxHeight)/2)/scale)))
  };
}
export function samplePhoto(img,x,y){
  const rect=img.getBoundingClientRect();
  const point=sourcePoint(img.naturalWidth,img.naturalHeight,rect.width,rect.height,x,y);
  const canvas=document.createElement('canvas');canvas.width=canvas.height=1;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  ctx.fillStyle='#ffffff';ctx.fillRect(0,0,1,1);
  ctx.drawImage(img,point.x,point.y,1,1,0,0,1,1);
  const rgb=ctx.getImageData(0,0,1,1).data;
  return '#'+[...rgb].slice(0,3).map(n=>n.toString(16).padStart(2,'0')).join('');
}
