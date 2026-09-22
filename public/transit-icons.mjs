const paths={
 BUS:'<rect x="5" y="3" width="14" height="16" rx="2"/><path d="M5 11h14M8 19v2m8-2v2"/><circle cx="8" cy="15" r=".6"/><circle cx="16" cy="15" r=".6"/>',
 SUBWAY:'<path d="M5 18V6a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v12H5ZM5 10h14M12 3v7M8 18l-3 4m11-4 3 4M7 20h10"/><circle cx="8" cy="14" r=".7"/><circle cx="16" cy="14" r=".7"/>',
 TRAIN:'<path d="M8 18l-3 4m11-4 3 4M7 20h10M6 10l2-7h8l2 7v7H6zM6 10h12M9 14h6"/>',
 WALKING:'<circle cx="13" cy="4" r="2"/><path d="m9 22 2-7 3 3 1 4M7 12l3-5h3l2 5h4M11 8v7l-5 6"/>',
 CAR:'<path d="m4 9 2-5h12l2 5v10H4zM4 10h16M7 19v3m10-3v3M7 14h1m8 0h1"/>'
};
export const transitLabel=type=>({BUS:'버스',SUBWAY:'지하철',TRAIN:'열차',WALKING:'도보',CAR:'자동차'}[type]||'이동');
export function transitIcon(type){return `<svg viewBox="0 0 24 24" data-transport="${Object.hasOwn(paths,type)?type:'CAR'}" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">${paths[type]||paths.CAR}</svg>`;}
