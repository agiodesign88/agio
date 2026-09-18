export function validatePlace(input) {
  const text = (name, max=400) => {
    const value = input[name] ?? '';
    if (typeof value !== 'string' || value.length > max) throw new Error(`${name}: 값이 너무 길거나 올바르지 않습니다.`);
    return value.trim();
  };
  const name = text('name', 100), address = text('address');
  if (!name || !address) throw new Error('공간 이름과 주소가 필요합니다.');
  const coordinate = (key, max) => {
    if (input[key] === '' || input[key] == null) return null;
    const value = Number(input[key]);
    if (!Number.isFinite(value) || Math.abs(value)>max) throw new Error(`${key}: 좌표를 확인하세요.`);
    return value;
  };
  const lat=coordinate('lat',90), lng=coordinate('lng',180);
  if ((lat==null)!==(lng==null)) throw new Error('위도와 경도를 함께 입력하세요.');
  const color = text('color', 7);
  if (!/^#[a-f0-9]{6}$/i.test(color)) throw new Error('대표색은 #RRGGBB 형식이어야 합니다.');
  if (!['draft','published','closed'].includes(input.status)) throw new Error('공개 상태가 올바르지 않습니다.');
  if (input.status==='published' && lat==null) throw new Error('공개 전 주소의 좌표를 확인하세요.');
  const instagram=text('instagram',100);
  if (instagram && !/^@?[a-zA-Z0-9._]+$/.test(instagram)) throw new Error('인스타그램 계정 이름만 입력하세요.');
  const images=input.images ?? [];
  if (!Array.isArray(images) || images.length>30 || images.some(p=>typeof p!=='string' || !/^\/uploads\/[a-f0-9-]+\.(jpg|png|webp)$/.test(p))) throw new Error('사진 경로를 확인하세요.');
  const order=Number(input.order ?? 0);
  if (!Number.isInteger(order) || order<0 || order>99999) throw new Error('정렬 순서는 0~99999 정수입니다.');
  return {name,address,lat,lng,color,status:input.status,instagram,hours:text('hours'),category:text('category',80),order,images,updatedAt:new Date().toISOString()};
}
