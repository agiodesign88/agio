import {readablePhoto} from './photo-input.mjs';
import {routesFromResponse,routeLegs,routeOverview,simplifyRoutePaths} from './routes.mjs';
import {samplePhoto} from './photo-color.mjs';
import {editorialStyle} from './editorial-style.mjs';
import {currentPosition,stablePosition,createAddressCache} from './location.mjs';
import {transition,cluster} from './state.mjs';
const $=s=>document.querySelector(s), form=$('#place-form');
// Let the browser open its native color picker, including its own eyedropper.
const colorInput=form.elements.namedItem('color');
colorInput.addEventListener('change',()=>{
  $('#form-status').textContent='색을 선택했습니다. 공간 저장을 눌러 핀에 반영하세요.';
});
let config,places=[],photos=[],map,selected=null,markers=[],lines=[],sample={saved:false,visited:false},record=new Map();
const icons={save:'<path d="M6 3h12v18l-6-4-6 4z"/>',directions:'<path d="m21 3-7 18-3-8-8-3z"/><path d="m11 13 10-10"/>'};
const svg=name=>`<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${icons[name]}</svg>`;
function el(tag,text,cls){const node=document.createElement(tag);if(text!=null)node.textContent=text;if(cls)node.className=cls;return node;}
function button(text,handler,cls){const b=el('button',text,cls);b.type='button';b.onclick=handler;return b;}
function iconButton(name,label,handler){const b=button(null,handler);b.innerHTML=svg(name);b.setAttribute('aria-label',label);b.title=label;return b;}
function notify(message){const t=$('#toast');t.textContent=message;t.style.display='block';clearTimeout(notify.timer);notify.timer=setTimeout(()=>t.style.display='none',4500);}
async function api(url,method='GET',data){const r=await fetch(url,{method,headers:method==='GET'?{}:{'Content-Type':'application/json','X-Agio-Token':config.token},body:data===undefined?undefined:JSON.stringify(data)});const value=await r.json();if(!r.ok)throw new Error(value.error||'요청 실패');return value;}
function view(admin){$('#lab').hidden=admin;$('#admin').hidden=!admin;$('#lab-tab').setAttribute('aria-pressed',!admin);$('#admin-tab').setAttribute('aria-pressed',admin);if(!admin&&map)requestAnimationFrame(()=>{map.resize();drawPins();});}
$('#lab-tab').onclick=()=>view(false);$('#admin-tab').onclick=$('#to-admin').onclick=()=>view(true);
function photoNode(url,name){if(!url)return el('div','사진 미등록','no-photo');const img=el('img');img.src=url;img.alt=name;return img;}
function renderLists(){
  $('#place-list').replaceChildren();$('#admin-list').replaceChildren();$('#route-place').replaceChildren();
  for(const p of [...places].sort((a,b)=>a.order-b.order)){
    const label={draft:'초안',published:'공개',closed:'운영 종료'}[p.status];
    const b=button(p.name,()=>selectPlace(p),'place-item');b.append(el('span',p.lat==null?'좌표 미확인':label));$('#place-list').append(b);
    const edit=button(p.name,()=>editPlace(p),'place-item');edit.append(el('span',label));$('#admin-list').append(edit);
    if(p.lat!=null){const o=el('option',p.name);o.value=p.id;$('#route-place').append(o);}
  }
  if(!$('#route-place').options.length){const o=el('option','먼저 공간 좌표를 등록하세요');o.value='';$('#route-place').append(o);}
  updateDestinationAddress();if(map)drawPins();
}
function editPlace(p){for(const name of ['id','name','address','lat','lng','color','hours','category','instagram','status','order'])form.elements.namedItem(name).value=p?.[name]??({color:'#69786c',status:'draft',order:0}[name]??'');photos=[...(p?.images||[])];$('#form-status').textContent=p?'기존 공간 수정: '+p.name+' · 다른 공간은 새 공간 버튼으로 등록하세요.':'새 공간을 등록합니다.';form.querySelector('[type=submit]').textContent=p?'기존 공간 수정 저장':'새 공간 등록';$('#geocode-results').replaceChildren();renderPhotos();}
$('#new-place').onclick=()=>editPlace(null);
function enablePhotoColor(img){
  img.classList.add('color-sample-photo');img.tabIndex=0;img.setAttribute('role','button');
  img.setAttribute('aria-label',img.alt+'에서 대표색 선택');img.title='원하는 지점을 클릭해 대표색 선택';
  function pick(x,y){
    try{
      if(!img.complete||!img.naturalWidth)throw new Error('사진 로딩이 끝난 뒤 다시 선택해주세요.');
      const color=samplePhoto(img,x,y);colorInput.value=color;
      colorInput.dispatchEvent(new Event('change',{bubbles:true}));
      notify('대표색 '+color.toUpperCase()+' 선택 · 공간 저장을 눌러 반영하세요.');
    }catch(error){notify(error.name==='SecurityError'?'이 사진에서 색을 읽을 수 없습니다. 등록한 사진을 다시 확인해주세요.':error.message);}
  }
  img.onclick=e=>{const r=img.getBoundingClientRect();pick(e.clientX-r.left,e.clientY-r.top);};
  img.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();const r=img.getBoundingClientRect();pick(r.width/2,r.height/2);}};
}
function renderPhotos(){const container=$('#photos');container.replaceChildren();photos.forEach((url,i)=>{const box=el('div');const picture=photoNode(url,'공간 사진 '+(i+1));if(picture.tagName==='IMG')enablePhotoColor(picture);box.append(picture);const row=el('div',null,'row');row.append(button('←',()=>{if(i>0){[photos[i-1],photos[i]]=[photos[i],photos[i-1]];renderPhotos();}}),button('→',()=>{if(i<photos.length-1){[photos[i],photos[i+1]]=[photos[i+1],photos[i]];renderPhotos();}}),button('제외',()=>{photos.splice(i,1);renderPhotos();}));box.append(row);container.append(box);});}
$('#catalog-photos').onchange=async e=>{const files=[...e.target.files];const submit=form.querySelector('[type=submit]');try{if(files.length+photos.length>30)throw new Error('사진은 공간당 30장까지입니다.');for(const file of files){const prepared=await readablePhoto(file,message=>$('#form-status').textContent=message);if(file.size>10*1024*1024)throw new Error('사진은 장당 10MB 이하로 선택하세요.');const image=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('사진을 읽지 못했습니다.'));reader.readAsDataURL(prepared);});const saved=await api('/api/upload','POST',{image});photos.push(saved.url);renderPhotos();}$('#form-status').textContent='사진을 추가했습니다. 공간 저장을 눌러 반영하세요.';}catch(err){$('#form-status').textContent=err.message;}finally{e.target.value='';}};
form.onsubmit=async e=>{e.preventDefault();const data=Object.fromEntries(new FormData(form));data.images=photos;const id=data.id;delete data.id;const submit=form.querySelector('[type=submit]');try{const saved=await api(id?'/api/places/'+encodeURIComponent(id):'/api/places',id?'PUT':'POST',data);places=await api('/api/places');renderLists();editPlace(saved);$('#form-status').textContent='이 컴퓨터에 저장했습니다.';}catch(err){$('#form-status').textContent=err.message;}finally{}};
$('#geocode').onclick=async()=>{const b=$('#geocode');b.disabled=true;try{const found=await api('/api/geocode','POST',{address:form.elements.address.value});$('#geocode-results').replaceChildren();if(!found.length)throw new Error('주소를 찾지 못했습니다. 도로명과 건물 번호를 확인하세요.');for(const p of found)$('#geocode-results').append(button(p.address,()=>{form.elements.lat.value=p.lat;form.elements.lng.value=p.lng;$('#geocode-results').replaceChildren();$('#form-status').textContent='좌표를 선택했습니다. 공간 저장을 눌러 반영하세요.';}));}catch(e){$('#form-status').textContent=e.message;}finally{b.disabled=false;}};
function sampleState(action){sample=transition(sample,action);$('#sample-save').textContent=sample.saved?'저장 해제':'저장';$('#sample-dot').style.background=sample.visited?'#69786c':sample.saved?'#333':'#ddd';$('#state-label').textContent=(sample.visited?'방문 등록 · 유채색':sample.saved?'저장 · 무채색':'미저장 · 기본 상태')+' / 세션 한정';}
$('#sample-save').onclick=()=>sampleState('toggle-save');$('#sample-visit').onclick=()=>sampleState('visit');
function closePanel(){selected=null;$('#panel').hidden=true;}
function positionPanel(){
  const panel=$('#panel'),stage=$('.map-stage');
  if(!map||!selected||panel.hidden||selected.lat==null)return;
  const point=map.project([selected.lng,selected.lat]);
  const pinHeight=document.querySelector('.map-pin')?.offsetHeight||86;
  const width=panel.offsetWidth,height=panel.offsetHeight,margin=8;
  panel.style.left=Math.max(margin,Math.min(stage.clientWidth-width-margin,point.x-width/2))+'px';
  panel.style.top=Math.max(margin,Math.min(stage.clientHeight-height-margin,point.y-pinHeight-height-10))+'px';
  panel.style.bottom='auto';panel.style.transform='none';
}
new ResizeObserver(positionPanel).observe($('#panel'));
let pinEndpoint=null;
let routeEndpoints=[];
let liveLocation=null,locationWatch=null,lastLocation=null,locationTrackingHealthy=false;
const cachedAddress=createAddressCache(p=>api('/api/reverse-geocode','POST',{lat:p.latitude,lng:p.longitude}));
let devicePositionPending=null;
function knownPosition(){
  if(lastLocation&&(locationTrackingHealthy||Date.now()-lastLocation.receivedAt<60000))return Promise.resolve(lastLocation);
  if(!devicePositionPending)devicePositionPending=currentPosition(navigator.geolocation).then(coords=>{rememberLocation(coords);return lastLocation;}).finally(()=>devicePositionPending=null);
  return devicePositionPending;
}
let initialMapFitted=false,initialFallbackShown=false,locationUnavailable=false;
function fitInitialMap(){
  if(!map||initialMapFitted||!map.loaded()||!map.getContainer().getBoundingClientRect().height)return;
  if(!liveLocation&&initialFallbackShown)return;
  const candidates=places.filter(p=>Number.isFinite(p.lat)&&Number.isFinite(p.lng)&&p.status!=='closed');
  if(!candidates.length)return;
  const anchor=liveLocation||[candidates[0].lng,candidates[0].lat];
  const distance=p=>{const lat=p.lat*Math.PI/180,base=anchor[1]*Math.PI/180;return Math.sin((lat-base)/2)**2+Math.cos(lat)*Math.cos(base)*Math.sin((p.lng-anchor[0])*Math.PI/360)**2;};
  candidates.sort((a,b)=>distance(a)-distance(b));
  initialMapFitted=!!liveLocation||locationUnavailable;initialFallbackShown=true;
  const count=Math.min(5,candidates.length);
  for(let n=count;n<=candidates.length;n++){
    const visible=candidates.slice(0,n);
    const bounds=new maplibregl.LngLatBounds();bounds.extend(anchor);visible.forEach(p=>bounds.extend([p.lng,p.lat]));
    map.fitBounds(bounds,{padding:{top:110,bottom:65,left:45,right:55},maxZoom:15,duration:0});
    if(liveLocation){
      map.jumpTo({center:anchor,padding:0});
      const rect=map.getContainer().getBoundingClientRect();
      const halfWidth=Math.max(20,rect.width/2-55),halfHeight=Math.max(20,rect.height/2-110);
      const scale=Math.max(1,...visible.map(p=>{const point=map.project([p.lng,p.lat]);return Math.max(Math.abs(point.x-rect.width/2)/halfWidth,Math.abs(point.y-rect.height/2)/halfHeight);}));
      map.jumpTo({center:anchor,zoom:map.getZoom()-Math.log2(scale),padding:0});
    }
    const points=visible.map(p=>{const point=map.project([p.lng,p.lat]);return {x:point.x,y:point.y};});
    if(cluster(points,32).length>=count)break;
  }
  drawPins();
}
function rememberLocation(coords){lastLocation=stablePosition(lastLocation,coords);liveLocation=[lastLocation.longitude,lastLocation.latitude];fitInitialMap();drawPins();}
function watchLocation(){
 if(locationWatch!==null||!navigator.geolocation)return;
 locationWatch=navigator.geolocation.watchPosition(p=>{locationTrackingHealthy=true;rememberLocation(p.coords);},error=>{
  locationTrackingHealthy=false;
  locationUnavailable=true;fitInitialMap();
  if(error.code===1){liveLocation=null;lastLocation=null;drawPins();}
 },{enableHighAccuracy:true,maximumAge:15000,timeout:20000});
}
window.addEventListener('pagehide',()=>{locationTrackingHealthy=false;if(locationWatch!==null){navigator.geolocation.clearWatch(locationWatch);locationWatch=null;}});
window.addEventListener('pageshow',()=>{if(map)watchLocation();});
function setPinEndpoint(value){pinEndpoint=value;for(const [id,key] of [['origin-address','origin'],['destination-address','destination']])$('#'+id).closest('.endpoint-row').classList.toggle('pin-target',value===key);}
for(const [id,key] of [['origin-address','origin'],['destination-address','destination']]){
 const input=$('#'+id);
 input.addEventListener('focus',()=>{if(!$('.route-planner').hidden)setPinEndpoint(key);input.select();});
 input.addEventListener('click',()=>input.select());
}
function applyPinAddress(p){
 if(!pinEndpoint||$('.route-planner').hidden)return false;
 if(p.lat==null)return false;
 const origin=pinEndpoint==='origin';
 if(origin){originSearchVersion++;$('#origin-address').value=p.address;$('#start-lat').value=p.lat;$('#start-lng').value=p.lng;}
 else{destinationSearchVersion++;$('#destination-address').value=p.address;$('#end-lat').value=p.lat;$('#end-lng').value=p.lng;$('#route-place').value=p.id;}
 $('#origin-results').replaceChildren();$('#destination-results').replaceChildren();invalidateRoute();closePanel();setPinEndpoint(null);notify((origin?'출발지':'도착지')+' · '+p.name);return true;
}
function selectPlace(p){
  if(applyPinAddress(p))return;
  selected=p;
  const panel=$('#panel');panel.hidden=false;panel.replaceChildren();
  panel.setAttribute('aria-label',p.name+' 미리보기');
  const picture=button(null,()=>showDetail(p),'panel-photo');
  picture.setAttribute('aria-label',p.name+' 상세 보기');
  picture.append(photoNode(p.images[0],p.name));
  const close=button('×',closePanel,'panel-close');close.setAttribute('aria-label','공간 패널 닫기');
  const bottom=el('div',null,'panel-bottom');
  bottom.append(button(p.name,()=>showDetail(p),'space-name'),iconButton('directions','DIRECTIONS',()=>beginRoute(p)));
  panel.append(picture,close,bottom);
  if(map&&p.lat!=null){
    // Keep the popup ten pixels above the pin head, with both visible.
    const point=map.project([p.lng,p.lat]);
    const stage=$('.map-stage');
    const pinHeight=document.querySelector('.map-pin')?.offsetHeight||86;
    const targetY=Math.min(stage.clientHeight-24,Math.max(stage.clientHeight/2,panel.offsetHeight+pinHeight+24));
    positionPanel();
    map.panBy([point.x-stage.clientWidth/2,point.y-targetY]);
  }
}
function showDetail(p){if(window.agioShell)return window.agioShell.showDetail(p);const content=$('#detail-content');content.replaceChildren(photoNode(p.images[0],p.name));const caption=el('div',null,'caption'),text=el('div',null,'caption-text');text.append(el('h2',p.name));for(const v of [p.address?.trim()||'주소 미등록',p.hours?.trim()||'운영시간 미등록',p.category?.trim()||'카테고리 미등록',p.instagram?.trim()?('@'+p.instagram.trim().replace(/^@/,'')):'인스타 계정 미등록'])text.append(el('p',v));const actions=el('div',null,'actions');const saved=record.get(p.id)?.saved;const save=iconButton('save',saved?'저장 해제':'SAVE',()=>{record.set(p.id,transition(record.get(p.id),'toggle-save'));showDetail(p);notify('세션 한정 저장 상태를 변경했습니다.');});save.setAttribute('aria-pressed',!!saved);if(saved)save.querySelector('svg').style.fill='#111';actions.append(save,iconButton('directions','DIRECTIONS',()=>{$('#detail').close();beginRoute(p);}));caption.append(text,actions);content.append(caption);for(const image of p.images.slice(1))content.append(photoNode(image,p.name));if(!$('#detail').open)$('#detail').showModal();}
$('#close-detail').onclick=()=>$('#detail').close();
function fitRouteView(points){
 if(!map||$('.route-planner').hidden)return;
 if(!points){
  const values=['start-lng','start-lat','end-lng','end-lat'].map(id=>$('#'+id).value);
  if(values.some(v=>v===''))return;
  points=[[Number(values[0]),Number(values[1])],[Number(values[2]),Number(values[3])]];
 }
 if(!points.length||points.some(p=>!p.every(Number.isFinite)))return;
 map.resize();
 const rect=$('#map').getBoundingClientRect(),panel=$('.route-planner').getBoundingClientRect();
 const padding={top:140,bottom:85,left:65,right:65};
 const overlaps=panel.left<rect.right&&panel.right>rect.left&&panel.top<rect.bottom&&panel.bottom>rect.top;
 if(overlaps){
  if(panel.width<rect.width*0.65)padding.right=Math.max(65,rect.right-panel.left+65);
  else padding.bottom=Math.max(85,rect.bottom-panel.top+50);
 }
 // Keep enough visible map area even on short mobile screens.
 padding.top=Math.min(padding.top,Math.max(35,rect.height-padding.bottom-90));
 const bounds=new maplibregl.LngLatBounds();points.forEach(p=>bounds.extend(p));
 map.fitBounds(bounds,{padding,maxZoom:16,duration:600});
}
function beginRoute(p){
 setPinEndpoint(null);window.agioShell?.routeOpen();$('.route-planner').hidden=false;
 destinationSearchVersion++;$('#route-place').value=p?.id||'';updateDestinationAddress();$('#destination-results').replaceChildren();
 $('#route-mode').value='transit';document.querySelectorAll('[data-mode]').forEach(n=>n.setAttribute('aria-pressed',n.dataset.mode==='transit'));
 invalidateRoute();$('#route-form').scrollIntoView({behavior:'smooth',block:'center'});fillCurrentLocation();
}
$('#close-route').onclick=()=>{setPinEndpoint(null);$('.route-planner').hidden=true;clearLines();$('#route-results').replaceChildren();$('#route-status').textContent='';$('.phone').scrollIntoView({behavior:'smooth',block:'start'});};
function drawPins(){if(!map)return;const layer=$('#markers');layer.replaceChildren();const points=places.filter(p=>p.lat!=null&&p.status!=='closed').map(p=>{const pt=map.project([p.lng,p.lat]);return {...p,x:pt.x,y:pt.y};});for(const g of cluster(points,32).sort((a,b)=>a.y-b.y)){const first=g.points[0];const b=button(null,()=>{if(g.points.length===1)selectPlace(first);else{if(pinEndpoint&&!$('.route-planner').hidden){invalidateRoute();for(const p of g.points)$('#route-results').append(button(p.name,()=>applyPinAddress(p),'place-item'));return;}selected=first;const panel=$('#panel');panel.hidden=false;panel.replaceChildren();for(const p of g.points)panel.append(button(p.name,()=>selectPlace(p),'place-item'));}},'map-pin');b.setAttribute('aria-label',g.points.map(p=>p.name).join(', '));b.innerHTML='<span class="pin-shape"><i></i><span></span><em></em></span>';const initial=b.querySelector('.pin-shape i');initial.textContent=(first.name.match(/[a-z]/i)?.[0]||'').toUpperCase();initial.setAttribute('aria-hidden','true');const rgb=first.color.slice(1).match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4);initial.style.color=rgb[0]*0.2126+rgb[1]*0.7152+rgb[2]*0.0722>0.179?'#111':'#fff';b.style.setProperty('--pin-color',first.color);b.querySelector('.pin-shape').style.setProperty('--pin-color',first.color);b.style.left=g.x+'px';b.style.top=g.y+'px';layer.append(b);}for(const [index,coords] of routeEndpoints.entries()){const pt=map.project(coords);const dot=el('span',null,'route-endpoint-dot');dot.style.left=pt.x+'px';dot.style.top=pt.y+'px';dot.style.background=index===0?'#269653':'#df3939';dot.setAttribute('aria-label',index===0?'출발지':'도착지');layer.append(dot);}if(liveLocation){const pt=map.project(liveLocation),dot=el('span',null,'current-location-dot');dot.style.left=pt.x+'px';dot.style.top=pt.y+'px';dot.setAttribute('aria-label','현재 위치');layer.append(dot);}positionPanel();}
$('#monochrome').onchange=()=>$('#map').classList.toggle('mono',$('#monochrome').checked);
$('#zoom-in').onclick=()=>map?map.zoomIn():notify('카카오 지도를 연결하면 확대할 수 있습니다.');$('#zoom-out').onclick=()=>map?map.zoomOut():notify('카카오 지도를 연결하면 축소할 수 있습니다.');
async function initMap(){
  $('#map-message').replaceChildren(el('b','지도 불러오는 중'));
  try{
    if(!window.maplibregl)throw new Error('지도 라이브러리를 불러오지 못했습니다.');
    const p=places.find(p=>p.lat!=null);
    map=new maplibregl.Map({container:'map',style:editorialStyle(),center:[p?.lng??126.978,p?.lat??37.5665],zoom:15,pitch:0,maxPitch:0,bearing:0,attributionControl:false});
    map.addControl(new maplibregl.AttributionControl({compact:true}),'bottom-left');
    map.dragRotate.disable();map.touchZoomRotate.disableRotation();
    $('#map').classList.toggle('mono',$('#monochrome').checked);
    await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(new Error('지도 로딩이 지연됩니다. 네트워크를 확인하고 다시 읽기를 눌러주세요.')),20000);
      map.once('load',()=>{clearTimeout(timer);resolve();});
    });
    $('#map-message').hidden=true;
    $('#connection').textContent='OpenFreeMap 지도 연결됨 · 역 이름만 표시';
    map.on('idle',fitInitialMap);map.on('move',drawPins);map.on('zoom',drawPins);map.on('click',closePanel);
    map.on('movestart',event=>{if(event.originalEvent)initialMapFitted=true;});
    new ResizeObserver(()=>{map.resize();fitInitialMap();drawPins();}).observe($('.map-stage'));
    fitInitialMap();drawPins();watchLocation();
  }catch(e){$('#map-message').replaceChildren(el('b','지도 연결 확인 필요'),el('p',e.message));$('#connection').textContent=e.message;}
}
let locationPending=null;
function fillCurrentLocation(){
  if(locationPending)return locationPending;
  const button=$('#my-location'),status=$('#location-status');
  const locationVersion=++originSearchVersion;$('#origin-address').disabled=false;$('#origin-results').replaceChildren();button.disabled=true;button.textContent='현재 위치 확인 중…';
  $('#origin-address').value='';$('#origin-address').placeholder='주소 확인 중…';
  status.textContent='출발지 확인 중 · 위치 권한을 요청하면 허용해주세요.';
  $('#start-lat').value='';$('#start-lng').value='';clearLines();$('#route-results').replaceChildren();$('#route-status').textContent='';
  const position=knownPosition();
  locationPending=position.then(p=>{

    if(locationVersion!==originSearchVersion)return false;
    $('#start-lat').value=p.latitude;$('#start-lng').value=p.longitude;
    status.textContent=p.accuracy>300?'출발지: 현재 위치 · 위치 오차가 큽니다. 필요하면 다시 확인해주세요.':'출발지: 현재 위치';
    cachedAddress(p).then(found=>{
      if(locationVersion!==originSearchVersion)return;
      if(!found.address?.trim())throw new Error('주소 없음');
      $('#origin-address').value=found.address;
      $('#origin-address').placeholder='출발지 주소';
    }).catch(()=>{
      if(locationVersion!==originSearchVersion)return;
      $('#origin-address').placeholder='출발지 주소';
      $('#route-status').textContent='주소를 불러오지 못했습니다. 출발지 주소를 직접 입력해주세요.';
    });
    scheduleRoute();return true;
  }).catch(error=>{if(locationVersion!==originSearchVersion)return false;$('#origin-address').value='';$('#origin-address').placeholder='출발지 주소';status.textContent=error.message;$('#route-status').textContent=error.message;return false;})
  .finally(()=>{$('#origin-address').disabled=false;button.disabled=false;button.textContent='현재 위치 다시 확인';locationPending=null;});
  return locationPending;
}
$('#my-location').onclick=fillCurrentLocation;
$('#map-my-location').onclick=async()=>{
  if(!map)return notify('지도를 불러온 뒤 다시 시도해주세요.');
  const control=$('#map-my-location');
  control.disabled=true;control.setAttribute('aria-busy','true');
  control.setAttribute('aria-label','내 위치 확인 중');
  notify('현재 위치를 확인하고 있습니다.');
  try{
    const coords=await knownPosition();
    closePanel();
    map.easeTo({center:[coords.longitude,coords.latitude],zoom:Math.max(map.getZoom(),15),duration:matchMedia('(prefers-reduced-motion: reduce)').matches?0:600});
    watchLocation();
    notify(coords.accuracy>300?'내 위치로 이동했습니다. 위치 오차가 클 수 있습니다.':'내 위치로 이동했습니다.');
  }catch(error){notify(error.message);}
  finally{control.disabled=false;control.removeAttribute('aria-busy');control.setAttribute('aria-label','내 위치로 이동');}
};

$('#route-place').onchange=()=>{destinationSearchVersion++;$('#destination-results').replaceChildren();updateDestinationAddress();clearLines();$('#route-results').replaceChildren();if(!$('#origin-address').value)fillCurrentLocation();else scheduleRoute();};
function updateDestinationAddress(){const p=places.find(p=>p.id===$('#route-place').value);$('#destination-address').value=p?.address||'';$('#end-lat').value=p?.lat??'';$('#end-lng').value=p?.lng??'';}
let originSearchVersion=0;
$('#origin-address').oninput=()=>{originSearchVersion++;$('#start-lat').value='';$('#start-lng').value='';$('#origin-results').replaceChildren();$('#location-status').textContent='주소 검색 후 결과를 선택해주세요.';clearLines();$('#route-results').replaceChildren();};
async function searchOrigin(){
  const address=$('#origin-address').value.trim();if(!address){$('#location-status').textContent='출발 주소를 입력해주세요.';return;}
  const version=++originSearchVersion;$('#location-status').textContent='주소 검색 중…';$('#origin-results').replaceChildren();
  try{const rows=await api('/api/geocode','POST',{address});if(version!==originSearchVersion)return;
    $('#location-status').textContent=rows.length?'출발할 주소를 선택해주세요.':'검색 결과가 없습니다. 주소 또는 장소 이름을 확인해주세요.';if(!rows.length)$('#origin-results').append(el('p','검색 결과가 없습니다. 주소 또는 장소 이름을 확인해주세요.','muted'));
    for(const row of rows)$('#origin-results').append(button(row.name?row.name+' · '+row.address:row.address,()=>{
      if(version!==originSearchVersion)return;
      $('#origin-address').value=row.name||row.address;$('#start-lat').value=row.lat;$('#start-lng').value=row.lng;
      $('#origin-results').replaceChildren();$('#location-status').textContent='출발 주소가 설정됐습니다.';invalidateRoute();
    },'place-item'));
  }catch(error){if(version===originSearchVersion){$('#location-status').textContent=error.message;$('#origin-results').replaceChildren(el('p',error.message,'muted'));}}
}

$('#origin-address').onkeydown=e=>{if(e.key==='Enter'&&!e.isComposing){e.preventDefault();searchOrigin();}};
let routeVersion=0;
function clearLines(){clearTimeout(autoRouteTimer);routeEndpoints=[];drawPins();routeVersion++;if(map?.getLayer('agio-route'))map.removeLayer('agio-route');if(map?.getSource('agio-route'))map.removeSource('agio-route');}
function routeCardContent(route){
  const prop=route.properties||route.summary||{},legs=routeLegs(route);
  const seconds=prop.totalTime??prop.duration,distance=prop.totalDistance??prop.distance;
  const head=el('span',null,'route-summary-head');
  head.append(el('strong',seconds!=null?Math.ceil(seconds/60)+'분':'시간 미제공','route-summary-time'));
  const meta=[];const walking=legs.filter(l=>l.type==='WALKING'&&l.seconds!=null);
  if(walking.length)meta.push('도보'+Math.ceil(walking.reduce((n,l)=>n+l.seconds,0)/60)+'분');
  if(prop.transfers!=null)meta.push('환승'+prop.transfers+'회');
  const fare=prop.fare?.value??prop.fare?.min;if(fare!=null)meta.push('요금 '+Number(fare).toLocaleString('ko-KR')+'원');
  if(distance!=null)meta.push((distance/1000).toFixed(1)+'km');
  head.append(el('span',meta.join(' | '),'route-summary-meta'),el('span','▾','route-summary-toggle'));
  const timeline=el('span',null,'route-summary-timeline');
  const transit=legs.filter(l=>['BUS','SUBWAY','TRAIN'].includes(l.type));
  for(const leg of transit){
    const row=el('span',null,'route-summary-stop'),badge=el('span',null,'route-summary-badge');
    const names=leg.vehicles.join(', ');
    if(leg.type==='BUS')badge.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="3" width="12" height="15" rx="2"/><path d="M6 10h12M8 18v3m8-3v3M8 14h1m6 0h1"/></svg>';
    else {const icon=document.querySelector('[data-mode="transit"] svg');if(icon)badge.append(icon.cloneNode(true));}
    const body=el('span',null,'route-summary-body');
    body.append(el('span',leg.stops[0]||leg.guidance||'승차 장소 미제공','route-summary-station'));
    const lines=el('span',null,'route-summary-lines');lines.append(el('span',leg.type==='BUS'?'버스':'지하철','route-summary-tag'),document.createTextNode(' '+(names||'노선 정보 미제공')));body.append(lines);
    if(leg!==transit.at(-1)&&leg.stops.length>1)body.append(el('span','하차 · '+leg.stops.at(-1),'route-summary-transfer'));
    row.append(badge,body);timeline.append(row);
  }
  const last=transit.at(-1);
  if(last){const end=el('span',null,'route-summary-stop route-summary-end');end.append(el('span',null,'route-summary-badge'),el('span',last.stops.at(-1)||'하차 장소 미제공','route-summary-station'));timeline.append(end);}
  else {const first=legs.find(l=>l.guidance);timeline.append(el('span',first?.guidance||'상세 경로 보기','route-summary-station'));}
  return [head,timeline];
}
function renderRouteDetails(route,mode){
  document.querySelector('#route-details')?.remove();
  const active=document.querySelector('.route-option[aria-pressed=true]');if(!active)return;
  const panel=el('section',null,'route-details');panel.id='route-details';panel.setAttribute('aria-label','선택한 경로 상세 안내');
  panel.append(el('h3','이동 안내'));
  const legs=routeLegs(route);let boarded=false;
  if(!legs.length)panel.append(el('p','이 경로에는 구간별 안내가 제공되지 않습니다.','route-leg-meta'));
  const list=el('ol',null,'route-timeline');
  for(const leg of legs){
    const transit=['BUS','SUBWAY','TRAIN'].includes(leg.type),walk=leg.type==='WALKING';
    const item=el('li',null,'route-leg');const badge=el('span',null,'route-leg-icon');
    const iconMode=walk?'walk':leg.type==='BUS'?'drive':'transit';
    const source=document.querySelector('[data-mode="'+iconMode+'"] svg');if(source)badge.append(source.cloneNode(true));
    if(leg.type==='BUS')badge.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="3" width="14" height="16" rx="2"/><path d="M5 10h14M8 19v2m8-2v2M8 15h1m6 0h1"/></svg>';
    item.append(badge);const body=el('div',null,'route-leg-body');
    body.append(el('strong',walk?'도보':(leg.type==='BUS'?'버스 ':'')+(leg.vehicles.join(' / ')||leg.guidance||'이동')));
    const meta=[];if(leg.seconds!=null)meta.push(Math.ceil(leg.seconds/60)+'분');if(leg.distance!=null)meta.push(leg.distance>=1000?(leg.distance/1000).toFixed(1)+' km':Math.round(leg.distance)+' m');
    if(transit&&leg.stops.length>1)meta.push((leg.stops.length-1)+'개 정류장');
    if(meta.length)body.append(el('p',meta.join(' · '),'route-leg-meta'));
    if(transit&&leg.stops.length){
      body.append(el('p',(boarded?'환승 · ':'승차 · ')+leg.stops[0],'route-stop'));boarded=true;
      if(leg.stops.length>2){const detail=el('details',null,'route-stops');detail.append(el('summary','경유 정류장 '+(leg.stops.length-2)+'개'));for(const stop of leg.stops.slice(1,-1))detail.append(el('p',stop));body.append(detail);}
      if(leg.stops.length>1)body.append(el('p','하차 · '+leg.stops.at(-1),'route-stop'));
    }else if(leg.guidance)body.append(el('p',leg.guidance,'route-stop'));
    item.append(body);list.append(item);
  }
  panel.append(list);if(mode==='transit')panel.append(el('p','출발·도착지 연결 도보는 응답에 따라 상세 안내가 생략될 수 있습니다.','route-leg-note'));
  active.after(panel);
}
function showRoute(route,mode,{details=true}={}){
  if(details)renderRouteDetails(route,mode);
  if(!map?.isStyleLoaded())return;clearLines();const paths=[];
  if(mode==='drive'){for(const sec of route.sections||[])for(const road of sec.roads||[]){const pts=[];for(let i=0;i+1<(road.vertexes||[]).length;i+=2)pts.push([road.vertexes[i],road.vertexes[i+1]]);paths.push(pts);}}
  else{for(const step of route.steps||[])if(step.path?.points)paths.push(step.path.points);if(route.path?.points)paths.push(route.path.points);}
  const valid=simplifyRoutePaths(paths.map(p=>p.filter(c=>Array.isArray(c)&&Number.isFinite(c[0])&&Number.isFinite(c[1]))).filter(p=>p.length>1));
  if(!valid.length)return notify('응답에서 표시 가능한 경로 좌표를 찾지 못했습니다.');
  routeEndpoints=[['start-lng','start-lat'],['end-lng','end-lat']].map(ids=>ids.map(id=>Number($('#'+id).value)));
  // Connect the route's road-snapped endpoints to the selected pin coordinates.
  valid[0].unshift(routeEndpoints[0]);valid.at(-1).push(routeEndpoints[1]);drawPins();
  map.addSource('agio-route',{type:'geojson',data:{type:'Feature',properties:{},geometry:{type:'MultiLineString',coordinates:valid}}});
  map.addLayer({id:'agio-route',type:'line',source:'agio-route',layout:{'line-join':'round','line-cap':'round'},paint:{'line-color':'#111','line-width':4,'line-opacity':.8}});
  fitRouteView(valid.flat());
}
$('#route-form').onsubmit=async e=>{e.preventDefault();if(locationPending&&(!$('#start-lat').value||!$('#start-lng').value))await locationPending;if(!$('#start-lat').value||!$('#start-lng').value){if($('#origin-address').value.trim()){await searchOrigin();return;}if(!await fillCurrentLocation())return;}if(!$('#end-lat').value||!$('#end-lng').value){await searchDestination();return;}const target={lat:Number($('#end-lat').value),lng:Number($('#end-lng').value)};const mode=$('#route-mode').value;$('#route-results').replaceChildren();clearLines();$('#route-status').textContent='카카오에서 실제 경로를 조회하는 중…';const requestVersion=routeVersion;try{const result=await api('/api/routes','POST',{mode,startLat:Number($('#start-lat').value),startLng:Number($('#start-lng').value),endLat:target.lat,endLng:target.lng});if(requestVersion!==routeVersion||$('.route-planner').hidden)return;const routes=routesFromResponse(result);if(!routes.length)throw new Error('이 구간의 경로가 없습니다. 출발지와 목적지를 확인하세요.');$('#route-status').textContent='';routes.forEach((route,i)=>{const prop=route.properties||route.summary||{};const seconds=prop.totalTime??prop.duration;const distance=prop.totalDistance??prop.distance;const label=`경로 ${i+1}${seconds!=null?' · '+Math.ceil(seconds/60)+'분':''}${distance!=null?' · '+(distance/1000).toFixed(1)+'km':''}`;const btn=button(null,()=>{document.querySelectorAll('.route-option').forEach(n=>n.setAttribute('aria-pressed','false'));const expanded=btn.getAttribute('aria-expanded')==='true';document.querySelectorAll('.route-option').forEach(n=>n.setAttribute('aria-expanded','false'));btn.setAttribute('aria-pressed','true');btn.setAttribute('aria-expanded',String(!expanded));document.querySelector('#route-details')?.remove();showRoute(route,mode,{details:!expanded});},'route-option');btn.setAttribute('aria-pressed','false');btn.setAttribute('aria-label',label+' 상세 경로');btn.setAttribute('aria-expanded','false');btn.append(...routeCardContent(route));$('#route-results').append(btn);});const first=$('#route-results .route-option');first?.setAttribute('aria-pressed','true');showRoute(routes[0],mode,{details:false});}catch(e){if(requestVersion===routeVersion)$('#route-status').textContent=e.message;}};
let destinationSearchVersion=0;
let autoRouteTimer;
function scheduleRoute(){
  clearTimeout(autoRouteTimer);
  if($('.route-planner').hidden||!['start-lat','start-lng','end-lat','end-lng'].every(id=>$('#'+id).value!==''))return;
  autoRouteTimer=setTimeout(()=>{if(!$('.route-planner').hidden)$('#route-form').requestSubmit();},150);
}
function invalidateRoute(){clearLines();$('#route-results').replaceChildren();$('#route-status').textContent='';scheduleRoute();}
$('#destination-address').oninput=()=>{destinationSearchVersion++;$('#end-lat').value='';$('#end-lng').value='';$('#route-place').value='';$('#destination-results').replaceChildren();invalidateRoute();};
async function searchDestination(){
  const address=$('#destination-address').value.trim();if(!address)return notify('도착지 주소를 입력해주세요.');
  const version=++destinationSearchVersion;$('#destination-results').replaceChildren();$('#route-status').textContent='도착지 검색 중…';
  try{const rows=await api('/api/geocode','POST',{address});if(version!==destinationSearchVersion)return;
    $('#route-status').textContent=rows.length?'도착할 주소를 선택해주세요.':'검색 결과가 없습니다. 주소 또는 장소 이름을 확인해주세요.';
    for(const row of rows)$('#destination-results').append(button(row.name?row.name+' · '+row.address:row.address,()=>{if(version!==destinationSearchVersion)return;$('#destination-address').value=row.name||row.address;$('#end-lat').value=row.lat;$('#end-lng').value=row.lng;$('#destination-results').replaceChildren();invalidateRoute();},'place-item'));
  }catch(e){if(version===destinationSearchVersion)$('#route-status').textContent=e.message;}
}

$('#destination-address').onkeydown=e=>{if(e.key==='Enter'&&!e.isComposing){e.preventDefault();searchDestination();}};
$('#swap-route').onclick=()=>{
  if(locationPending)return notify('현재 위치 확인이 끝난 뒤 바꿔주세요.');
  originSearchVersion++;destinationSearchVersion++;
  for(const [a,b] of [['origin-address','destination-address'],['start-lat','end-lat'],['start-lng','end-lng']]){const first=$('#'+a),second=$('#'+b);[first.value,second.value]=[second.value,first.value];}
  $('#route-place').value='';$('#origin-results').replaceChildren();$('#destination-results').replaceChildren();$('#location-status').textContent='출발지와 도착지를 바꿨습니다.';invalidateRoute();
};
document.querySelectorAll('[data-mode]').forEach(btn=>btn.onclick=()=>{document.querySelectorAll('[data-mode]').forEach(n=>n.setAttribute('aria-pressed',n===btn));$('#route-mode').value=btn.dataset.mode;invalidateRoute();});
for(const [id,search] of [['origin-address',searchOrigin],['destination-address',searchDestination]]){
  const input=$('#'+id);let timer,composing=false;
  const queue=()=>{clearTimeout(timer);if(!composing&&input.value.trim().length>=2)timer=setTimeout(()=>{const latitude=$('#'+(id==='origin-address'?'start-lat':'end-lat')).value;if(!$('.route-planner').hidden&&!latitude)search();},500);};
  input.addEventListener('input',queue);
  input.addEventListener('compositionstart',()=>{composing=true;clearTimeout(timer);});
  input.addEventListener('compositionend',()=>{composing=false;queue();});
  input.addEventListener('keydown',e=>{if(e.key==='Enter')clearTimeout(timer);});
}
$('#reload').onclick=()=>location.reload();
async function boot(){try{config=await api('/api/config');if(config.readOnly&&location.pathname.endsWith('/lab.html')){document.body.replaceChildren(el('p','공간 관리는 로컬 앱에서 이용해주세요. 이 배포는 조회 전용입니다.'));return;}places=await api('/api/places');$('#connection').textContent=`JavaScript 키: ${config.jsKey?'설정됨':'미설정'} / REST 키: ${config.restReady?'설정됨':'미설정'}`;renderLists();editPlace(null);window.dispatchEvent(new CustomEvent("agio-catalog",{detail:places}));await initMap();}catch(e){$('#connection').textContent=e.message;}}
export const ready=boot();
export {beginRoute,selectPlace};
export function refreshMap(){map?.resize();fitInitialMap();drawPins();}

