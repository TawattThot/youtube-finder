// local.js — "Local eyes": videos from people near an event, not national TV.
(function(){
const NEWSY=/\b(news|tv|television|abc|cbs|nbc|fox|cnn|msnbc|reuters|associated press|ap archive|bbc|telemundo|univision)\b/i;
const CALL_SIGN=/\b[KW][A-Z]{2,3}\b/;
const BIG_SUBS=100000;

async function geocode(place){
  try{const u='https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=1&q='+encodeURIComponent(place);
    const j=await (await fetch(u,{headers:{'Accept':'application/json','Accept-Language':'en'}})).json();
    if(j&&j[0]){const a=j[0].address||{};const cc=a.country_code||null;
      return {lat:+j[0].lat,lng:+j[0].lon,label:j[0].display_name,countryCode:cc?String(cc).toUpperCase():null};}}catch(e){}
  return null;}

function mark(vids,geoIds){
  vids.forEach(v=>{v.geo=!!(geoIds&&geoIds.has(v.id));
    v.newsy=NEWSY.test(v.channel)||CALL_SIGN.test(v.channel)||(v.subs!=null&&v.subs>=BIG_SUBS);});
  const score=v=>(v.newsy?0:4)+(v.geo?2:0)+(v.subs!=null&&v.subs<10000?1:0);
  return vids.sort((a,b)=>score(b)-score(a)||new Date(b.published)-new Date(a.published));
}

async function findLocalGoogle(p,after){
  const kw=(p.keywords||'').trim(); const items=[]; const seen=new Set(); const geoIds=new Set();
  const add=(list,geo)=>list.forEach(i=>{const id=i.id&&i.id.videoId;if(id&&!seen.has(id)){seen.add(id);items.push(i);if(geo)geoIds.add(id);}});
  let lat=p.lat,lng=p.lng;
  if(!(Number.isFinite(lat)&&Number.isFinite(lng))&&p.place){const g=await geocode(p.place);if(g){lat=g.lat;lng=g.lng;}}
  if(Number.isFinite(lat)&&Number.isFinite(lng)){
    const km=Math.min(1000,Math.max(1,(p.radiusMiles||25)*1.609));
    const j=await YT.call('search',{part:'snippet',type:'video',maxResults:50,order:'date',q:kw,
      location:`${lat},${lng}`,locationRadius:km.toFixed(0)+'km',publishedAfter:after});add(j.items||[],true);}
  if(p.place){const town=p.place.split(',')[0].trim();
    const q=`${town} ${kw}`.replace(/\s+/g,' ').trim();
    const j=await YT.call('search',{part:'snippet',type:'video',maxResults:50,order:'date',q,publishedAfter:after});add(j.items||[],false);}
  const vids=await YT.enrich(items);
  return {videos:mark(vids,geoIds),source:'Google YouTube API'};
}

async function findLocalMirrors(p,after){
  const kw=(p.keywords||'').trim();
  const town=(p.place||'').split(',')[0].trim();
  if(!town&&!kw) throw new Error('Enter a place name or keywords.');
  // Two passes: place+keywords, and place+"footage" (skip duplicate if no place).
  const queries=[];
  if(town) queries.push(`${town} ${kw}`.replace(/\s+/g,' ').trim());
  if(town) queries.push(`${town} ${kw} footage`.replace(/\s+/g,' ').trim());
  if(!town&&kw) queries.push(kw);
  const seen=new Set(); let all=[]; let source='';
  for(const q of queries){
    try{
      const {videos,source:src}=await Mirrors.searchText(q,{pages:1});
      source=source||src;
      videos.forEach(v=>{if(!seen.has(v.id)){seen.add(v.id);all.push(v);}});
    }catch(e){/* try next query */}
  }
  if(!all.length) throw new Mirrors.MirrorError('Free mirrors returned no local videos. Try again, or add a Google API key for map-radius search.');
  const cut=Date.parse(after);
  all=all.filter(v=>v.published&&Date.parse(v.published)>=cut);
  return {videos:mark(all,null),source};
}

/**
 * @param {{place?:string,lat?:number,lng?:number,radiusMiles:number,since?:string,keywords?:string}} p
 * @returns {Promise<{videos:Array,source:string}>}
 */
async function findLocalVideos(p){
  const after=p.since?new Date(p.since).toISOString():new Date(Date.now()-48*36e5).toISOString();
  // Map/radius needs Google. Prefer free mirrors otherwise.
  const wantGeo=Number.isFinite(p.lat)&&Number.isFinite(p.lng);
  if(YT.key()&&(wantGeo||!p.place)){
    try{return await findLocalGoogle(p,after);}catch(e){if(!p.place) throw e;}
  }
  try{return await findLocalMirrors(p,after);}
  catch(e){
    if(YT.key()) return findLocalGoogle(p,after);
    throw e;
  }
}
window.Local={findLocalVideos,geocode};
})();
