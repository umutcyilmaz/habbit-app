// Render original local HTML. All sample statistics, names and Reddit cards stay reference-only.
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const html=fs.readFileSync('.local-design/kegel/tasarim.html','utf8'),context=vm.createContext({});
const between=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)));
const start=html.indexOf('const I = {');
vm.runInContext(html.slice(start,html.indexOf('\n};',start)+3),context);
for(const icon of ['cal','wave'])vm.runInContext('Object.assign(I, {'+html.match(new RegExp('^  '+icon+':`[^`]+`','m'))[0]+'});',context);
vm.runInContext(between('const GOALS =','/* ===== Detay (Opal Score sayfası) ===== */'),context);
vm.runInContext(between('const RESET_DAYS =','/* Sorular */'),context);
vm.runInContext(between('function resetHero(R){','/* Tamamlandı: rozet */'),context);
vm.runInContext(between('function statusBar(){','function fitPhones('),context);
vm.runInContext(between('const TAB_ICONS =','</script>'),context);
// The reference icons used only by the deferred community section.
const liStart=html.indexOf('const LI =');
if(liStart>=0)vm.runInContext(html.slice(liStart,html.indexOf('\n};',liStart)+3),context);
const css=[...html.matchAll(/<style>([\s\S]*?)<\/style>/g)].map(m=>m[1]).join('\n');
const out=process.argv[2];if(!out)throw Error('Pass output directory');fs.mkdirSync(out,{recursive:true});
vm.runInContext(html.match(/const base = [\s\S]*?last:26};/)[0],context);
for(const [name,pf,scroll,reset] of [['html-home-inactive','off',0,false],['html-home-active','on',0,false],['html-home-new-streak','on',0,false],['html-home-bottom','on',600,false],['html-home-reset','off',0,true]]){
 const state=vm.runInContext('({...base})',context);state.pf=pf;if(name==='html-home-new-streak')state.days=0;
 context.S=state;vm.runInContext(`var R={active:${reset},sug:false,day:10,ref:{gap:5.1,q:7}};`,context);
 const markup=vm.runInContext(`'<div class="phone"><main class="scr">'+homeHTML(S)+'</main>'+tabsHTML('home')+statusBar()+'</div>'`,context);
 fs.writeFileSync(path.join(out,name+'.html'),`<!doctype html><html lang="tr"><meta charset="utf-8"><style>${css}\nhtml,body{margin:0;width:390px;height:844px;min-height:0;background:#000}body{display:block}.phone{border-radius:0;box-shadow:none}*{animation:none!important;transition:none!important}</style><body>${markup}<script>document.querySelector('.scr').scrollTop=${scroll};</script></body></html>`);
}
console.log(out);
