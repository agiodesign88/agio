import {readFile,access} from 'node:fs/promises';
import path from 'node:path';
const places=JSON.parse(await readFile('data/places.json','utf8'));
for(const p of places){for(const image of p.images||[]){if(!/^\/uploads\/[a-f0-9-]+\.(jpg|png|webp)$/.test(image))throw Error('Invalid image path');await access(path.join('public',image));}}
await access('public/index.html');await access('api/index.mjs');
console.log('Deployment assets verified: '+places.length+' spaces.');
