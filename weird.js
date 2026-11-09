// weird.js — optional "Weird filters" (all off by default). window.Weird
(function(){
const LS='ytWeird';
const chanCache=new Map(); // channelId -> {stats, snippet, contentDetails, latestUpload, uploadsPlaylist}
const playlistOldestCache=new Map(); // channelId -> oldest videoId or null

const RAW_PATTERNS=[
  /\bIMG_\d+/i,/\bVID_\d{8}/i,/\bMOV_\d+/i,/\bDSC\w*\d+/i,/\bPXL_\d+/i,
  /\bGOPR\d+/i,/\bDJI_\d+/i,/\bVideo\s+\d{4}-\d{2}-\d{2}\b/i,
  /\b\d{8}_\d{6}\b/,/\bMy Movie\b/i,/\bUntitled\b/i
];
const AMBIENT=/\b(ambient|no talking|no commentary|raw audio|natural sound|asmr nature|silent|sounds only|no voiceover|no voice over)\b/i;
const CLICKBAIT=new RegExp(String.raw`\b(SHOCKING|INSANE|you won't believe|gone wrong)\b|!!!`,'i');
const EMOJI=/(?:[\uD83C-\uDBFF][\uDC00-\uDFFF]|[\u2600-\u27BF])/;
const SPONSOR=new RegExp(String.raw`\b(amzn\.to|amazon\.com/\S*tag=|bit\.ly|linktr\.ee|patreon|sponsored|use code|affiliate|promo code|#ad\b|paid partnership|merch|discount)\b`,'i');

// country code -> primary language (BCP-47-ish primary subtag)
const COUNTRY_LANG={
  US:'en',GB:'en',AU:'en',CA:'en',NZ:'en',IE:'en',
  MX:'es',ES:'es',AR:'es',CO:'es',CL:'es',PE:'es',VE:'es',
  BR:'pt',PT:'pt',
  FR:'fr',BE:'fr',
  DE:'de',AT:'de',CH:'de',
  IT:'it',NL:'nl',PL:'pl',SE:'sv',NO:'no',DK:'da',FI:'fi',
  RU:'ru',UA:'uk',TR:'tr',GR:'el',IL:'he',SA:'ar',AE:'ar',EG:'ar',
  JP:'ja',KR:'ko',CN:'zh',TW:'zh',HK:'zh',
  IN:'hi',TH:'th',VN:'vi',ID:'id',MY:'ms',PH:'en',
  CZ:'cs',RO:'ro',HU:'hu',SK:'sk'
};

const defaults={
  first:false, firstN:1, firstVerify:false,
  raw:false,
  fast:false, fastHours:6, eventTime:'',
  dead:false, deadYears:2,
  silent:false,
  unpolished:false,
  langMismatch:false,
  zeroAd:false
};

function load(){
  try{return Object.assign({},defaults,JSON.parse(localStorage.getItem(LS)||'{}'));}
  catch(e){return Object.assign({},defaults);}
}
function save(s){localStorage.setItem(LS,JSON.stringify(s));}

function anyOn(s){
  return !!(s.first||s.raw||s.fast||s.dead||s.silent||s.unpolished||s.langMismatch||s.zeroAd);
}
function needsDeepVideo(s){
  return !!(s.silent||s.zeroAd||s.fast||s.langMismatch||s.raw); // raw benefits from description/tags
}
function needsChannel(s){return !!(s.first||s.dead);}
function needsPlaylist(s){return !!(s.dead||(s.first&&s.firstVerify));}

function letterStats(title){
  const letters=(title.match(/[A-Za-z]/g)||[]);
  const upper=letters.filter(c=>c===c.toUpperCase()&&c!==c.toLowerCase()).length;
  return {letters:letters.length, upper, upperRatio:letters.length?upper/letters.length:0};
}
function isAllLower(title){
  const letters=(title.match(/[A-Za-z]/g)||[]);
  return letters.length>=3 && letters.every(c=>c===c.toLowerCase());
}
function hasClickbait(title){
  if(CLICKBAIT.test(title)) return true;
  const {letters,upperRatio}=letterStats(title);
  return letters>=6 && upperRatio>0.5;
}
function rawScore(v){
  let score=0;
  const t=v.title||'';
  if(RAW_PATTERNS.some(re=>re.test(t))) score+=3;
  if(v._hasSnippetDeep){
    const desc=(v.description||'').trim();
    const tags=v.tags||[];
    if(desc.length>0 && desc.length<40) score+=1;
    if(desc.length===0) score+=2;
    if(!tags.length) score+=1;
  }
  return score;
}
function isRaw(v){
  const t=v.title||'';
  if(RAW_PATTERNS.some(re=>re.test(t))) return {ok:true,badge:'raw'};
  if(!v._hasSnippetDeep) return {ok:false};
  const desc=(v.description||'').trim();
  const tags=v.tags;
  if(desc.length<20 && (!tags||!tags.length)) return {ok:true,badge:'~raw'};
  if(rawScore(v)>=3) return {ok:true,badge:'~raw'};
  return {ok:false};
}
function detectLangFromTitle(title){
  const t=title||'';
  if(/[\u3040-\u30ff\u3400-\u9fff]/.test(t)) return /[\u3040-\u30ff]/.test(t)?'ja':'zh';
  if(/[\uac00-\ud7af]/.test(t)) return 'ko';
  if(/[\u0600-\u06ff]/.test(t)) return 'ar';
  if(/[\u0400-\u04ff]/.test(t)) return 'ru';
  if(/[\u0370-\u03ff]/.test(t)) return 'el';
  if(/[\u0900-\u097f]/.test(t)) return 'hi';
  if(/[\u0e00-\u0e7f]/.test(t)) return 'th';
  // light stopword sniff
  const low=' '+t.toLowerCase()+' ';
  if(/\b(el|la|los|las|que|una|por|para|como)\b/.test(low)) return 'es';
  if(/\b(le|les|des|une|pour|avec|dans)\b/.test(low)) return 'fr';
  if(/\b(o|a|os|as|uma|para|com|nao)\b/.test(low)) return 'pt';
  if(/\b(der|die|das|und|mit|fur|nicht)\b/.test(low)) return 'de';
  if(/\b(the|and|for|with|from|this)\b/.test(low)) return 'en';
  return null;
}
function primaryLang(code){
  if(!code) return null;
  return String(code).toLowerCase().split(/[-_]/)[0];
}

async function googleCall(ep,params){
  if(!YT.key()) throw new Error('no key');
  return YT.call(ep,params);
}

async function fetchChannels(ids){
  const need=ids.filter(id=>id&&!chanCache.has(id));
  if(need.length&&YT.key()){
    for(let i=0;i<need.length;i+=50){
      const slice=need.slice(i,i+50);
      const j=await googleCall('channels',{part:'snippet,statistics,contentDetails',id:slice.join(','),maxResults:50});
      (j.items||[]).forEach(c=>{
        const st=c.statistics||{};
        chanCache.set(c.id,{
          videoCount:st.videoCount!=null?Number(st.videoCount):null,
          hiddenSubs:!!st.hiddenSubscriberCount,
          subs:st.hiddenSubscriberCount?null:Number(st.subscriberCount||0),
          uploadsPlaylist:c.contentDetails&&c.contentDetails.relatedPlaylists&&c.contentDetails.relatedPlaylists.uploads||null,
          country:c.snippet&&c.snippet.country||null,
          title:c.snippet&&c.snippet.title||''
        });
      });
      slice.forEach(id=>{if(!chanCache.has(id)) chanCache.set(id,{missing:true});});
    }
  }
  return chanCache;
}

async function latestUploadIso(channelId){
  const ch=chanCache.get(channelId);
  if(!ch||ch.missing||!ch.uploadsPlaylist||!YT.key()) return null;
  if(ch.latestUpload!==undefined) return ch.latestUpload;
  try{
    const j=await googleCall('playlistItems',{part:'contentDetails,snippet',playlistId:ch.uploadsPlaylist,maxResults:1});
    const it=(j.items&&j.items[0])||null;
    const iso=it&&((it.contentDetails&&it.contentDetails.videoPublishedAt)||(it.snippet&&it.snippet.publishedAt))||null;
    ch.latestUpload=iso;
    return iso;
  }catch(e){ch.latestUpload=null;return null;}
}

async function oldestUploadId(channelId){
  if(playlistOldestCache.has(channelId)) return playlistOldestCache.get(channelId);
  const ch=chanCache.get(channelId);
  if(!ch||!ch.uploadsPlaylist||!YT.key()){playlistOldestCache.set(channelId,null);return null;}
  // Walk pages to the end (only for tiny channels videoCount<=3)
  try{
    let token, lastId=null, guard=0;
    do{
      const j=await googleCall('playlistItems',{part:'contentDetails',playlistId:ch.uploadsPlaylist,maxResults:50,pageToken:token});
      const items=j.items||[];
      if(items.length) lastId=items[items.length-1].contentDetails.videoId;
      token=j.nextPageToken; guard++;
    }while(token&&guard<5);
    playlistOldestCache.set(channelId,lastId);
    return lastId;
  }catch(e){playlistOldestCache.set(channelId,null);return null;}
}

/** Deep-enrich video list with Google when a key is present and filters need it. Mutates videos. */
async function deepEnrich(videos,settings){
  if(!videos.length||!YT.key()) return videos;
  const wantDeep=needsDeepVideo(settings)||needsChannel(settings);
  if(!wantDeep) return videos;

  const ids=videos.map(v=>v.id).filter(Boolean);
  const parts=['snippet','statistics','contentDetails'];
  if(settings.fast) parts.push('recordingDetails');
  if(settings.zeroAd) parts.push('paidProductPlacementDetails');
  // unique parts
  const part=[...new Set(parts)].join(',');
  const byId={};
  for(let i=0;i<ids.length;i+=50){
    try{
      const j=await googleCall('videos',{part,id:ids.slice(i,i+50).join(','),maxResults:50});
      (j.items||[]).forEach(x=>byId[x.id]=x);
    }catch(e){/* leave shallow */}
  }
  videos.forEach(v=>{
    const g=byId[v.id]; if(!g) return;
    const sn=g.snippet||{};
    const st=g.statistics||{};
    const cd=g.contentDetails||{};
    const rd=g.recordingDetails||{};
    const pp=g.paidProductPlacementDetails||{};
    v.title=sn.title||v.title;
    v.description=sn.description||'';
    v.tags=sn.tags||[];
    v.published=sn.publishedAt||v.published;
    v.channel=sn.channelTitle||v.channel;
    v.channelId=sn.channelId||v.channelId;
    v.defaultAudioLanguage=sn.defaultAudioLanguage||null;
    v.defaultLanguage=sn.defaultLanguage||null;
    v.live=sn.liveBroadcastContent||v.live||'none';
    v.views=st.viewCount!=null?Number(st.viewCount):v.views;
    v.likes=st.likeCount!=null?Number(st.likeCount):null;
    v.comments=st.commentCount!=null?Number(st.commentCount):null;
    v.caption=cd.caption||null; // 'true'/'false'
    v.recordingDate=rd.recordingDate||null;
    v.hasPaidProductPlacement=pp.hasPaidProductPlacement===true;
    v.lat=rd.location&&rd.location.latitude!=null?rd.location.latitude:(v.lat);
    v.lng=rd.location&&rd.location.longitude!=null?rd.location.longitude:(v.lng);
    v._hasSnippetDeep=true;
  });

  if(needsChannel(settings)){
    await fetchChannels(videos.map(v=>v.channelId).filter(Boolean));
    for(const v of videos){
      const ch=chanCache.get(v.channelId);
      if(ch&&!ch.missing){
        v.channelVideoCount=ch.videoCount;
        if(v.subs==null&&ch.subs!=null) v.subs=ch.subs;
      }
    }
  }
  if(settings.dead){
    // latest upload per unique channel (1 unit each)
    const uniq=[...new Set(videos.map(v=>v.channelId).filter(Boolean))];
    for(const id of uniq){
      const iso=await latestUploadIso(id);
      const ch=chanCache.get(id); if(ch) ch.latestUpload=iso;
    }
    videos.forEach(v=>{
      const ch=chanCache.get(v.channelId);
      v.channelLatestUpload=ch&&ch.latestUpload||null;
    });
  }
  if(settings.first&&settings.firstVerify){
    const candidates=videos.filter(v=>v.channelVideoCount!=null&&v.channelVideoCount<=3);
    const uniq=[...new Set(candidates.map(v=>v.channelId))];
    for(const id of uniq) await oldestUploadId(id);
  }
  return videos;
}

/**
 * Apply weird filters. Mutates each kept video with .badges array.
 * @param {Array} videos
 * @param {object} settings
 * @param {{expectedLang?:string|null, eventTime?:string}} ctx
 */
function apply(videos,settings,ctx){
  ctx=ctx||{};
  const s=settings||load();
  if(!anyOn(s)) return videos.map(v=>{v.badges=v.badges||[];return v;});

  const eventMs=s.fast&&(ctx.eventTime||s.eventTime)?Date.parse(ctx.eventTime||s.eventTime):NaN;
  const fastHours=Number(s.fastHours)||6;
  const expectedLang=primaryLang(ctx.expectedLang)||null;
  const deadCut=s.dead?Date.now()-(Number(s.deadYears)||2)*365.25*864e5:0;
  const firstN=Math.max(1,Number(s.firstN)||1);

  const out=[];
  for(const v of videos){
    const badges=[];
    let keep=true;

    if(s.first){
      const vc=v.channelVideoCount;
      if(vc==null){ /* unknown — keep (no channel data) */ }
      else if(vc>firstN) keep=false;
      else{
        let ok=true;
        if(s.firstVerify&&vc<=3){
          const oldest=playlistOldestCache.get(v.channelId);
          if(oldest&&oldest!==v.id) ok=false;
        }
        if(!ok) keep=false; else badges.push('first upload');
      }
      if(!keep) continue;
    }

    if(s.raw){
      const r=isRaw(v);
      if(!r.ok){keep=false;continue;}
      badges.push(r.badge);
    }

    if(s.fast){
      if(!Number.isFinite(eventMs)){ /* no event time set — skip filter */ }
      else{
        const pubs=[v.published,v.recordingDate].filter(Boolean).map(Date.parse).filter(Number.isFinite);
        const end=eventMs+fastHours*3600e3;
        const hit=pubs.some(t=>t>=eventMs&&t<=end);
        if(!hit){keep=false;continue;}
        badges.push('fast upload');
      }
    }

    if(s.dead){
      const latest=v.channelLatestUpload?Date.parse(v.channelLatestUpload):NaN;
      if(!Number.isFinite(latest)){ /* unknown — keep */ }
      else if(latest>deadCut){keep=false;continue;}
      else badges.push('dead channel');
    }

    if(s.silent){
      const text=((v.title||'')+' '+(v.description||'')+' '+(v.tags||[]).join(' '));
      const byWords=AMBIENT.test(text);
      const byMeta=v._hasSnippetDeep && !v.defaultAudioLanguage && v.caption==='false' && ((v.description||'').trim().length<40);
      if(!(byWords||byMeta)){keep=false;continue;}
      badges.push('~silent');
    }

    if(s.unpolished){
      const t=v.title||'';
      const ok=isAllLower(t)||(!hasClickbait(t)&&!EMOJI.test(t));
      if(!ok){keep=false;continue;}
      badges.push('unpolished');
    }

    if(s.langMismatch){
      if(!expectedLang){ /* no place language — skip */ }
      else{
        const vidLang=primaryLang(v.defaultAudioLanguage||v.defaultLanguage)||detectLangFromTitle(v.title);
        if(!vidLang){ /* unknown — keep with soft badge skip */ }
        else if(vidLang===expectedLang){keep=false;continue;}
        else badges.push('~lang mismatch');
      }
    }

    if(s.zeroAd){
      if(v._hasSnippetDeep){
        const desc=v.description||'';
        if(SPONSOR.test(desc)||v.hasPaidProductPlacement){keep=false;continue;}
        badges.push('zero-ad');
      }else{
        // title-only weak check
        if(SPONSOR.test(v.title||'')){keep=false;continue;}
        badges.push('~zero-ad');
      }
    }

    v.badges=(v.badges||[]).concat(badges);
    out.push(v);
  }
  return out;
}

function readUI(root){
  root=root||document;
  const g=id=>root.querySelector('[data-w="'+id+'"]');
  const chk=id=>{const el=g(id);return el?!!el.checked:false;};
  const val=id=>{const el=g(id);return el?el.value:'';};
  return{
    first:chk('first'), firstN:Number(val('firstN'))||1, firstVerify:chk('firstVerify'),
    raw:chk('raw'),
    fast:chk('fast'), fastHours:Number(val('fastHours'))||6, eventTime:val('eventTime'),
    dead:chk('dead'), deadYears:Number(val('deadYears'))||2,
    silent:chk('silent'),
    unpolished:chk('unpolished'),
    langMismatch:chk('langMismatch'),
    zeroAd:chk('zeroAd')
  };
}
function writeUI(s,root){
  root=root||document;
  const set=(id,v)=>{
    const els=root.querySelectorAll('[data-w="'+id+'"]');
    els.forEach(el=>{
      if(el.type==='checkbox') el.checked=!!v;
      else el.value=v==null?'':v;
    });
  };
  set('first',s.first); set('firstN',s.firstN); set('firstVerify',s.firstVerify);
  set('raw',s.raw);
  set('fast',s.fast); set('fastHours',s.fastHours); set('eventTime',s.eventTime||'');
  set('dead',s.dead); set('deadYears',s.deadYears);
  set('silent',s.silent);
  set('unpolished',s.unpolished);
  set('langMismatch',s.langMismatch);
  set('zeroAd',s.zeroAd);
}
function bindUI(){
  const s=load();
  writeUI(s);
  document.querySelectorAll('[data-w]').forEach(el=>{
    el.addEventListener('change',()=>{
      const next=readUI();
      save(next);
      // sync twin controls in the other panel
      writeUI(next);
    });
  });
}

function countryToLang(cc){return COUNTRY_LANG[(cc||'').toUpperCase()]||null;}

/** HTML snippet for one Weird filters panel (duplicate into low + local). */
function panelHTML(){
  return `<details class="weird">
<summary>Weird filters <span class="hint">(all off)</span></summary>
<p class="hint">Optional oddball filters. ~ = best guess. Some need a Google API key (channel/playlist lookups). No extra search.list calls.</p>
<label class="check"><input type="checkbox" data-w="first"> First upload <span class="tip" title="Channel has <= N videos (cheap). Optional verify via uploads playlist when N<=3.">?</span></label>
<div class="row weird-indent"><label>Max videos on channel<input type="number" data-w="firstN" value="1" min="1" max="20"></label>
<label class="check"><input type="checkbox" data-w="firstVerify"> Verify oldest (<=3 vids, +1 quota/channel)</label></div>
<label class="check"><input type="checkbox" data-w="raw"> Raw footage <span class="tip" title="Camera default titles (IMG_, PXL_, DJI_...) or empty/short description & no tags.">?</span></label>
<label class="check"><input type="checkbox" data-w="fast"> Fast upload <span class="tip" title="Published (or recorded) within X hours after an event time you enter.">?</span></label>
<div class="row weird-indent"><label>Event time<input type="datetime-local" data-w="eventTime"></label>
<label>Within hours<input type="number" data-w="fastHours" value="6" min="1" max="168"></label></div>
<label class="check"><input type="checkbox" data-w="dead"> Dead channel <span class="tip" title="Channel's latest upload older than N years. Uses playlistItems (1 unit/channel). Needs Google key.">?</span></label>
<div class="row weird-indent"><label>Quiet for years<input type="number" data-w="deadYears" value="2" min="1" max="20"></label></div>
<label class="check"><input type="checkbox" data-w="silent"> ~ Silent / no talking <span class="tip" title="Best guess: ambient keywords, or no audio language + no captions + short description.">?</span></label>
<label class="check"><input type="checkbox" data-w="unpolished"> Unpolished titles <span class="tip" title="All-lowercase, or no clickbait / ALL CAPS / emojis.">?</span></label>
<label class="check"><input type="checkbox" data-w="langMismatch"> ~ Language != place <span class="tip" title="Video language (API or title heuristic) differs from Local eyes place country language. Best guess.">?</span></label>
<label class="check"><input type="checkbox" data-w="zeroAd"> Zero-ad <span class="tip" title="No sponsor/affiliate markers in description; no paid product placement flag when API returns it.">?</span></label>
</details>`;
}

window.Weird={
  load,save,anyOn,needsDeepVideo,needsChannel,needsPlaylist,
  deepEnrich,apply,readUI,writeUI,bindUI,panelHTML,countryToLang,
  // exposed for tests
  _test:{isRaw,rawScore,isAllLower,hasClickbait,detectLangFromTitle,RAW_PATTERNS,AMBIENT,SPONSOR,defaults,chanCache,playlistOldestCache}
};
})();
