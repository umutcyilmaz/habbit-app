// Render the trusted local HTML's original Profile markup/CSS. Fixtures remain reference-only.
const fs=require('node:fs'), vm=require('node:vm'), path=require('node:path');
const html=fs.readFileSync('.local-design/kegel/tasarim.html','utf8');
const start=html.indexOf('const I = {'), context=vm.createContext({});
const between=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)));
vm.runInContext(html.slice(start,html.indexOf('\n};',start)+3),context);
vm.runInContext(between('/* ===================== PROFİL VE AYARLAR','function settingsHTML('),context);
vm.runInContext(between('function statusBar(){','function fitPhones('),context);
vm.runInContext(between('const TAB_ICONS =','</script>'),context);
const css=[...html.matchAll(/<style>([\s\S]*?)<\/style>/g)].map(m=>m[1]).join('\n');
const out=process.argv[2]; if(!out)throw Error('Pass a temporary output directory');fs.mkdirSync(out,{recursive:true});
vm.runInContext(html.match(/const PR = [^\n]+/)[0],context);
const markup=vm.runInContext(`'<div class="phone"><main class="scr">'+profileHTML(PR)+'</main>'+tabsHTML('Profil')+statusBar()+'</div>'`,context);
for(const [name,scroll] of [['html-profile',0],['html-for-you',560]]) fs.writeFileSync(path.join(out,name+'.html'),`<!DOCTYPE html><html lang="tr"><meta charset="utf-8"><style>${css}\nhtml,body{margin:0;width:390px;height:844px;min-height:0;background:#000}body{display:block}.phone{border-radius:0;box-shadow:none}*{animation:none!important;transition:none!important}</style><body>${markup}<script>document.querySelector('.scr').scrollTop=${scroll};</script></body></html>`);
console.log(out);
