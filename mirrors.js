// mirrors.js — key-free search via public Invidious / Piped instances (browser CORS).
// Tries several mirrors with timeouts; caller falls back to Google if a key is set.
(function(){
const ORIGIN_HINT='https://tawattthot.github.io';
// Live instances verified 2026-11-06 with Origin: tawattthot.github.io → ACAO *.
// Piped nextpage was broken on these hosts, so Piped is page-1 only; Invidious paginates with ?page=.
const INSTANCES=[
  {kind:'invidious', base:'https://yt.chocolatemoo53.com', name:'yt.chocolatemoo53.com'},
  {kind:'piped',     base:'https://pipedapi.ducks.party', name:'pipedapi.ducks.party'},
  {kind:'piped',     base:'https://api.piped.private.coffee', name:'api.piped.private.coffee'},
];

const INV_SORT={date:'upload_date',relevance:'relevance',viewCount:'view_count',rating:'rating'};
const INV_DATE={'24h':'today',week:'week',month:'month',year:'year'};

class MirrorError extends Error{constructor(msg){super(msg);}}

async function fetchJson(url,ms){
  const ctrl=new AbortController();
  const t=setTimeout(()=>ctrl.abort(),ms||10000);
  try{
    const r=await fetch(url,{signal:ctrl.signal,headers:{Accept:'application/json'}});
    if(!r.ok) throw new Error('HTTP '+r.status);
    return await r.json();
  }finally{clearTimeout(t);}
}

function thumbInv(v){
  const ts=v.videoThumbnails||[];
  const prefer=['medium','high','sddefault','default'];
  for(const q of prefer){const t=ts.find(x=>x.quality===q);if(t&&t.url)return t.url;}
  return ts[0]&&ts[0].url||'';
}
function mapInv(v){
  return{
    id:v.videoId,title:v.title||'',channel:v.author||'',channelId:v.authorId||'',
    thumb:thumbInv(v),
    published:v.published?new Date(v.published*1000).toISOString():null,
    views:Number(v.viewCount||0),
    seconds:v.lengthSeconds!=null?Number(v.lengthSeconds):null,
    live:v.isUpcoming?'upcoming':(v.liveNow?'live':'none'),
    subs:null};
}
function pipedId(v){
  const u=v.url||''; const m=/[?&]v=([\w-]+)/.exec(u)||/\/([\w-]{11})$/.exec(u);
  return m?m[1]:'';
}
function mapPiped(v){
  const id=pipedId(v);
  return{
    id,title:v.title||'',channel:v.uploaderName||'',channelId:(v.uploaderUrl||'').replace(/^.*\//,''),
    thumb:v.thumbnail||'',
    published:v.uploaded?new Date(v.uploaded).toISOString():null,
    views:Number(v.views||0),
    seconds:v.duration!=null?Number(v.duration):(v.isShort?30:null),
    live:'none',subs:null};
}

async function invPage(inst,q,order,when,page){
  const u=new URL(inst.base+'/api/v1/search');
  u.searchParams.set('q',q); u.searchParams.set('type','video');
  u.searchParams.set('sort_by',INV_SORT[order]||'upload_date');
  if(INV_DATE[when]) u.searchParams.set('date',INV_DATE[when]);
  u.searchParams.set('page',String(page));
  const j=await fetchJson(u.toString(),10000);
  if(!Array.isArray(j)) throw new Error('bad response');
  return j.filter(x=>x&&x.type==='video'&&x.videoId).map(mapInv);
}
async function pipedPage(inst,q){
  const u=new URL(inst.base+'/search');
  u.searchParams.set('q',q); u.searchParams.set('filter','videos');
  const j=await fetchJson(u.toString(),10000);
  const items=(j&&j.items)||[];
  return items.filter(x=>x&&x.type==='stream').map(mapPiped).filter(v=>v.id);
}

/** Try each instance until one returns videos for this page. */
async function pageFromMirrors(q,order,when,page,prefer){
  const orderList=prefer?[prefer,...INSTANCES.filter(i=>i!==prefer)]:INSTANCES.slice();
  // Invidious can do page>1; Piped only page 1.
  const errors=[];
  for(const inst of orderList){
    try{
      if(inst.kind==='piped'&&page>1) continue;
      const vids=inst.kind==='invidious'?await invPage(inst,q,order,when,page):await pipedPage(inst,q);
      // Client-side date cut for Piped (no date param) and as a safety net.
      const after=window.Filter&&Filter.publishedAfter?Filter.publishedAfter(when):undefined;
      const cut=after?Date.parse(after):0;
      const filtered=cut?vids.filter(v=>v.published&&Date.parse(v.published)>=cut):vids;
      if(order==='date') filtered.sort((a,b)=>Date.parse(b.published||0)-Date.parse(a.published||0));
      return {vids:filtered,source:inst.name,inst};
    }catch(e){errors.push(inst.name+': '+(e.message||e));}
  }
  throw new MirrorError('All free mirrors failed'+(errors.length?': '+errors.slice(0,3).join('; '):'.'));
}

/**
 * Low-view search across free mirrors.
 * @returns {{videos:Array, scanned:number, pagesUsed:number, source:string}}
 */
async function searchLow({q,order,when,pages,onProgress}){
  let matches=[], scanned=0, source='', prefer=null, used=0;
  for(let p=1;p<=pages;p++){
    if(onProgress) onProgress(p,pages,source);
    const {vids,source:src,inst}=await pageFromMirrors(q,order||'date',when||'',p,prefer);
    prefer=inst; source=src; used++; scanned+=vids.length;
    // Dedup by id; caller applies Filter.filterVideos.
    const seen=new Set(matches.map(m=>m.id));
    matches=matches.concat(vids.filter(v=>!seen.has(v.id)));
    // Soft stop: if this page returned nothing new, further pages unlikely.
    if(!vids.length) break;
  }
  return {videos:matches,scanned,pagesUsed:used,source};
}

/**
 * Plain text search (one or two pages), used by Local eyes in no-key mode.
 */
async function searchText(q,opts){
  opts=opts||{};
  const pages=opts.pages||1;
  let all=[], source='', prefer=null;
  for(let p=1;p<=pages;p++){
    const {vids,source:src,inst}=await pageFromMirrors(q,'date',opts.when||'',p,prefer);
    prefer=inst; source=src;
    const seen=new Set(all.map(m=>m.id));
    all=all.concat(vids.filter(v=>!seen.has(v.id)));
  }
  return {videos:all,source};
}

window.Mirrors={searchLow,searchText,INSTANCES,MirrorError};
})();
