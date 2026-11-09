(function(){
const $=id=>document.getElementById(id);
document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>{document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active',t===b));
  document.querySelectorAll('.panel').forEach(p=>p.classList.toggle('hidden',p.id!==b.dataset.tab));});
function keyUI(){$('key').value=YT.key();$('keyStatus').textContent=YT.key()?'Backup key saved on this device.':'No backup key (free mirrors used by default).';}
$('saveKey').onclick=()=>{localStorage.setItem('ytKey',$('key').value.trim());keyUI();};
$('clearKey').onclick=()=>{localStorage.removeItem('ytKey');keyUI();};
keyUI();
document.querySelectorAll('a.ext').forEach(a=>a.addEventListener('click',e=>{if(!window.Capacitor)return;e.preventDefault();YT.openUrl(a.href);}));
function est(){const n=+$('pages').value;$('est').textContent=`Free by default (public Invidious/Piped mirrors). Scans up to ${n} page${n>1?'s':''}, stops early at 20 matches. Google key in Settings is an optional backup.`;}
$('pages').onchange=est;est();
function status(el,msg,err){el.textContent=msg;el.classList.toggle('err',!!err);}
const num=v=>v===''?undefined:Number(v);

$('goLow').onclick=async()=>{const st=$('lowStatus'),out=$('lowResults');out.innerHTML='';
  const q=$('q').value.trim(); if(!q)return status(st,'Type something to search.',true);
  // maxSubs only when Google key present (mirrors don't return subscriber counts).
  const opts={minViews:num($('minV').value),maxViews:num($('maxV').value),
    maxSubs:YT.key()?(num($('maxSubs').value)??null):null,
    minSeconds:$('hideShorts').checked?61:undefined};
  if(!YT.key()&&num($('maxSubs').value)!=null){/* hint only once per run */ }
  const pages=+$('pages').value;
  try{
    status(st,'Searching free mirrors…');
    const res=await YT.searchLow({q,order:$('order').value,when:$('when').value,pages,
      onProgress:(p,n,src)=>status(st,`Scanning page ${p} of ${n}${src?' · '+src:''}…`)});
    const matches=Filter.filterVideos(res.videos,opts).slice(0,20);
    YT.render(out,matches);
    const subNote=!YT.key()&&num($('maxSubs').value)!=null?' · max-subs skipped (needs Google key)':'';
    status(st,`${matches.length} match${matches.length===1?'':'es'} from ${res.scanned} videos · ${res.pagesUsed} page${res.pagesUsed===1?'':'s'} · via ${res.source}${subNote}.`);
  }catch(e){status(st,e.message,true);}};

$('myLoc').onclick=()=>{if(!navigator.geolocation)return status($('localStatus'),'Location not available.',true);
  navigator.geolocation.getCurrentPosition(p=>{$('lat').value=p.coords.latitude.toFixed(5);$('lng').value=p.coords.longitude.toFixed(5);},e=>status($('localStatus'),'Location denied: '+e.message,true));};

$('goLocal').onclick=async()=>{const st=$('localStatus'),out=$('localResults');out.innerHTML='';
  const p={place:$('place').value.trim(),lat:num($('lat').value),lng:num($('lng').value),radiusMiles:num($('radius').value)||25,since:$('since').value,keywords:$('kw').value};
  if(!p.place&&!(Number.isFinite(p.lat)&&Number.isFinite(p.lng)))return status(st,'Enter a place name or a location.',true);
  if(!p.place&&!YT.key())return status(st,'Map-radius search needs a Google API key. Enter a place name to use free search, or add a key in Settings.',true);
  try{
    status(st,'Searching…');
    const {videos,source}=await Local.findLocalVideos(p);
    let v=videos; const hide=$('hideNews')&&$('hideNews').checked; const n=v.filter(x=>x.newsy).length;
    if(hide)v=v.filter(x=>!x.newsy);
    YT.render(out,v);
    const g=v.filter(x=>x.geo).length;
    status(st,`${v.length} videos${g?` · ${g} tagged near the spot`:''}${hide&&n?` · hid ${n} from news/big channels`:''} · via ${source}.`);
  }catch(e){status(st,e.message,true);}};
})();
