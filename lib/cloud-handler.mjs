import {readFile} from 'node:fs/promises';
import path from 'node:path';
const allowed=new Set(['/api/geocode','/api/reverse-geocode','/api/routes']);
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
async function inputBody(req){
 if(req.body!==undefined){const input=typeof req.body==='string'?JSON.parse(req.body):req.body;if(JSON.stringify(input).length>8192)throw fail('요청이 너무 큽니다.',413);return input;}
 let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>8192)throw fail('요청이 너무 큽니다.',413);chunks.push(Buffer.from(chunk));}return JSON.parse(Buffer.concat(chunks).toString()||'{}');
}
function send(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));}
export function createCloudHandler({env=process.env,fetchImpl=fetch,load=async()=>JSON.parse(await readFile(path.join(process.cwd(),'data/places.json'),'utf8'))}={}){
 async function upstream(url,key){
  if(!key)throw fail('Vercel 환경변수에 카카오 REST API 키를 설정해주세요.',503);
  const response=await fetchImpl(url,{headers:{Authorization:'KakaoAK '+key},signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw fail('카카오 API 연결을 확인해주세요. 응답 코드: '+response.status,502);
  return response.json();
 }
 return async(req,res)=>{try{
  const url=new URL(req.url,'https://'+(req.headers.host||'localhost'));
  const endpoint=url.searchParams.get('endpoint');
  const p=endpoint?'/api/'+endpoint:url.pathname;
  if(p==='/api/config'&&req.method==='GET')return send(res,200,{jsKey:'',restReady:!!env.KAKAO_REST_KEY,mobilityReady:!!(env.KAKAO_MOBILITY_KEY||env.KAKAO_REST_KEY),token:'preview-read-only',readOnly:true});
  if(p==='/api/places'&&req.method==='GET')return send(res,200,(await load()).filter(p=>p.status!=='closed'));
  if(p==='/api/upload'||p==='/api/places'||p.startsWith('/api/places/'))return send(res,403,{error:'테스트 배포에서는 공간 등록·수정과 서버 사진 업로드를 사용할 수 없습니다.'});
  if(!allowed.has(p))return send(res,404,{error:'Not found'});
  if(req.method!=='POST')return send(res,405,{error:'Method not allowed'});
  const origin=req.headers.origin;
  if(!origin||new URL(origin).host!==req.headers.host||!['https:','http:'].includes(new URL(origin).protocol))return send(res,403,{error:'사이트에서 다시 요청해주세요.'});
  if(p==='/api/geocode' && req.method==='POST'){const {address}=await inputBody(req);if(typeof address!=='string'||!address.trim()||address.length>400)throw new Error('주소를 입력하세요.');const search=query=>upstream('https://dapi.kakao.com/v2/local/search/address.json?query='+encodeURIComponent(query),env.KAKAO_REST_KEY);let data=await search(address.trim());const base=address.trim().replace(/[,\s]+(?:지하\s*)?\d+(?:\s*[,~·-]\s*\d+)*층(?:\s.*)?$/,'').trim();if(!data.documents.length&&base&&base!==address.trim())data=await search(base);if(!data.documents.length)data=await upstream('https://dapi.kakao.com/v2/local/search/keyword.json?query='+encodeURIComponent(address.trim()),env.KAKAO_REST_KEY);return send(res,200,data.documents.map(d=>({name:d.place_name||'',address:d.road_address_name||d.address_name,lat:Number(d.y),lng:Number(d.x)})));}
  if(p==='/api/reverse-geocode' && req.method==='POST'){
    const {lat,lng}=await inputBody(req);
    if(!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>90||Math.abs(lng)>180)throw new Error('위치를 확인해주세요.');
    const data=await upstream('https://dapi.kakao.com/v2/local/geo/coord2address.json?x='+lng+'&y='+lat,env.KAKAO_REST_KEY);
    const first=data.documents?.[0];return send(res,200,{address:first?.road_address?.address_name||first?.address?.address_name||null});
  }
  if(p==='/api/routes' && req.method==='POST'){const input=await inputBody(req);if(!['walk','transit','drive'].includes(input.mode))throw new Error('이동수단을 선택하세요.');for(const [k,max]of [['startLat',90],['startLng',180],['endLat',90],['endLng',180]]){if(typeof input[k]!=='number'||!Number.isFinite(input[k])||Math.abs(input[k])>max)throw new Error('출발지와 목적지 좌표를 확인하세요.');}
    let target,key=env.KAKAO_REST_KEY;
    if(input.mode==='drive'){target=new URL('https://apis-navi.kakaomobility.com/v1/directions');target.searchParams.set('origin',`${input.startLng},${input.startLat}`);target.searchParams.set('destination',`${input.endLng},${input.endLat}`);key=env.KAKAO_MOBILITY_KEY||key;}else{target=new URL('https://dapi.kakao.com/v2/routing/'+(input.mode==='walk'?'walk':'publictraffic'));for(const[k,v]of Object.entries({start_x:input.startLng,start_y:input.startLat,end_x:input.endLng,end_y:input.endLat,input_coord:'WGS84',output_coord:'WGS84'}))target.searchParams.set(k,v);}
    return send(res,200,await upstream(target,key));}

 }catch(e){send(res,e.status||(e.name==='TimeoutError'?504:400),{error:e.name==='TimeoutError'?'카카오 API 응답 시간이 초과됐습니다. 다시 시도해주세요.':e.status?e.message:'요청을 처리하지 못했습니다. 입력과 연결 상태를 확인해주세요.'});}};
}
