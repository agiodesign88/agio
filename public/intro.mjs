import {editorialStyle} from './editorial-style.mjs';

// Verified address: 서울 서초구 효령로46길 22.
const headquarters=[127.008712209045,37.4825689372975];
// Deep mineral tones, warm neutrals and restrained accents; no repeated colors.
// Pure black is reserved for the final headquarters pin.
const palette=[
 '#727743','#542f3c','#ded8c7','#344b55','#b6ad72','#45443e','#ae725a','#a8b6ac',
 '#444f3e','#c6b8a3','#64536b','#d3c99d','#36605b','#967c64','#a5a548','#313d4a',
 '#b99f98','#7d473c','#c2c7b5','#6b756e','#9b8750','#4e636d','#e4dbc5','#775966',
 '#999f85','#354a42','#c4976d','#7d858a','#aaa08c','#665f39','#d3bda7','#856443',
 '#79898b','#926f73','#c7bf88','#535d68','#a48b79','#8f9560','#bec4c2','#626857',
 '#b28c54','#506b63','#d5c8bc','#817087'
];

// Opening pins mirror the catalog; the first initial is Q for this intro.
const openingPins=[
  {
    "name": "ABP.LOUNGE",
    "color": "#e2ebe6",
    "letter": "Q"
  },
  {
    "name": "FRITZ HANSEN",
    "color": "#c6ceb7",
    "letter": "F"
  },
  {
    "name": "MIRAE BUILDING",
    "color": "#f6f7e7",
    "letter": "M"
  },
  {
    "name": "BONSTAR",
    "color": "#e7e7e7",
    "letter": "B"
  },
  {
    "name": "CENTRE POMPIDOU",
    "color": "#5f5f5f",
    "letter": "C"
  },
  {
    "name": "THE HANDSOME HAUS",
    "color": "#91bf9a",
    "letter": "T"
  },
  {
    "name": "MAHA HANNAM",
    "color": "#212116",
    "letter": "M"
  },
  {
    "name": "CCCS",
    "color": "#aac94a",
    "letter": "C"
  },
  {
    "name": "PDF SEOUL",
    "color": "#881938",
    "letter": "P"
  },
  {
    "name": "LCO",
    "color": "#f6ffc6",
    "letter": "L"
  },
  {
    "name": "MONGTAN AEWOL",
    "color": "#040033",
    "letter": "M"
  },
  {
    "name": "SUJIPMIHAK",
    "color": "#d6d5c1",
    "letter": "S"
  }
];
const openingColors=new Set(openingPins.map(p=>p.color.toLowerCase()));
const introPins=[...openingPins,...palette.filter(color=>!openingColors.has(color.toLowerCase())).map((color,i)=>({color,letter:String.fromCharCode(65+(i*7)%26)}))].slice(0,20);

export function playIntro(splash){
  splash.hidden=false;
  splash.classList.remove('playing');
  splash.classList.add('map-intro');
  const world=document.createElement('div');world.className='intro-world';
  const surface=document.createElement('div');surface.className='intro-map';
  const pins=document.createElement('div');pins.className='intro-pins';
  world.append(surface,pins);splash.prepend(world);
  const timers=[];let map,done=false,started=false,strokeFrame=0;
  const later=(fn,ms)=>timers.push(setTimeout(()=>{if(!done)fn();},ms));
  function finish(){
    if(done)return;done=true;timers.forEach(clearTimeout);cancelAnimationFrame(strokeFrame);
    splash.hidden=true;map?.remove();world.remove();
    splash.removeEventListener('click',skip,true);
    window.removeEventListener('pagehide',finish);
  }
  function skip(event){event.preventDefault();event.stopPropagation();finish();}
  splash.addEventListener('click',skip,true);
  window.addEventListener('pagehide',finish,{once:true});
  function logoOnly(){splash.classList.add('ink-filled','logo-visible');later(finish,1500);}
  if(matchMedia('(prefers-reduced-motion: reduce)').matches||!window.maplibregl){logoOnly();return;}
  const entries=[];
  function position(){
    for(const {node,coords} of entries){const p=node.classList.contains('intro-final')?{x:surface.clientWidth/2,y:surface.clientHeight/2+1.75}:map.project(coords);node.style.left=p.x+'px';node.style.top=p.y+'px';}
  }

  function pin(coords,color,letter,delay,final=false){
    const node=document.createElement('div');node.className='intro-pin'+(final?' intro-final':'');
    node.style.setProperty('--pin-color',color);node.style.setProperty('--pop-delay',delay+'ms');
    const shape=document.createElement('span');shape.className='pin-shape';shape.style.setProperty('--pin-color',color);
    const head=document.createElement('i');head.textContent=letter;
    const rgb=color.slice(1).match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
    head.style.color=rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722>.179?'#171717':'#fff';
    shape.append(head,document.createElement('span'),document.createElement('em'));node.append(shape);
    pins.append(node);entries.push({node,coords});position();return node;
  }
  function start(){
    if(started||done)return;started=true;
    // Decorative intro locations, distributed across the visible Seoul map.
    let seed=22;const random=()=>{seed=(seed*16807)%2147483647;return (seed-1)/2147483646;};
    const w=surface.clientWidth,h=surface.clientHeight;
    // Centre the ground contact of the AGIO pin.
    map.easeTo({center:headquarters,offset:[0,0],duration:0});
    // Let the first few pops breathe, then build into a quick succession.
    const opening=[350,1550,2500,3250,3800];
    const pinDelays=introPins.map((_,i)=>Math.round(.52*(i<opening.length?opening[i]:3800+400*(1-.8**(i-4))/.2+18*(i-4))));
    const blackPinAt=pinDelays.at(-1)+350;
    const placed=[];
    const waterLayers=map.getStyle().layers.filter(layer=>
      ['fill','line'].includes(layer.type)&&['water','waterway'].includes(layer['source-layer'])
    ).map(layer=>layer.id);
    const isDry=(x,y)=>!waterLayers.length||map.queryRenderedFeatures(
      [[x-8,y-8],[x+8,y+8]],{layers:waterLayers}
    ).length===0;
    function landPosition(x,y){
      if(isDry(x,y))return {x,y};
      // Relocate only water hits, keeping the existing irregular composition intact.
      for(let radius=12;radius<Math.hypot(w,h);radius+=12){
        for(let step=0;step<24;step++){
          const angle=step*Math.PI/12,nx=x+Math.cos(angle)*radius,ny=y+Math.sin(angle)*radius;
          if(nx<25||nx>w-25||ny<90||ny>h-30)continue;
          if(Math.hypot(nx-w/2,ny-h/2)<=55||placed.some(p=>Math.hypot(nx-p.x,ny-p.y)<=32))continue;
          if(isDry(nx,ny))return {x:nx,y:ny};
        }
      }
      return null; // Never fall back to placing a pin in water.
    }
    const pockets=[[.27,.33],[.68,.4],[.43,.72],[.78,.78],[.19,.61]];
    for(let i=0;i<introPins.length;i++){
      // Leave the centre for AGIO; the opening Q sits slightly above and to the left.
      let x=w*.38,y=h*.43+62;
      if(i>0){
        for(let attempt=0;attempt<100;attempt++){
          const pocket=pockets[Math.floor(random()*pockets.length)];
          const scattered=random()<.3;
          x=w*(scattered ? .06+random()*.88 : pocket[0]+(random()+random()-1)*.22);
          y=h*(scattered ? .16+random()*.74 : pocket[1]+(random()+random()-1)*.2);
          x=Math.max(25,Math.min(w-25,x));y=Math.max(90,Math.min(h-30,y));
          if(Math.hypot(x-w/2,y-h/2)>55&&placed.every(p=>Math.hypot(x-p.x,y-p.y)>32))break;
        }
      }
      const land=landPosition(x,y);
      if(!land)continue;
      ({x,y}=land);
      placed.push({x,y});
      const item=introPins[i];
      const coords=map.unproject([x,y]).toArray();
      const node=pin(coords,item.color,item.letter,pinDelays[i]);
      if(item.name)node.title=item.name;
    }
    later(()=>{
      const agioPin=pin(headquarters,'#050505','A',0,true);
      agioPin.title='AGIO';
      later(()=>{
        const p={x:surface.clientWidth/2,y:surface.clientHeight/2+1.75},headY=p.y-62;
        agioPin.querySelector('i').animate([{color:'#fff'},{color:'transparent'}],{duration:450,fill:'forwards'});
        // Approach the final pin by enlarging the map and markers as one scene.
        const scale=Math.ceil(Math.hypot(w,h)/14)+2;
        world.style.transformOrigin=p.x+'px '+headY+'px';
        const approach=world.animate([
          {transform:'translate(0,0) scale(1)'},
          {transform:'translate(0,'+(surface.clientHeight/2-headY)+'px) scale('+scale+')'}
        ],{duration:1800,easing:'cubic-bezier(.65,0,.35,1)',fill:'forwards'});
        // Counter-scale only each stem's width; keep the existing camera motion intact.
        const keepStrokesThin=()=>{
          if(done)return;
          const progress=approach.effect.getComputedTiming().progress??0;
          world.style.setProperty('--stem-inverse-scale',1/(1+(scale-1)*progress));
          if(approach.playState!=='finished')strokeFrame=requestAnimationFrame(keepStrokesThin);
        };
        keepStrokesThin();
        map.easeTo({center:headquarters,offset:[0,0],zoom:map.getZoom()+1.8,duration:1800});
        later(()=>splash.classList.add('ink-filled'),1800);
      },550);
    },blackPinAt);
    later(()=>splash.classList.add('logo-visible'),blackPinAt+2450);
    later(()=>splash.classList.add('intro-leaving'),blackPinAt+4200);
    later(finish,blackPinAt+4750);
  }
  try{
    map=new maplibregl.Map({container:surface,style:editorialStyle(),center:headquarters,
      zoom:surface.clientWidth<600?11.3:11.95,interactive:false,attributionControl:false,pitch:0,bearing:0});
    map.addControl(new maplibregl.AttributionControl({compact:true}),'bottom-left');
    map.on('move',position);map.once('load',start);
    // A slow map connection must never trap the visitor behind the intro.
    later(()=>{if(!started){started=true;logoOnly();}},6500);
  }catch{logoOnly();}
}
