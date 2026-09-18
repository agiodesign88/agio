import sourceStyle from './map-style.mjs';

// Flat, restrained cartography. Source attribution remains in sourceStyle.
export function editorialStyle(){
  const style=structuredClone(sourceStyle);
  style.name='AGIO / Editorial';
  style.layers=style.layers.filter(layer=>layer.type!=='fill-extrusion'
    && !/hatching|pattern|boundary|park_outline/.test(layer.id));
  for(const layer of style.layers){
    const id=layer.id;
    if(layer.type==='background')layer.paint={'background-color':'#fafafa'};
    if(layer.type==='fill'){
      const color=id==='building'?'#e8e8e8':id==='water'?'#eeeeee':id.includes('aeroway')?'#f4f4f4':'#f7f7f7';
      layer.paint={'fill-color':color,'fill-opacity':1,'fill-antialias':true};
      if(id==='building'){
        layer.minzoom=14;delete layer.maxzoom;delete layer.filter;
        layer.paint['fill-outline-color']='#d4d4d4';
      }
    }
    if(layer.type==='line'){
      const casing=id.endsWith('_casing');
      const rail=id.includes('rail');
      const major=/motorway|trunk|primary/.test(id);
      const minor=/service|track|path|link/.test(id);
      const width=rail?.6:major?4:minor?1.2:2.4;
      layer.paint={
        'line-color':rail?'#cccccc':casing?'#d8d8d8':id.includes('waterway')?'#dddddd':'#ffffff',
        'line-width':['interpolate',['linear'],['zoom'],11,rail?.25:major?.7:.2,14,width+(casing?.7:0),17,width*3+(casing?1:0),20,width*7+(casing?1:0)],
        'line-opacity':id.startsWith('tunnel')?.45:1
      };
      layer.layout={...layer.layout,'line-cap':'round','line-join':'round'};
    }
    if(id==='agio-stations'){
      layer.layout['text-field']=['coalesce',['get','name:en'],['get','name:latin'],['get','name']];
      layer.layout['text-size']=['interpolate',['linear'],['zoom'],12,10,16,12,19,13];
      layer.layout['text-letter-spacing']=.04;
      layer.paint={'text-color':'#555555','text-halo-color':'#fafafa','text-halo-width':1.5};
    }
  }
  return style;
}
