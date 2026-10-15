// Extract exact approved HTML functions and embedded CSS; no product code changes.
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const output=process.argv[2];if(!output)throw Error('Pass a temporary output folder');fs.mkdirSync(output,{recursive:true});
const html=fs.readFileSync('.local-design/kegel/tasarim.html','utf8');
const slice=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)));
const context=vm.createContext({});
vm.runInContext(slice('function seg(str){','function fitPhones('),context);
vm.runInContext(slice('const I = {','const fmtDay'),context);
vm.runInContext(slice('function timerHTML(min){','/* ===== Alt sayfalar'),context);
const css=[...html.matchAll(/<style>([\s\S]*?)<\/style>/g)].map(m=>m[1]).join('\n');
for(const [name,expression]of [['html-ready','`<div class="phone"><div class="page">${timerHTML(10)}</div>${statusBar()}</div>`'],['html-running','`<div class="phone">${runHTML(587,26)}${statusBar()}</div>`']]){
 const markup=vm.runInContext(expression,context);
 const document=`<!doctype html><html lang="tr"><meta charset="utf-8"><style>${css}\nhtml,body{width:390px;height:844px;min-height:0;margin:0;background:#000;overflow:hidden}body{display:block;padding:0}.phone{display:block;margin:0;width:390px;height:844px;border-radius:0;box-shadow:none;transform:none}*{animation:none!important;transition:none!important}</style><body>${markup}</body></html>`;
 fs.writeFileSync(path.join(output,name+'.html'),document);
}
console.log('Two exact HTML Zor An states extracted; no external scripts or network fonts.');
