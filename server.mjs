import http from 'node:http';
import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID,randomBytes} from 'node:crypto';
import {validatePlace} from './lib/catalog.mjs';
const root=path.dirname(fileURLToPath(import.meta.url)), publicDir=path.join(root,'public');
const dataDir=process.env.AGIO_DATA_DIR || path.join(root,'data');
const port=Number(process.env.PORT||4317), token=randomBytes(24).toString('hex');
await mkdir(dataDir,{recursive:true}); await mkdir(path.join(publicDir,'uploads'),{recursive:true});
const catalog=path.join(dataDir,'places.json');
try { await readFile(catalog); } catch(e) { if(e.code!=='ENOENT') throw e; await writeFile(catalog,JSON.stringify([{id:'abp-lounge',name:'ABP.LOUNGE',address:'서울특별시 중구 퇴계로87길 53, 1층',lat:null,lng:null,color:'#69786c',status:'draft',hours:'',category:'카페',instagram:'',images:[],order:0,updatedAt:new Date().toISOString()}],null,2)); }
const load=async()=>JSON.parse(await readFile(catalog,'utf8'));
let queue=Promise.resolve();
function mutate(fn) { const run=queue.then(async()=>{const rows=await load();const result=fn(rows);await writeFile(catalog+'.tmp',JSON.stringify(rows,null,2));await rename(catalog+'.tmp',catalog);return result;}); queue=run.catch(()=>{});return run; }
async function body(req) { let size=0;const chunks=[];for await(const c of req){size+=c.length;if(size>16*1024*1024)throw new Error('파일은 10MB 이하로 선택하세요.');chunks.push(c);}return JSON.parse(Buffer.concat(chunks).toString()||'{}'); }
function send(res,status,obj) {res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(obj));}
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp'};
async function upstream(url,key){if(!key){const e=new Error('REST API 키를 .env.local에 입력하고 서버를 다시 시작하세요.');e.status=503;throw e;}const response=await fetch(url,{headers:{Authorization:`KakaoAK ${key}`},signal:AbortSignal.timeout(15000)});const data=await response.json();if(!response.ok){const e=new Error(`카카오 API 응답 ${response.status}: 키, 사용 설정, 호출 권한을 확인하세요.`);e.status=502;throw e;}return data;}
const server=http.createServer(async(req,res)=>{try{
  const allowedHosts=[`127.0.0.1:${port}`,`localhost:${port}`];
  if(!allowedHosts.includes(req.headers.host))return send(res,403,{error:'Local access only'});
  const url=new URL(req.url,`http://${req.headers.host}`), p=url.pathname;
  if(req.method!=='GET' && (req.headers['x-agio-token']!==token || (req.headers.origin && !allowedHosts.some(h=>req.headers.origin===`http://${h}`))))return send(res,403,{error:'페이지를 새로고침하고 다시 시도하세요.'});
  if(p==='/api/config' && req.method==='GET')return send(res,200,{jsKey:process.env.KAKAO_JS_KEY||'',restReady:!!process.env.KAKAO_REST_KEY,mobilityReady:!!(process.env.KAKAO_MOBILITY_KEY||process.env.KAKAO_REST_KEY),token});
  if(p==='/api/places' && req.method==='GET')return send(res,200,await load());
  if(p==='/api/places' && req.method==='POST'){const input=await body(req), place=validatePlace(input);return send(res,201,await mutate(rows=>{const row={...place,id:randomUUID()};rows.push(row);return row;}));}
  if(p.startsWith('/api/places/') && req.method==='PUT'){const id=p.slice(12),place=validatePlace(await body(req));return send(res,200,await mutate(rows=>{const i=rows.findIndex(r=>r.id===id);if(i<0)throw new Error('공간을 찾을 수 없습니다.');return rows[i]={...place,id};}));}
  if(p==='/api/upload' && req.method==='POST'){const input=await body(req);const match=/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(input.image||'');if(!match)throw new Error('JPG, PNG, WebP 사진을 선택하세요.');const buffer=Buffer.from(match[2],'base64');if(buffer.length>10*1024*1024)throw new Error('사진은 10MB 이하로 선택하세요.');const good=match[1]==='jpeg'?buffer[0]===255&&buffer[1]===216:match[1]==='png'?buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):buffer.toString('ascii',0,4)==='RIFF'&&buffer.toString('ascii',8,12)==='WEBP';if(!good)throw new Error('유효한 이미지 파일이 아닙니다.');const name=randomUUID()+'.'+(match[1]==='jpeg'?'jpg':match[1]);await writeFile(path.join(publicDir,'uploads',name),buffer);return send(res,201,{url:'/uploads/'+name});}
  if(p==='/api/geocode' && req.method==='POST'){const {address}=await body(req);if(typeof address!=='string'||!address.trim()||address.length>400)throw new Error('주소를 입력하세요.');const search=query=>upstream('https://dapi.kakao.com/v2/local/search/address.json?query='+encodeURIComponent(query),process.env.KAKAO_REST_KEY);let data=await search(address.trim());const base=address.trim().replace(/[,\s]+(?:지하\s*)?\d+(?:\s*[,~·-]\s*\d+)*층(?:\s.*)?$/,'').trim();if(!data.documents.length&&base&&base!==address.trim())data=await search(base);if(!data.documents.length)data=await upstream('https://dapi.kakao.com/v2/local/search/keyword.json?query='+encodeURIComponent(address.trim()),process.env.KAKAO_REST_KEY);return send(res,200,data.documents.map(d=>({name:d.place_name||'',address:d.road_address_name||d.address_name,lat:Number(d.y),lng:Number(d.x)})));}
  if(p==='/api/reverse-geocode' && req.method==='POST'){
    const {lat,lng}=await body(req);
    if(!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>90||Math.abs(lng)>180)throw new Error('위치를 확인해주세요.');
    const data=await upstream('https://dapi.kakao.com/v2/local/geo/coord2address.json?x='+lng+'&y='+lat,process.env.KAKAO_REST_KEY);
    const first=data.documents?.[0];return send(res,200,{address:first?.road_address?.address_name||first?.address?.address_name||null});
  }
  if(p==='/api/routes' && req.method==='POST'){const input=await body(req);if(!['walk','transit','drive'].includes(input.mode))throw new Error('이동수단을 선택하세요.');for(const [k,max]of [['startLat',90],['startLng',180],['endLat',90],['endLng',180]]){if(typeof input[k]!=='number'||!Number.isFinite(input[k])||Math.abs(input[k])>max)throw new Error('출발지와 목적지 좌표를 확인하세요.');}
    let target,key=process.env.KAKAO_REST_KEY;
    if(input.mode==='drive'){target=new URL('https://apis-navi.kakaomobility.com/v1/directions');target.searchParams.set('origin',`${input.startLng},${input.startLat}`);target.searchParams.set('destination',`${input.endLng},${input.endLat}`);key=process.env.KAKAO_MOBILITY_KEY||key;}else{target=new URL('https://dapi.kakao.com/v2/routing/'+(input.mode==='walk'?'walk':'publictraffic'));for(const[k,v]of Object.entries({start_x:input.startLng,start_y:input.startLat,end_x:input.endLng,end_y:input.endLat,input_coord:'WGS84',output_coord:'WGS84'}))target.searchParams.set(k,v);}
    return send(res,200,await upstream(target,key));}
  if(req.method!=='GET')return send(res,405,{error:'Method not allowed'});
  const asset=p==='/'?'/index.html':p;const file=path.resolve(publicDir,'.'+decodeURIComponent(asset));
  if(!file.startsWith(publicDir+path.sep))return send(res,403,{error:'Forbidden'});
  const ext=path.extname(file);if(!mime[ext])return send(res,404,{error:'Not found'});
  try{const bytes=await readFile(file);res.writeHead(200,{'Content-Type':mime[ext],'X-Content-Type-Options':'nosniff','Cache-Control':'no-store'});res.end(bytes);}catch(e){if(e.code!=='ENOENT')throw e;send(res,404,{error:'Not found'});}
}catch(e){send(res,e.status||400,{error:e.name==='TimeoutError'?'카카오 API 응답 시간이 초과되었습니다.':e.message});}});
server.listen(port,'127.0.0.1',()=>console.log(`AGIO local preview: http://127.0.0.1:${port}`));

