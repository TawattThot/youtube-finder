// local.js — "Local eyes" module. Owner: Ctrl+Z. Basic version; refine freely.
(function(){
/**
 * Find videos from locals near an event.
 * @param {Object} p
 * @param {string} [p.place]   place name, e.g. "Kensington, Philadelphia"
 * @param {number} [p.lat]     latitude (with lng enables geo search)
 * @param {number} [p.lng]
 * @param {number} p.radiusMiles  search radius (API max 1000 km)
 * @param {string} [p.since]   ISO date/time; only uploads after this
 * @param {string} [p.keywords]
 * @returns {Promise<Array>} enriched videos (api.js shape), geo results first, de-duplicated
 */
async function findLocalVideos(p){
  const after=p.since?new Date(p.since).toISOString():undefined;
  const kw=(p.keywords||'').trim(); const items=[]; const seen=new Set();
  const add=list=>list.forEach(i=>{const id=i.id&&i.id.videoId;if(id&&!seen.has(id)){seen.add(id);items.push(i);}});
  if(Number.isFinite(p.lat)&&Number.isFinite(p.lng)){
    const km=Math.min(1000,Math.max(1,p.radiusMiles*1.609));
    const j=await YT.call('search',{part:'snippet',type:'video',maxResults:50,order:'date',q:kw,
      location:`${p.lat},${p.lng}`,locationRadius:km.toFixed(0)+'km',publishedAfter:after});add(j.items||[]);}
  if(p.place){const j=await YT.call('search',{part:'snippet',type:'video',maxResults:50,order:'date',
      q:`${p.place} ${kw} footage`.replace(/\s+/g,' ').trim(),publishedAfter:after});add(j.items||[]);}
  const vids=await YT.enrich(items); const order=new Map(items.map((i,n)=>[i.id.videoId,n]));
  return vids.sort((a,b)=>order.get(a.id)-order.get(b.id));
}
window.Local={findLocalVideos};
})();
