// Stable category colors, independent of cover photos and catalogue ordering.
export const categories=[
 {id:'food',label:'카페·음식점',color:'#A27653',pattern:/카페|커피|cafe|coffee|음식|식당|한식|다이닝|restaurant|dining/i},
 {id:'showroom',label:'쇼룸',color:'#6C8582',pattern:/가구|디자인|쇼룸|showroom|furniture|향수|프래그런스|바디|뷰티|패션|스토어|편집|beauty|fashion|store/i},
 {id:'culture',label:'문화공간',color:'#77739D',pattern:/복합|문화|cultural|미술|전시|갤러리|museum|gallery/i},
 {id:'other',label:'기타',color:'#FFFBBD'}
];
export function placeCategory(place){const category=place.category||'';if(/서점|책|book/i.test(category))return categories.at(-1);return categories.find(c=>c.pattern?.test(category))||categories.at(-1);}
export const savedColor='#B6BABD';
