// filter.js — client-side filtering for Low-view search. Teammates: refine here.
// YouTube's API can't filter by views, so we fetch and filter locally.
(function(){
/**
 * @param {Array<{views:number,subs:number|null}>} videos  enriched videos (see api.js enrich)
 * @param {{minViews?:number,maxViews?:number,maxSubs?:number|null,minSeconds?:number}} opts  minSeconds: drop clips shorter than this (e.g. 61 to skip most Shorts)
 * @returns {Array} videos passing all filters
 */
function filterVideos(videos,opts){
  const min=Number.isFinite(opts.minViews)?opts.minViews:0, max=Number.isFinite(opts.maxViews)?opts.maxViews:Infinity;
  return videos.filter(v=>{
    if(v.live==='upcoming') return false; // scheduled premieres/streams always show 0 views
    if(v.views<min||v.views>max) return false;
    if(Number.isFinite(opts.minSeconds)&&v.seconds!=null&&v.seconds<opts.minSeconds) return false;
    if(opts.maxSubs!=null&&Number.isFinite(opts.maxSubs)){ if(v.subs==null||v.subs>opts.maxSubs) return false; }
    return true;});
}
/** Converts a date-window key (24h/week/month/year) to an RFC3339 publishedAfter, or undefined. */
function publishedAfter(win){const d={'24h':1,week:7,month:30,year:365}[win];return d?new Date(Date.now()-d*864e5).toISOString():undefined;}
/** Rough searches-used estimate (in "searches" of ~100 units; daily ~100). */
function estimateSearches(pages){return pages;}
window.Filter={filterVideos,publishedAfter,estimateSearches};
})();
