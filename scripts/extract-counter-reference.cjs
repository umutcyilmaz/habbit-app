// Original HTML functions and CSS, evaluated offline. Fixture numbers are design references only.
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const html=fs.readFileSync('.local-design/kegel/tasarim.html','utf8'),context=vm.createContext({});
const between=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)));
const start=html.indexOf('const I = {');
vm.runInContext(html.slice(start,html.indexOf('\n};',start)+3),context);
for(const icon of ['cal','wave'])vm.runInContext('Object.assign(I, {'+html.match(new RegExp('^  '+icon+':`[^`]+`','m'))[0]+'});',context);
vm.runInContext(between('const fogEl =','/* ===== Detay (Opal Score sayfası) ===== */'),context);
vm.runInContext(between('/* ===== Detay (Opal Score sayfası) ===== */','/* ===== Zor an: zamanlayıcı ===== */'),context);
vm.runInContext(between('const GAPPS =','/* 1. Tanıtım */'),context);
vm.runInContext(between('function statusBar(){','function fitPhones('),context);
vm.runInContext(html.match(/const base = [\s\S]*?last:26};/)[0],context);
vm.runInContext('const DAYN=["Pzt","Sal","Çar","Per","Cum","Cmt","Paz"]; var G={on:false,days:0,apps:{},custom:[]};',context);
const css=[...html.matchAll(/<style>([\s\S]*?)<\/style>/g)].map(m=>m[1]).join('\n');
const out=process.argv[2];if(!out)throw Error('Pass output directory');fs.mkdirSync(out,{recursive:true});
for(const [name,pf,scroll] of [['html-counter-top','on',0],['html-counter-calendar','on',520],['html-counter-protection','on',920],['html-counter-stopped','paused',0]]){
 const state=vm.runInContext('({...base,anim:false})',context);state.pf=pf;state.pausedAt=new Date();context.S=state;
 const markup=vm.runInContext(`'<div class="phone">'+detailHTML(S)+statusBar()+'</div>'`,context);
 fs.writeFileSync(path.join(out,name+'.html'),`<!doctype html><html lang="tr"><meta charset="utf-8"><style>${css}\nhtml,body{margin:0;width:390px;height:844px;min-height:0;background:#000}body{display:block}.phone{border-radius:0;box-shadow:none}*{animation:none!important;transition:none!important}</style><body>${markup}<script>document.querySelector('.scr').scrollTop=${scroll};</script></body></html>`);
}
console.log(out);
