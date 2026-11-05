(function(){
const $=id=>document.getElementById(id);
document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>{document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active',t===b));
  document.querySelectorAll('.panel').forEach(p=>p.classList.toggle('hidden',p.id!==b.dataset.tab));});
function keyUI(){$('nokey').classList.toggle('hidden',!!YT.key());$('key').value=YT.key();}
$('saveKey').onclick=()=>{localStorage.setItem('ytKey',$('key').value.trim());keyUI();$('keyStatus').textContent='Saved.';};
$('clearKey').onclick=()=>{localStorage.removeItem('ytKey');keyUI();$('keyStatus').textContent='Cleared.';};
keyUI();
function est(){const n=+$('pages').value;$('est').textContent=`Uses about ${Filter.estimateSearches(n)} of your ~100 free searches/day (stops early at 20 matches).`;}
$('pages').onchange=est;est();
function status(el,msg,err){el.textContent=msg;el.classList.toggle('err',!!err);}
const num=v=>v===''?undefined:Number(v);
$('goLow').onclick=async()=>{const st=$('lowStatus'),out=$('lowResults');out.innerHTML='';
  if(!YT.key())return status(st,'Add your API key in Settings first.',true);
  const q=$('q').value.trim(); if(!q)return status(st,'Type something to search.',true);
  const opts={minViews:num($('minV').value),maxViews:num($('maxV').value),maxSubs:num($('maxSubs').value)??null};
  const pages=+$('pages').value; let token, matches=[], scanned=0, used=0;
  try{for(let p=0;p<pages&&matches.length<20;p++){
      status(st,`Scanning page ${p+1} of ${pages}…`);
      const j=await YT.call('search',{part:'snippet',type:'video',maxResults:50,q,order:$('order').value,publishedAfter:Filter.publishedAfter($('when').value),pageToken:token});used++;
      const vids=await YT.enrich(j.items||[]); scanned+=vids.length;
      const seen=new Set(matches.map(m=>m.id)); matches.push(...Filter.filterVideos(vids,opts).filter(v=>!seen.has(v.id)));
      YT.render(out,matches); token=j.nextPageToken; if(!token)break;}
    status(st,`${matches.length} match${matches.length===1?'':'es'} from ${scanned} videos scanned · used ${used} search${used===1?'':'es'}.`);
  }catch(e){status(st,e.message,true);}};
$('myLoc').onclick=()=>{if(!navigator.geolocation)return status($('localStatus'),'Location not available.',true);
  navigator.geolocation.getCurrentPosition(p=>{$('lat').value=p.coords.latitude.toFixed(5);$('lng').value=p.coords.longitude.toFixed(5);},e=>status($('localStatus'),'Location denied: '+e.message,true));};
$('goLocal').onclick=async()=>{const st=$('localStatus'),out=$('localResults');out.innerHTML='';
  if(!YT.key())return status(st,'Add your API key in Settings first.',true);
  const p={place:$('place').value.trim(),lat:num($('lat').value),lng:num($('lng').value),radiusMiles:num($('radius').value)||25,since:$('since').value,keywords:$('kw').value};
  if(!p.place&&!(Number.isFinite(p.lat)&&Number.isFinite(p.lng)))return status(st,'Enter a place name or a location.',true);
  try{status(st,'Searching…');const v=await Local.findLocalVideos(p);YT.render(out,v);status(st,`${v.length} videos found.`);}catch(e){status(st,e.message,true);}};
})();
