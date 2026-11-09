(function(){
const $=id=>document.getElementById(id);
document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>{document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active',t===b));
  document.querySelectorAll('.panel').forEach(p=>p.classList.toggle('hidden',p.id!==b.dataset.tab));});
function keyUI(){$('key').value=YT.key();$('keyStatus').textContent=YT.key()?'Backup key saved on this device.':'No backup key (free mirrors used by default).';}
$('saveKey').onclick=()=>{localStorage.setItem('ytKey',$('key').value.trim());keyUI();};
$('clearKey').onclick=()=>{localStorage.removeItem('ytKey');keyUI();};
keyUI();
document.querySelectorAll('a.ext').forEach(a=>a.addEventListener('click',e=>{if(!window.Capacitor)return;e.preventDefault();YT.openUrl(a.href);}));

// Mount Weird filters into both panels
const weirdHTML=Weird.panelHTML();
['weirdLow','weirdLocal'].forEach(id=>{const el=$(id); if(el) el.innerHTML=weirdHTML;});
Weird.bindUI();

function est(){const n=+$('pages').value;$('est').textContent=`Free by default (public Invidious/Piped mirrors). Scans up to ${n} page${n>1?'s':''}, stops early at 20 matches. Google key in Settings is an optional backup.`;}
$('pages').onchange=est;est();
function status(el,msg,err){el.textContent=msg;el.classList.toggle('err',!!err);}
const num=v=>v===''?undefined:Number(v);

function weirdNote(s){
  if(!Weird.anyOn(s)) return '';
  const needKey=Weird.needsChannel(s)||Weird.needsPlaylist(s)||s.zeroAd||s.silent||s.raw;
  if(needKey&&!YT.key()) return ' · some weird filters limited without Google key';
  return '';
}

async function runWeird(videos, extraCtx){
  const s=Weird.load();
  if(!Weird.anyOn(s)) return {videos, weirdApplied:false};
  if(YT.key()&&(Weird.needsDeepVideo(s)||Weird.needsChannel(s)||Weird.needsPlaylist(s))){
    await Weird.deepEnrich(videos,s);
  }
  const ctx=Object.assign({},extraCtx||{},{eventTime:s.eventTime});
  return {videos:Weird.apply(videos,s,ctx), weirdApplied:true};
}

$('goLow').onclick=async()=>{const st=$('lowStatus'),out=$('lowResults');out.innerHTML='';
  const q=$('q').value.trim(); if(!q)return status(st,'Type something to search.',true);
  const opts={minViews:num($('minV').value),maxViews:num($('maxV').value),
    maxSubs:YT.key()?(num($('maxSubs').value)??null):null,
    minSeconds:$('hideShorts').checked?61:undefined};
  const pages=+$('pages').value;
  const ws=Weird.load();
  try{
    status(st,'Searching free mirrors…');
    const res=await YT.searchLow({q,order:$('order').value,when:$('when').value,pages,
      onProgress:(p,n,src)=>status(st,`Scanning page ${p} of ${n}${src?' · '+src:''}…`)});
    let list=Filter.filterVideos(res.videos,opts);
    if(Weird.anyOn(ws)){
      status(st,'Applying weird filters…');
      const r=await runWeird(list,{});
      list=r.videos;
    }
    const matches=list.slice(0,20);
    YT.render(out,matches);
    const subNote=!YT.key()&&num($('maxSubs').value)!=null?' · max-subs skipped (needs Google key)':'';
    status(st,`${matches.length} match${matches.length===1?'':'es'} from ${res.scanned} videos · ${res.pagesUsed} page${res.pagesUsed===1?'':'s'} · via ${res.source}${subNote}${weirdNote(ws)}.`);
  }catch(e){status(st,e.message,true);}};

$('myLoc').onclick=()=>{if(!navigator.geolocation)return status($('localStatus'),'Location not available.',true);
  navigator.geolocation.getCurrentPosition(p=>{$('lat').value=p.coords.latitude.toFixed(5);$('lng').value=p.coords.longitude.toFixed(5);},e=>status($('localStatus'),'Location denied: '+e.message,true));};

$('goLocal').onclick=async()=>{const st=$('localStatus'),out=$('localResults');out.innerHTML='';
  const p={place:$('place').value.trim(),lat:num($('lat').value),lng:num($('lng').value),radiusMiles:num($('radius').value)||25,since:$('since').value,keywords:$('kw').value};
  if(!p.place&&!(Number.isFinite(p.lat)&&Number.isFinite(p.lng)))return status(st,'Enter a place name or a location.',true);
  if(!p.place&&!YT.key())return status(st,'Map-radius search needs a Google API key. Enter a place name to use free search, or add a key in Settings.',true);
  const ws=Weird.load();
  try{
    status(st,'Searching…');
    const {videos,source}=await Local.findLocalVideos(p);
    let v=videos; const hide=$('hideNews')&&$('hideNews').checked; const n=v.filter(x=>x.newsy).length;
    if(hide)v=v.filter(x=>!x.newsy);
    let expectedLang=null;
    if(ws.langMismatch&&p.place){
      try{const g=await Local.geocode(p.place); if(g&&g.countryCode) expectedLang=Weird.countryToLang(g.countryCode);}catch(e){}
    }
    if(Weird.anyOn(ws)){
      status(st,'Applying weird filters…');
      const r=await runWeird(v,{expectedLang,eventTime:ws.eventTime});
      v=r.videos;
    }
    YT.render(out,v);
    const g=v.filter(x=>x.geo).length;
    status(st,`${v.length} videos${g?` · ${g} tagged near the spot`:''}${hide&&n?` · hid ${n} from news/big channels`:''} · via ${source}${weirdNote(ws)}.`);
  }catch(e){status(st,e.message,true);}};
})();
