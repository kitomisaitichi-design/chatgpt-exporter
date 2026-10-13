// Apply the small local appearance mirror before body paint. No account/job data is read.
(()=>{
  const themes=['midnight','graphite','ocean','forest','plum','paper','sand','contrast'];
  let saved={};try{const text=localStorage.getItem('englishExporterAppearance');if(text&&text.length<4096)saved=JSON.parse(text)||{};}catch{}
  const root=document.documentElement;
  root.dataset.theme=themes.includes(saved.theme)?saved.theme:'midnight';
  root.dataset.density=saved.density==='compact'?'compact':'comfortable';
  root.style.colorScheme=['paper','sand'].includes(root.dataset.theme)?'light':'dark';
})();
