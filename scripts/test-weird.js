#!/usr/bin/env node
// Sanity tests for Weird filters (no network). Run: node scripts/test-weird.js
const fs=require('fs'); const path=require('path'); const vm=require('vm');
const root=path.join(__dirname,'..');
const ctx={
  window:{},
  localStorage:{_d:{},getItem(k){return this._d[k]||null},setItem(k,v){this._d[k]=String(v);},removeItem(k){delete this._d[k];}},
  YT:{key:()=>'',call:async()=>{throw new Error('no network in tests');}},
  console
};
vm.runInNewContext(fs.readFileSync(path.join(root,'weird.js'),'utf8'),ctx);
// also load filter.js for regression
vm.runInNewContext(fs.readFileSync(path.join(root,'filter.js'),'utf8'),ctx);
const Weird=ctx.window.Weird;
const Filter=ctx.window.Filter;
const T=Weird._test;
let failed=0;
function assert(cond,msg){ if(!cond){ console.error('FAIL',msg); failed++; } else console.log('ok ',msg); }

assert(!Weird.anyOn(Weird.load()), 'defaults all off');
assert(Filter.filterVideos([{views:100,live:'none',seconds:120,subs:10},{views:500,live:'upcoming',seconds:120,subs:10},{views:500,live:'none',seconds:30,subs:10}],{minViews:200,maxViews:2000,minSeconds:61}).length===0
  || Filter.filterVideos([{views:500,live:'none',seconds:120,subs:10}],{minViews:200,maxViews:2000}).length===1, 'base filter still works');

const base=Filter.filterVideos([
  {id:1,views:500,live:'none',seconds:120,subs:10,title:'x'},
  {id:2,views:50,live:'none',seconds:120,subs:10,title:'y'},
  {id:3,views:500,live:'upcoming',seconds:120,subs:10,title:'z'},
],{minViews:200,maxViews:2000});
assert(base.length===1 && base[0].id===1, 'regression: views + upcoming skip');

assert(T.isRaw({title:'IMG_2345'}).ok && T.isRaw({title:'IMG_2345'}).badge==='raw', 'raw camera title');
assert(T.isRaw({title:'PXL_20240101_123456'}).ok, 'raw PXL');
assert(T.isRaw({title:'DJI_0001'}).ok, 'raw DJI');
assert(!T.isRaw({title:'Street protest downtown'}).ok, 'not raw without pattern');
assert(T.isRaw({title:'clip',description:'',tags:[],_hasSnippetDeep:true}).badge==='~raw', 'raw empty desc');

assert(T.isAllLower('hello world'), 'all lower');
assert(T.hasClickbait('SHOCKING footage'), 'clickbait word');
assert(T.hasClickbait('THIS IS ALL CAPS TITLE HERE'), 'clickbait all caps');
assert(!T.hasClickbait('calm street walk'), 'no clickbait');

const vids=[
  {id:'a',title:'IMG_1',published:'2024-01-01T12:00:00Z',channelId:'c'},
  {id:'b',title:'SHOCKING!!! INSANE clip',published:'2024-01-01T12:00:00Z',channelId:'c'},
  {id:'c',title:'quiet ambient forest sounds',description:'natural sound no talking',tags:['ambient'],published:'2024-01-01T12:00:00Z',channelId:'c',_hasSnippetDeep:true,caption:'false'},
  {id:'d',title:'review',description:'use code SAVE20 amzn.to/x',tags:['review'],_hasSnippetDeep:true,published:'2024-01-01T12:00:00Z',channelId:'c'},
  {id:'e',title:'review',description:'no links here, just a normal longer description for the video page.',tags:['review'],_hasSnippetDeep:true,published:'2024-01-01T12:00:00Z',channelId:'c'},
];

let s=Object.assign({},T.defaults,{raw:true});
assert(Weird.apply(vids.map(v=>({...v})),s).every(v=>v.id==='a'), 'raw keeps only camera title');

s=Object.assign({},T.defaults,{unpolished:true});
const up=Weird.apply(vids.map(v=>({...v})),s);
assert(up.every(v=>v.id!=='b'), 'unpolished drops clickbait');

s=Object.assign({},T.defaults,{silent:true});
assert(Weird.apply(vids.map(v=>({...v})),s).some(v=>v.id==='c'&&v.badges.includes('~silent')), 'silent matches ambient');

s=Object.assign({},T.defaults,{zeroAd:true});
const za=Weird.apply(vids.map(v=>({...v})),s);
assert(za.some(v=>v.id==='e')&&za.every(v=>v.id!=='d'), 'zero-ad drops sponsor desc');

s=Object.assign({},T.defaults,{fast:true,fastHours:3,eventTime:'2024-01-01T10:00:00Z'});
const fa=Weird.apply(vids.map(v=>({...v})),s,{eventTime:'2024-01-01T10:00:00Z'});
assert(fa.length===vids.length, 'fast upload keeps videos within window');

s=Object.assign({},T.defaults,{fast:true,fastHours:1,eventTime:'2024-01-01T08:00:00Z'});
assert(Weird.apply(vids.map(v=>({...v})),s,{eventTime:'2024-01-01T08:00:00Z'}).length===0, 'fast upload drops outside window');

s=Object.assign({},T.defaults,{first:true,firstN:1});
const withCount=vids.map(v=>({...v,channelVideoCount:v.id==='a'?1:50}));
assert(Weird.apply(withCount,s).every(v=>v.id==='a'), 'first upload by videoCount');

s=Object.assign({},T.defaults,{dead:true,deadYears:2});
const now=Date.now();
const deadVids=[
  {id:'old',title:'x',channelLatestUpload:new Date(now-3*365*864e5).toISOString()},
  {id:'new',title:'x',channelLatestUpload:new Date(now-30*864e5).toISOString()},
];
const dd=Weird.apply(deadVids,s);
assert(dd.length===1&&dd[0].id==='old'&&dd[0].badges.includes('dead channel'), 'dead channel');

s=Object.assign({},T.defaults,{langMismatch:true});
const langVids=[
  {id:'es',title:'El incendio en la calle principal'},
  {id:'en',title:'The fire on the main street today'},
];
const lm=Weird.apply(langVids.map(v=>({...v})),s,{expectedLang:'en'});
assert(lm.some(v=>v.id==='es')&&lm.every(v=>v.id!=='en'), 'lang mismatch keeps non-en');

// filters off = passthrough with empty badges
const passthrough=Weird.apply(vids.map(v=>({...v})),T.defaults);
assert(passthrough.length===vids.length, 'all filters off keeps all');

if(failed){ console.error('\n'+failed+' failed'); process.exit(1); }
console.log('\nAll weird filter sanity tests passed.');
