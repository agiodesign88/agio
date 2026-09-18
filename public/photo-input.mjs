let decoderPromise;
export function isHeic(file){return /\.(heic|heif)$/i.test(file.name||'')||/^image\/hei[cf](?:-sequence)?$/i.test(file.type||'');}
function decoder(){return decoderPromise ||= import('./vendor/heic-to.mjs').then(m=>m.heicTo).catch(e=>{decoderPromise=null;throw e;});}
export async function readablePhoto(file,onProgress=()=>{}){
 if(file.size>10*1024*1024)throw new Error('10MB 이하의 사진을 선택해주세요.');
 if(!isHeic(file))return file;
 onProgress('HEIC 사진을 변환하는 중입니다.');
 try{const bitmap=await createImageBitmap(file);bitmap.close();return await jpegFromBlob(file);}catch{}
 try{
  const convert=await decoder();const result=await convert({blob:file,type:'image/jpeg',quality:.9});
  return await jpegFromBlob(Array.isArray(result)?result[0]:result);
 }catch{throw new Error('HEIC 사진을 변환하지 못했습니다. 원본을 기기에 다운로드한 뒤 다시 선택해주세요.');}
}
async function jpegFromBlob(blob){
 const bitmap=await createImageBitmap(blob);
 try{const scale=Math.min(1,2000/Math.max(bitmap.width,bitmap.height));const canvas=document.createElement('canvas');canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);const jpeg=await new Promise(r=>canvas.toBlob(r,'image/jpeg',.9));if(!jpeg)throw Error('변환 실패');return jpeg;}finally{bitmap.close();}
}
