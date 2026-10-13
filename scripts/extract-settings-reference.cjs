// Original reference markup and CSS. HTML switches are visual fixtures only.
const fs=require('node:fs'), vm=require('node:vm'), path=require('node:path');
const html=fs.readFileSync('.local-design/kegel/tasarim.html','utf8');
const context=vm.createContext({});
const between=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)));
const start=html.indexOf('const I = {');
vm.runInContext(html.slice(start,html.indexOf('\n};',start)+3),context);
vm.runInContext('Object.assign(I, {'+html.match(/^  cal:`[^`]+`/m)[0]+'});',context);
vm.runInContext('Object.assign(I, {'+html.match(/^  wave:`[^`]+`/m)[0]+'});',context);
vm.runInContext(html.match(/const toggle = [^\n]+/)[0],context);
vm.runInContext(between('/* ===================== PROFİL VE AYARLAR', '/* ===================== ÖZELLİK TANITIMI'),context);
vm.runInContext(between('function statusBar(){','function fitPhones('),context);

const css=[...html.matchAll(/<style>([\s\S]*?)<\/style>/g)].map(m=>m[1]).join('\n');
const out=process.argv[2]; if(!out)throw Error('Pass output directory');fs.mkdirSync(out,{recursive:true});
const markup=vm.runInContext(`settingsHTML({lock:true,hideNotif:true,kegelN:true,riskN:false,weekN:true,pf:true})`,context);
const status=vm.runInContext('statusBar()',context), sheet=vm.runInContext('wipeSheet()',context);
for(const [name,scroll,showSheet] of [['html-settings-top',0,false],['html-settings-bottom',700,false],['html-delete',700,true]]) fs.writeFileSync(path.join(out,name+'.html'),`<!DOCTYPE html><html lang="tr"><meta charset="utf-8"><style>${css}\nhtml,body{margin:0;width:390px;height:844px;min-height:0;background:#000}body{display:block}.phone{border-radius:0;box-shadow:none}*{animation:none!important;transition:none!important}</style><body><div class="phone ${showSheet?'sheet-open':''}"><div class="page">${markup}</div>${showSheet?'<div class="scrim"></div><div class="sheet">'+sheet+'</div>':''}${status}</div><script>document.querySelector('.scr').scrollTop=${scroll};</script></body></html>`);
console.log(out);
