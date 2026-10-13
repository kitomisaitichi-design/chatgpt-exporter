export const APPEARANCE_KEY='englishExporterAppearance';
export const THEMES=Object.freeze(['midnight','graphite','ocean','forest','plum','paper','sand','contrast']);
export const FOLDS=Object.freeze(['settings','updates','tools','diagnostics']);
export function normalizeAppearance(value){return {theme:THEMES.includes(value?.theme)?value.theme:'midnight',density:value?.density==='compact'?'compact':'comfortable',folds:Object.fromEntries(FOLDS.map(key=>[key,value?.folds?.[key]===true]))};}

// This presentation controller owns only its own storage key and DOM attributes.
// It can run in a read-only dashboard; backup ownership remains in app.mjs.
export async function setupAppearance(document,{storage,changes,cache,onError=()=>{}}){
  const get=id=>document.getElementById(id),root=document.documentElement;
  let mirror={};try{mirror=JSON.parse(cache?.getItem(APPEARANCE_KEY)||'null');}catch{}
  let state=normalizeAppearance(mirror),pending=Promise.resolve(),revision=0,writes=0;
  const radios=[...document.querySelectorAll('input[name="appearance-theme"]')],folds=[...document.querySelectorAll('details[data-appearance-fold]')];
  const status=get('appearance-status'),density=get('appearance-density');
  function render(){root.dataset.theme=state.theme;root.dataset.density=state.density;root.style.colorScheme=['paper','sand'].includes(state.theme)?'light':'dark';for(const radio of radios)radio.checked=radio.value===state.theme;if(density)density.value=state.density;for(const fold of folds)fold.open=state.folds[fold.dataset.appearanceFold]===true;if(status)status.textContent=`${radios.find(r=>r.checked)?.dataset.label||state.theme} · ${state.density==='compact'?'Compact':'Comfortable'} layout. Appearance only; your backup settings stay in place.`;}
  function mirrorState(){try{cache?.setItem(APPEARANCE_KEY,JSON.stringify(state));}catch{/* Chrome storage remains authoritative when the paint mirror is unavailable. */}}
  function save(){revision++;mirrorState();render();const snapshot=structuredClone(state);writes++;pending=pending.then(()=>storage.set({[APPEARANCE_KEY]:snapshot})).catch(e=>{if(status)status.textContent='Applied in this tab; appearance could not be saved: '+(e.message||e);onError(e);}).finally(()=>writes--);return pending;}
  for(const radio of radios)radio.addEventListener('change',()=>{if(radio.checked&&state.theme!==radio.value){state=normalizeAppearance({...state,theme:radio.value});void save();}});
  density?.addEventListener('change',()=>{state=normalizeAppearance({...state,density:density.value});void save();});
  get('appearance-reset')?.addEventListener('click',()=>{state=normalizeAppearance(null);void save();});
  for(const fold of folds)fold.addEventListener('toggle',()=>{const key=fold.dataset.appearanceFold;if(FOLDS.includes(key)&&state.folds[key]!==fold.open){state.folds[key]=fold.open;void save();}});
  function reveal(hash){let id;try{id=decodeURIComponent(hash.slice(1));}catch{return;}const target=get(id);if(!target)return;for(let parent=target;parent;parent=parent.parentElement)if(parent.tagName==='DETAILS')parent.open=true;}
  for(const link of document.querySelectorAll('a[href^="#"]'))link.addEventListener('click',()=>reveal(link.hash));
  get('attention-details')?.addEventListener('click',()=>{const details=get('runtime-diagnostics');if(details){details.open=true;details.scrollIntoView({block:'nearest',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});}});
  const beforeRead=revision;
  try{const stored=await storage.get(APPEARANCE_KEY);if(revision===beforeRead){state=normalizeAppearance(stored?.[APPEARANCE_KEY]??mirror);render();mirrorState();}}catch(e){render();if(status)status.textContent+=' Preferences could not be loaded.';onError(e);}
  if(globalThis.location?.hash)reveal(globalThis.location.hash);
  changes?.addListener((values,area)=>{if(area!=='local'||!values[APPEARANCE_KEY]||writes)return;state=normalizeAppearance(values[APPEARANCE_KEY].newValue);render();mirrorState();});
  // Section highlighting is event driven; no new periodic timer or queue scan.
  if(typeof IntersectionObserver!=='undefined'){const links=[...document.querySelectorAll('.section-nav a')],active=new Set(),observer=new IntersectionObserver(entries=>{for(const entry of entries)entry.isIntersecting?active.add(entry.target):active.delete(entry.target);const visible=[...active].sort((a,b)=>Math.abs(a.getBoundingClientRect().top-80)-Math.abs(b.getBoundingClientRect().top-80))[0];if(!visible)return;for(const link of links)if(link.hash==='#'+visible.id)link.setAttribute('aria-current','location');else link.removeAttribute('aria-current');},{rootMargin:'-80px 0px -45% 0px',threshold:0});for(const link of links){const section=get(link.hash.slice(1));if(section)observer.observe(section);}}
  return {state:()=>structuredClone(state),flush:()=>pending};
}
