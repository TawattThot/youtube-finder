// Shared YouTube Data API v3 helpers. window.YT
(function(){
const BASE='https://www.googleapis.com/youtube/v3/';
function key(){return localStorage.getItem('ytKey')||'';}
class ApiError extends Error{constructor(msg,quota){super(msg);this.quota=quota;}}
async function call(ep,params){
  const k=key(); if(!k) throw new ApiError('No API key set. Add one in Settings.');
  const u=new URL(BASE+ep); Object.entries({...params,key:k}).forEach(([a,b])=>{if(b!==undefined&&b!=='')u.searchParams.set(a,b)});
  const r=await fetch(u); const j=await r.json().catch(()=>({}));
  if(!r.ok){const reason=(j.error&&j.error.errors&&j.error.errors[0]&&j.error.errors[0].reason)||'';
    if(/quota|rateLimit/i.test(reason)) throw new ApiError("Today's free YouTube quota is used up. It resets at midnight Pacific time.",true);
    throw new ApiError('YouTube error: '+((j.error&&j.error.message)||r.status));}
  return j;}
async function batched(ep,ids,part){const out={};const u=[...new Set(ids)];
  for(let i=0;i<u.length;i+=50){const j=await call(ep,{part,id:u.slice(i,i+50).join(','),maxResults:50});(j.items||[]).forEach(x=>out[x.id]=x);}return out;}
function dur(iso){const m=/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(iso||'');return m?((+m[1]||0)*86400+(+m[2]||0)*3600+(+m[3]||0)*60+(+m[4]||0)):null;}
// Enrich search items into flat video objects.
async function enrich(searchItems){
  const ids=searchItems.map(s=>s.id&&s.id.videoId).filter(Boolean); if(!ids.length) return [];
  const vids=await batched('videos',ids,'statistics,snippet,contentDetails');
  const chans=await batched('channels',Object.values(vids).map(v=>v.snippet.channelId),'statistics');
  return Object.values(vids).map(v=>{const c=chans[v.snippet.channelId];const st=c&&c.statistics;return{
    id:v.id,title:v.snippet.title,channel:v.snippet.channelTitle,channelId:v.snippet.channelId,
    thumb:(v.snippet.thumbnails.medium||v.snippet.thumbnails.default||{}).url,published:v.snippet.publishedAt,
    views:Number(v.statistics.viewCount||0),seconds:dur(v.contentDetails&&v.contentDetails.duration),live:v.snippet.liveBroadcastContent||'none',subs:st&&!st.hiddenSubscriberCount?Number(st.subscriberCount||0):null};});}
function ago(iso){const s=(Date.now()-new Date(iso))/1000;const u=[[31536000,'y'],[2592000,'mo'],[86400,'d'],[3600,'h'],[60,'m']];for(const[n,l]of u)if(s>=n)return Math.floor(s/n)+l+' ago';return'just now';}
function esc(s){return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
function render(el,vids){el.innerHTML=vids.map(v=>`<a class="card" href="https://www.youtube.com/watch?v=${v.id}" target="_blank" rel="noopener"><img loading="lazy" src="${esc(v.thumb||'')}" alt=""><div class="b"><h3>${esc(v.title)}</h3><div class="m">${esc(v.channel)}<br>${v.views.toLocaleString()} views · ${v.subs==null?'subs hidden':v.subs.toLocaleString()+' subs'} · ${ago(v.published)}</div></div></a>`).join('');}
window.YT={key,call,enrich,render,ApiError,ago};
})();
