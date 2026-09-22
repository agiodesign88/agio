
import {readablePhoto,isHeic} from './photo-input.mjs';
import {allRecords,photoCount,photoPage,photoFile,setSaved,addVisit,deleteVisit} from './records.mjs';
import {makeDotGrid,assignToDots} from './saved-grid.mjs';
const $=s=>document.querySelector(s);
const paths={camera:'<path d="M3 7h4l2-3h6l2 3h4v14H3z"/><circle cx="12" cy="13" r="4"/>',back:'<path d="m14 5-7 7 7 7M7 12h14"/>',save:'<path d="M6 3h12v18l-6-4-6 4z"/>',directions:'<path d="m21 3-7 18-3-8-8-3zM11 13 21 3"/>'};
const icon=n=>`<svg viewBox="0 0 24 24" class="icon" aria-hidden="true">${paths[n]}</svg>`;
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;};
function btn(text,action,cls){const n=el('button',text,cls);n.type='button';n.onclick=action;return n;}
function ibtn(name,label,action){const b=btn(null,action,'icon-only');b.innerHTML=icon(name);b.setAttribute('aria-label',label);return b;}
function image(url,name){const img=el('img');img.src=url;img.alt=name;img.loading='lazy';return img;}
function toast(t){$('#toast').textContent=t;$('#toast').style.display='block';clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').style.display='none',3200);}
let places=[],records=new Map(),engine,currentDetail,previousScreen='home',savedScroll=0,routeShowing=false;
let selectedPhoto=null,previewURL=null,storageReady=false,visitBusy=false,selectionVersion=0,draftId=null;
const savingPlaces=new Set();
const recordChannel=typeof BroadcastChannel!=='undefined'?new BroadcastChannel('agio-record-changes'):null;
recordChannel?.addEventListener('message',()=>refreshRecords().catch(e=>toast(e.message)));
async function refreshRecords(){records=new Map((await allRecords()).map(r=>[r.placeId,r]));renderSaved();updateSaveButtons();if(currentDetail)renderDetail(currentDetail);await updatePhotoCount();}
function updateSaveButtons(){
  document.querySelectorAll('[data-save-place]').forEach(b=>{
    const saved=!!records.get(b.dataset.savePlace)?.saved;
    b.disabled=!storageReady||savingPlaces.has(b.dataset.savePlace);
    b.setAttribute('aria-pressed',String(saved));
    b.setAttribute('aria-label',saved?'저장 해제':'공간 저장');b.title=saved?'저장 해제':'공간 저장';
  });
}
function createSaveButton(p){
  const b=ibtn('save','공간 저장',async()=>{
    if(!storageReady||savingPlaces.has(p.id))return;
    savingPlaces.add(p.id);updateSaveButtons();
    try{const next=await setSaved(p.id,!records.get(p.id)?.saved);records.set(p.id,next);renderSaved();changed();toast(next.saved?'공간을 저장했습니다.':'저장을 해제했습니다.');}
    catch(e){toast(e.message);}
    finally{savingPlaces.delete(p.id);updateSaveButtons();}
  });
  b.dataset.savePlace=p.id;b.disabled=!storageReady||savingPlaces.has(p.id);
  const saved=!!records.get(p.id)?.saved;b.setAttribute('aria-pressed',String(saved));b.setAttribute('aria-label',saved?'저장 해제':'공간 저장');b.title=saved?'저장 해제':'공간 저장';
  return b;
}
function discoveryButton(p){const b=ibtn('directions','길찾기',()=>engine.beginRoute(p));b.innerHTML='<img class="discovery-icon" src="/discovery-icon.svg" alt="">';return b;}
function changed(){updateSaveButtons();recordChannel?.postMessage('changed');}
const stage=$('.map-stage');$('#map-mount').append(stage);$('#map-screen').append($('.route-planner'));
const routePanel=$('.route-planner');
const routeHandle=btn(null,()=>setRouteCollapsed(!routePanel.classList.contains('is-collapsed')),'route-sheet-handle');
routeHandle.innerHTML='<span aria-hidden="true"></span>';
routePanel.prepend(routeHandle);
function setRouteCollapsed(collapsed){if(collapsed)routePanel.scrollTop=0;routePanel.classList.toggle('is-collapsed',collapsed);routeHandle.setAttribute('aria-expanded',String(!collapsed));routeHandle.setAttribute('aria-label',collapsed?'길찾기 패널 펼치기':'길찾기 패널 아래로 내리기');}
setRouteCollapsed(false);
let routeDrag=null,suppressRouteClick=false;
routeHandle.addEventListener('pointerdown',e=>{if(e.button!==0)return;routeDrag={y:e.clientY,delta:0};routeHandle.setPointerCapture(e.pointerId);});
routeHandle.addEventListener('pointermove',e=>{if(routeDrag)routeDrag.delta=e.clientY-routeDrag.y;});
routeHandle.addEventListener('pointerup',()=>{if(!routeDrag)return;const delta=routeDrag.delta;routeDrag=null;if(Math.abs(delta)>25){suppressRouteClick=true;setRouteCollapsed(delta>0);setTimeout(()=>suppressRouteClick=false,0);}});
routeHandle.addEventListener('pointercancel',()=>routeDrag=null);
routeHandle.addEventListener('click',e=>{if(suppressRouteClick){e.stopImmediatePropagation();e.preventDefault();}},{capture:true});
$('#camera-open').innerHTML=icon('camera');$('#detail-back').innerHTML=icon('back');
window.agioShell={showDetail,createSaveButton,routeOpen(){setRouteCollapsed(false);routeShowing=true;location.hash='map';showScreen('map');}};
window.addEventListener('agio-catalog',e=>{places=e.detail.filter(p=>p.status!=='closed').sort((a,b)=>a.order-b.order);renderHome();renderSaved();renderSpaceOptions();if(location.hash.startsWith('#space/'))route();});
function renderHome(){
  const grid=$('#home-grid');grid.replaceChildren();$('#space-count').textContent=String(places.length).padStart(2,'0');
  for(const p of places){const b=btn(null,()=>showDetail(p),'space-card');if(p.images[0])b.append(image(p.images[0],p.name));else b.append(el('div','사진 준비 중','no-photo'));b.append(el('span',p.name));grid.append(b);}
  $('#home-status').textContent=places.length?'':'등록된 공간이 없습니다.';
}
function showScreen(name){
  document.querySelectorAll('.screen').forEach(n=>n.hidden=n.id!==name+'-screen');
  document.querySelectorAll('.bottom-nav a').forEach(n=>{if(n.dataset.screen===name)n.setAttribute('aria-current','page');else n.removeAttribute('aria-current');});
  document.body.dataset.screen=name;$('#camera-open').hidden=name==='settings';
  if(name==='map')requestAnimationFrame(()=>engine?.refreshMap());
  if(name==='saved')renderSaved();
  if(name!=='map'&&!$('.route-planner').hidden){$('#close-route').click();routeShowing=false;}
}
function route(){const name=location.hash.slice(1)||'home';if(name.startsWith('space/')){const p=places.find(p=>p.id===decodeURIComponent(name.slice(6)));if(p){renderDetail(p);showScreen('detail');}return;}showScreen(['home','map','saved','settings'].includes(name)?name:'home');window.scrollTo(0,name===previousScreen?savedScroll:0);}
window.addEventListener('hashchange',route);
function showDetail(p){previousScreen=document.body.dataset.screen||'home';savedScroll=window.scrollY;location.hash='space/'+encodeURIComponent(p.id);renderDetail(p);showScreen('detail');window.scrollTo(0,0);}
$('#detail-back').onclick=()=>{location.hash=previousScreen;};
function renderDetail(p){
  currentDetail=p;const box=$('#space-detail');box.replaceChildren();if(p.images[0])box.append(image(p.images[0],p.name));
  const caption=el('div',null,'caption'),text=el('div',null,'caption-text');text.append(el('h2',p.name));
  for(const v of [p.address?.trim()||'주소 미등록',p.hours?.trim()||'운영시간 미등록',p.category?.trim()||'카테고리 미등록'])text.append(el('p',v));
  if(!p.instagram?.trim())text.append(el('p','인스타 계정 미등록'));
  if(p.instagram?.trim()){const account=p.instagram.trim().replace(/^@/,'');if(/^[\w.]+$/.test(account)){const a=el('a','@'+account);a.href='https://www.instagram.com/'+encodeURIComponent(account)+'/';a.target='_blank';a.rel='noreferrer';text.append(a);}}
  const actions=el('div',null,'actions');const save=createSaveButton(p);actions.append(save,ibtn('directions','DIRECTIONS',()=>engine.beginRoute(p)));caption.append(text,actions);box.append(caption);
  for(const url of p.images.slice(1))box.append(image(url,p.name));
}
function renderSpaceOptions(){const select=$('#visit-place');select.replaceChildren();for(const p of places){const o=el('option',p.name);o.value=p.id;select.append(o);}$('#camera-open').disabled=!places.length;}
function openVisit(){if(!storageReady)return toast('기록 보관 기능을 사용할 수 없습니다.');if(currentDetail&&document.body.dataset.screen==='detail')$('#visit-place').value=currentDetail.id;$('#visit-dialog').showModal();}
$('#camera-open').onclick=openVisit;
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>$('#'+b.dataset.close).close());
$('#take-photo').onclick=()=>$('#camera-file').click();$('#choose-photo').onclick=()=>$('#album-file').click();
function clearDraft(){selectionVersion++;selectedPhoto=null;draftId=null;if(previewURL)URL.revokeObjectURL(previewURL);previewURL=null;$('#visit-preview').removeAttribute('src');$('#visit-preview').hidden=true;$('#visit-submit').disabled=true;$('#visit-status').textContent='';}
$('#visit-dialog').addEventListener('close',()=>{if(!visitBusy)clearDraft();});
$('#visit-dialog').addEventListener('cancel',e=>{if(visitBusy)e.preventDefault();});
async function chooseFile(e){
  if(visitBusy)return;clearDraft();const version=selectionVersion;
  const file=e.target.files[0];e.target.value='';if(!file)return;
  $('#visit-status').textContent='사진을 읽는 중입니다.';
  try{if(file.size>10*1024*1024)throw new Error('10MB 이하의 사진을 선택해주세요.');if(!file.type.startsWith('image/')&&!isHeic(file))throw new Error('사진 파일을 선택해주세요.');
    const prepared=await readablePhoto(file,message=>{if(version===selectionVersion)$('#visit-status').textContent=message;});if(version!==selectionVersion)return;const bitmap=await createImageBitmap(prepared);if(version!==selectionVersion){bitmap.close();return;}
    const scale=Math.min(1,1800/Math.max(bitmap.width,bitmap.height));const canvas=document.createElement('canvas');canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
    const blob=await new Promise(r=>canvas.toBlob(r,'image/jpeg',.88));if(version!==selectionVersion)return;if(!blob)throw new Error('사진을 읽지 못했습니다.');
    selectedPhoto=blob;draftId=crypto.randomUUID();previewURL=URL.createObjectURL(blob);$('#visit-preview').src=previewURL;$('#visit-preview').hidden=false;$('#visit-status').textContent='선택한 공간의 주소로 기록됩니다.';$('#visit-submit').disabled=false;
  }catch(e){if(version===selectionVersion)$('#visit-status').textContent=e.message.includes('10MB')||isHeic(file)?e.message:'사진을 읽지 못했습니다. JPG, PNG, WebP 또는 HEIC 사진을 선택해주세요.';}
}
$('#camera-file').onchange=$('#album-file').onchange=chooseFile;
$('#visit-form').onsubmit=async e=>{e.preventDefault();if(visitBusy||!selectedPhoto)return;const p=places.find(p=>p.id===$('#visit-place').value);if(!p)return;visitBusy=true;
  const controls=[...$('#visit-dialog').querySelectorAll('button,select,input')];controls.forEach(n=>n.disabled=true);
  try{const next=await addVisit({id:draftId,placeId:p.id,blob:selectedPhoto,createdAt:Date.now()});records.set(p.id,next);renderSaved();if(currentDetail?.id===p.id)renderDetail(p);changed();updatePhotoCount();visitBusy=false;$('#visit-dialog').close();clearDraft();location.hash='saved';toast('방문을 기록했습니다. 공간의 색이 채워졌어요.');}
  catch(err){$('#visit-status').textContent=err.message;}
  finally{visitBusy=false;controls.forEach(n=>n.disabled=false);$('#visit-submit').disabled=!selectedPhoto;}
};
// A deliberately approximate dotted silhouette; route finding always uses original coordinates.
const mainland=[[126.1,37.75],[126.65,37.82],[127.1,38.05],[127.7,38.3],[128.32,38.6],[128.55,38.2],[128.62,37.9],[129.05,37.25],[129.4,36.5],[129.45,35.8],[129.2,35.25],[128.75,34.98],[128.4,34.85],[128.0,34.9],[127.65,34.65],[127.3,34.72],[126.9,34.4],[126.5,34.35],[126.15,34.55],[126.2,34.9],[126.35,35.15],[126.5,35.55],[126.35,35.85],[126.65,36.05],[126.5,36.35],[126.15,36.7],[126.4,37],[126.6,37.3],[126.1,37.5]];
const jeju=[[126.12,33.33],[126.28,33.48],[126.57,33.56],[126.9,33.51],[126.93,33.38],[126.63,33.23],[126.3,33.22]];
const project=([lng,lat])=>[lng>129.5?332.4+(lng-129.5)*22:55+(lng-125.7)*73,36+(38.8-lat)*82];
// Enlarged schematic islands, aligned to the existing dot lattice.
const ulleung=[[355,137],[361,134],[368,138],[370,144],[365,151],[358,150],[354,144]];
const dokdo=[[383,161],[389,160],[391,165],[387,168],[383,166]];
const polygons=[...([mainland,jeju].map(poly=>poly.map(project))),ulleung,dokdo];
const savedGrids=new Map();
let zoom=1,center=[200,270];const ns='http://www.w3.org/2000/svg';
function dot(x,y,r,color){const c=document.createElementNS(ns,'circle');for(const[k,v]of Object.entries({cx:x,cy:y,r,fill:color}))c.setAttribute(k,v);return c;}
function renderSaved(){
  const svg=$('#saved-map');svg.replaceChildren();const w=400/zoom,h=540/zoom;svg.setAttribute('viewBox',`${center[0]-w/2} ${center[1]-h/2} ${w} ${h}`);
  const saved=places.filter(p=>records.get(p.id)?.saved),visited=saved.filter(p=>records.get(p.id)?.visited);
  $('#saved-total').textContent=saved.length;$('#visited-total').textContent=visited.length;
  $('#saved-hint').textContent=saved.length?'색이 채워진 점을 누르면 공간을 볼 수 있어요. 확대하면 가까운 공간이 나뉩니다.':'마음에 드는 공간을 저장해보세요.';
  const level=Math.floor(Math.log2(zoom)),step=8/2**level;
  if(!savedGrids.has(level))savedGrids.set(level,makeDotGrid(polygons,step));
  const cells=savedGrids.get(level);
  const points=saved.filter(p=>p.lat!=null).map(p=>{const[x,y]=project([p.lng,p.lat]);return {...p,x,y};});
  const groups=assignToDots(points,cells);
  for(const cell of cells){
    if(Math.abs(cell.x-center[0])>w/2+step||Math.abs(cell.y-center[1])>h/2+step)continue;
    const items=groups.get(cell.key)||[];
    const colored=items.filter(p=>records.get(p.id)?.visited).sort((a,b)=>records.get(b.id).updatedAt-records.get(a.id).updatedAt);
    const circle=dot(cell.x,cell.y,2.9/zoom,items.length?(colored[0]?.color||'#333'):'#d9d7d2');
    circle.dataset.gridCell=cell.key;
    if(!items.length){svg.append(circle);continue;}
    const group=document.createElementNS(ns,'g');group.setAttribute('role','button');group.setAttribute('tabindex','0');group.setAttribute('aria-label',items.map(p=>p.name).join(', '));group.append(dot(cell.x,cell.y,4/zoom,'transparent'),circle);
    const open=()=>openSavedPanel(items);group.onclick=open;group.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open();}};svg.append(group);
  }
  const list=$('#saved-list');list.replaceChildren();for(const p of saved){const b=btn(null,()=>showDetail(p),'saved-space');if(p.images[0])b.append(image(p.images[0],p.name));const t=el('div');t.append(el('strong',p.name),el('span',records.get(p.id).visited?'VISITED':'SAVED'));b.append(t);list.append(b);}
}
function openSavedPanel(items){const panel=$('#saved-panel');panel.hidden=false;panel.replaceChildren();const p=items[0];if(items.length>1){for(const item of items)panel.append(btn(item.name,()=>openSavedPanel([item]),'place-item'));panel.append(btn('닫기',()=>panel.hidden=true));return;}
  const photo=btn(null,()=>showDetail(p),'panel-photo');if(p.images[0])photo.append(image(p.images[0],p.name));const bottom=el('div',null,'panel-bottom');bottom.append(btn(p.name,()=>showDetail(p),'space-name'),discoveryButton(p),createSaveButton(p));panel.append(photo,btn('×',()=>panel.hidden=true,'panel-close'),bottom);
}
function setZoom(next){const old=zoom;zoom=Math.max(1,Math.min(14,next));if(zoom===1)center=[200,270];else if(old===1){const p=places.find(p=>records.get(p.id)?.saved&&p.lat!=null);center=p?project([p.lng,p.lat]):[190,180];}$('#saved-panel').hidden=true;renderSaved();}
$('#saved-plus').onclick=()=>setZoom(zoom*1.8);$('#saved-minus').onclick=()=>setZoom(zoom/1.8);$('#saved-reset').onclick=()=>setZoom(1);
$('#saved-map').addEventListener('wheel',e=>{e.preventDefault();setZoom(zoom*(e.deltaY<0?1.2:1/1.2));},{passive:false});
let drag=null;$('#saved-map').onpointerdown=e=>{if(e.target.closest('[role=button]'))return;drag=[e.clientX,e.clientY,...center];$('#saved-map').setPointerCapture(e.pointerId);};
$('#saved-map').onpointermove=e=>{if(!drag||zoom===1)return;const bounds=$('#saved-map').getBoundingClientRect();center=[Math.max(0,Math.min(400,drag[2]-(e.clientX-drag[0])*400/bounds.width/zoom)),Math.max(0,Math.min(540,drag[3]-(e.clientY-drag[1])*540/bounds.height/zoom))];renderSaved();};$('#saved-map').onpointerup=$('#saved-map').onpointercancel=()=>drag=null;
function info(title,text){$('#info-title').textContent=title;$('#info-content').replaceChildren(el('p',text));$('#info-dialog').showModal();}
$('#about-open').onclick=()=>info('AGIO_srm','아지오의 취향으로 선정한 공간. 사진으로 발견하고, 지도로 찾아가고, 당신의 방문을 색으로 기록합니다.');
$('#storage-info').onclick=()=>info('개인 기록 보관 안내','저장과 방문 사진은 이 브라우저의 기기 저장소에 보관됩니다. 다른 기기와 동기화되지 않으며, 브라우저 데이터를 지우면 기록도 삭제됩니다. 저장을 해제해도 방문 사진은 내 방문 사진에 남습니다. 다시 저장하면 무채색으로 시작하고 사진을 등록하면 공간의 색이 채워집니다. 마지막 방문 사진을 삭제하면 저장은 유지되고 무채색으로 돌아갑니다.');
$('#permission-info').onclick=()=>info('카메라 · 사진 · 위치','사진 촬영 또는 앨범 선택 시 기기에서 사진을 골라주세요. 길찾기를 열면 현재 위치 사용을 요청합니다. 위치를 허용하지 않아도 주소를 직접 검색할 수 있습니다. 권한은 브라우저의 사이트 설정에서 변경할 수 있습니다.');
let photoURLs=[],galleryVersion=0;
function releaseGallery(){galleryVersion++;photoURLs.forEach(u=>URL.revokeObjectURL(u));photoURLs=[];}
$('#info-dialog').addEventListener('close',releaseGallery);
async function updatePhotoCount(){try{$('#photo-count').textContent=await photoCount();}catch{$('#photo-count').textContent='확인 필요';}}
async function openGallery(){
  releaseGallery();const version=galleryVersion;$('#info-title').textContent='MY VISITS';const content=$('#info-content');content.replaceChildren();
  const list=el('div'),status=el('p','사진을 불러오는 중입니다.');status.setAttribute('role','status');const more=btn('더 보기',loadMore,'gallery-more');more.hidden=true;content.append(list,status,more);if(!$('#info-dialog').open)$('#info-dialog').showModal();
  let cursor=null,busy=false;
  async function loadMore(){if(busy)return;busy=true;more.disabled=true;
    try{const page=await photoPage(cursor);if(version!==galleryVersion)return;
      const files=await Promise.all(page.rows.map(r=>photoFile(r.id)));if(version!==galleryVersion)return;
      for(const [i,r] of page.rows.entries()){const file=files[i];if(!file)continue;
        const url=URL.createObjectURL(file.blob);photoURLs.push(url);const p=places.find(p=>p.id===r.placeId),card=el('section',null,'visit-card');card.append(image(url,p?.name||'방문 사진'),el('p',(p?.name||'방문 공간')+' · '+new Date(r.createdAt).toLocaleDateString('ko-KR')));
        const remove=btn('삭제',()=>{remove.hidden=true;confirm.hidden=false;},'text-button');
        const confirm=el('div',null,'delete-confirm');confirm.hidden=true;confirm.append(el('p','이 사진을 삭제할까요? 마지막 사진이면 저장은 유지되고 방문색이 사라집니다.'));
        const cancel=btn('취소',()=>{confirm.hidden=true;remove.hidden=false;});
        const yes=btn('사진 삭제',async()=>{yes.disabled=cancel.disabled=true;try{await deleteVisit(r.id);changed();await refreshRecords();toast('사진을 삭제했습니다.');if(version===galleryVersion)openGallery();}catch(e){toast(e.message);yes.disabled=cancel.disabled=false;}});
        confirm.append(cancel,yes);card.append(remove,confirm);list.append(card);
      }
      cursor=page.next;status.textContent=list.children.length?'':'아직 등록한 방문 사진이 없습니다.';more.textContent='더 보기';more.hidden=!cursor;
    }catch(e){if(version===galleryVersion){status.textContent=e.message;more.textContent='다시 시도';more.hidden=false;}}
    finally{busy=false;more.disabled=false;}
  }
  await loadMore();
}
$('#my-photos').onclick=openGallery;
function intro(){const splash=$('#splash');splash.hidden=false;splash.classList.remove('playing');void splash.offsetWidth;splash.classList.add('playing');clearTimeout(intro.timer);intro.timer=setTimeout(()=>splash.hidden=true,matchMedia('(prefers-reduced-motion: reduce)').matches?100:2400);}
intro();route();
// Personal storage never holds up the official catalogue or map.
const personalReady=(async()=>{try{records=new Map((await allRecords()).map(r=>[r.placeId,r]));storageReady=true;renderSaved();updateSaveButtons();if(currentDetail)renderDetail(currentDetail);await updatePhotoCount();}catch(e){toast(e.message);}})();
engine=await import('./app.mjs');
await engine.ready;
if(!places.length)$('#home-status').textContent='공간을 불러오지 못했거나 등록된 공간이 없습니다. 새로고침해 다시 확인해주세요.';
renderSaved();
