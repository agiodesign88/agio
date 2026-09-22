const valid=p=>p&&Number.isFinite(p.lat)&&Number.isFinite(p.lng)&&Math.abs(p.lat)<=90&&Math.abs(p.lng)<=180;
export function externalMapURLs({destination,query='',mode='transit',appURL='https://agio-tan.vercel.app/'}={}){
 const coords=valid(destination)?`${destination.lat},${destination.lng}`:null;
 const name=query.trim()||'목적지';
 const google=new URL('https://www.google.com/maps/dir/');google.searchParams.set('api','1');google.searchParams.set('destination',coords||name);google.searchParams.set('travelmode',{transit:'transit',walk:'walking',drive:'driving'}[mode]||'transit');
 const naverParams=new URLSearchParams({appname:appURL});let action;
 if(coords){action='route/'+({transit:'public',walk:'walk',drive:'car'}[mode]||'public');naverParams.set('dlat',destination.lat);naverParams.set('dlng',destination.lng);naverParams.set('dname',name);}
 else{action='search';naverParams.set('query',name);}
 return {google:google.href,naver:`nmap://${action}?${naverParams}`,naverWeb:'https://map.naver.com/p/search/'+encodeURIComponent(name),android:`intent://${action}?${naverParams}#Intent;scheme=nmap;package=com.nhn.android.nmap;end`};
}
export function externalMapLinks(getTarget){
 const box=document.createElement('div');box.className='external-maps';
 const note=document.createElement('p');note.textContent='연결이 어렵다면 다른 지도에서 확인하세요. 선택한 목적지가 해당 서비스로 전달됩니다.';box.append(note);
 for(const [key,label] of [['naverWeb','네이버지도'],['google','Google 지도']]){
  const a=document.createElement('a');a.textContent=label;a.target='_blank';a.rel='noopener noreferrer';a.href='#';
  a.onclick=e=>{const target=getTarget();if(!target.query&&!valid(target.destination)){e.preventDefault();note.textContent='먼저 목적지 이름이나 주소를 입력해주세요.';return;}a.href=externalMapURLs(target)[key];};box.append(a);
 }
 if(/Android|iPhone|iPad/i.test(navigator.userAgent)){
  const a=document.createElement('a');a.textContent='네이버 앱 길찾기';a.href='#';
  a.onclick=e=>{const target=getTarget();if(!target.query&&!valid(target.destination)){e.preventDefault();return;}const urls=externalMapURLs(target);a.href=/Android/i.test(navigator.userAgent)?urls.android:urls.naver;};box.append(a);
  const hint=document.createElement('small');hint.textContent='앱이 없다면 위 네이버지도 웹 링크를 이용하세요.';box.append(hint);
 }
 return box;
}
