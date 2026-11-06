// local.js — "Local eyes": videos from people near an event, not national TV.
(function(){
// Channels whose name looks like a TV station or national outlet get pushed to the bottom.
const NEWSY=/\b(news|tv|television|abc|cbs|nbc|fox|cnn|msnbc|reuters|associated press|ap archive|bbc|telemundo|univision)\b/i;
const CALL_SIGN=/\b[KW][A-Z]{2,3}\b/; // US TV/radio call letters, e.g. WPXI, KTLA
const BIG_SUBS=100000;

// Free OpenStreetMap lookup: turns a place name into lat/lng so the map search works without coordinates. No API quota used.
async function geocode(place){
  try{const u='https://nominatim.openstreetmap.org/search?format=json&limit=1&q='+encodeURIComponent(place);
    const j=await (await fetch(u,{headers:{'Accept':'application/json','Accept-Language':'en','User-Agent':'YouTubeFinder/1.0 (https://github.com/TawattThot/youtube-finder; personal use)'}})).json();
    if(j&&j[0]) return {lat:+j[0].lat,lng:+j[0].lon,label:j[0].display_name};}catch(e){}
  return null;}

/**
 * @param {{place?:string,lat?:number,lng?:number,radiusMiles:number,since?:string,keywords?:string}} p
 * @returns {Promise<Array>} videos, best local candidates first. Each gets .geo (true if found by map search) and .newsy.
 */
async function findLocalVideos(p){
  // Default window: last 48 hours, since this is for breaking events.
  const after=p.since?new Date(p.since).toISOString():new Date(Date.now()-48*36e5).toISOString();
  const kw=(p.keywords||'').trim(); const items=[]; const seen=new Set(); const geoIds=new Set();
  const add=(list,geo)=>list.forEach(i=>{const id=i.id&&i.id.videoId;if(id&&!seen.has(id)){seen.add(id);items.push(i);if(geo)geoIds.add(id);}});
  let lat=p.lat,lng=p.lng;
  if(!(Number.isFinite(lat)&&Number.isFinite(lng))&&p.place){const g=await geocode(p.place);if(g){lat=g.lat;lng=g.lng;}}
  // 1) Map search: only finds uploads people tagged with a location, but those are the most trustworthy.
  if(Number.isFinite(lat)&&Number.isFinite(lng)){
    const km=Math.min(1000,Math.max(1,(p.radiusMiles||25)*1.609));
    const j=await YT.call('search',{part:'snippet',type:'video',maxResults:50,order:'date',q:kw,
      location:`${lat},${lng}`,locationRadius:km.toFixed(0)+'km',publishedAfter:after});add(j.items||[],true);}
  // 2) Town-name search, worded the way locals title phone videos.
  if(p.place){const town=p.place.split(',')[0].trim();
    const q=`${town} ${kw}`.replace(/\s+/g,' ').trim();
    const j=await YT.call('search',{part:'snippet',type:'video',maxResults:50,order:'date',q,publishedAfter:after});add(j.items||[],false);}
  const vids=await YT.enrich(items);
  vids.forEach(v=>{v.geo=geoIds.has(v.id);v.newsy=NEWSY.test(v.channel)||CALL_SIGN.test(v.channel)||(v.subs!=null&&v.subs>=BIG_SUBS);});
  // Rank: tagged-on-map first, then small/personal channels, then newest. TV/news channels go last.
  const score=v=>(v.newsy?0:4)+(v.geo?2:0)+(v.subs!=null&&v.subs<10000?1:0);
  return vids.sort((a,b)=>score(b)-score(a)||new Date(b.published)-new Date(a.published));
}
window.Local={findLocalVideos,geocode};
})();
