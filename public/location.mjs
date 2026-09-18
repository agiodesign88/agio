export function currentPosition(geolocation){
  return new Promise((resolve,reject)=>{
    if(!geolocation)return reject(new Error('이 브라우저에서는 위치를 확인할 수 없습니다. 출발지를 직접 입력해주세요.'));
    geolocation.getCurrentPosition(position=>{
      const {latitude,longitude,accuracy}=position.coords;
      if(!Number.isFinite(latitude)||!Number.isFinite(longitude))return reject(new Error('위치를 확인하지 못했습니다. 다시 시도해주세요.'));
      resolve({latitude,longitude,accuracy});
    },error=>reject(new Error({
      1:'위치 권한이 꺼져 있습니다. 브라우저의 사이트 설정에서 위치를 허용한 뒤 다시 시도해주세요.',
      2:'현재 위치를 찾지 못했습니다. 기기의 위치 서비스를 확인해주세요.',
      3:'위치 확인 시간이 초과됐습니다. 다시 시도해주세요.'
    }[error.code]||'현재 위치를 확인하지 못했습니다. 다시 시도해주세요.')),
    {enableHighAccuracy:true,timeout:15000,maximumAge:30000});
  });
}

// Anchor stationary fixes so small GPS jitter does not invalidate the address.
export function stablePosition(previous,coords,now=Date.now()){
  const dx=(coords.longitude-(previous?.longitude??coords.longitude))*111320*Math.cos(coords.latitude*Math.PI/180);
  const dy=(coords.latitude-(previous?.latitude??coords.latitude))*111320;
  const improved=previous&&coords.accuracy<previous.accuracy/2;
  if(previous&&Math.hypot(dx,dy)<30&&!improved)return {...previous,receivedAt:now};
  return {latitude:coords.latitude,longitude:coords.longitude,accuracy:coords.accuracy,receivedAt:now};
}
export function createAddressCache(lookup){
  const entries=new Map();
  return coords=>{
    const key=coords.latitude+','+coords.longitude;
    if(entries.has(key))return entries.get(key);
    const pending=Promise.resolve().then(()=>lookup(coords)).then(result=>{if(!result.address?.trim())throw new Error('주소 없음');return result;}).catch(error=>{entries.delete(key);throw error;});
    entries.set(key,pending);
    if(entries.size>20)entries.delete(entries.keys().next().value);
    return pending;
  };
}
