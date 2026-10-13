// Evaluate only trusted local reference declarations; no browser script/network.
const fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
const html = fs.readFileSync('.local-design/kegel/tasarim.html', 'utf8');
const start = html.indexOf('const I = {');
const ctx = vm.createContext({});
vm.runInContext(html.slice(start, html.indexOf('\n};', start) + 3), ctx);
const between = (a,b) => html.slice(html.indexOf(a), html.indexOf(b, html.indexOf(a)));
vm.runInContext(between('const SOUNDS =', 'function learnHTML(') + between('const mmss =', '/* Araştırmalar:'), ctx);
const out = process.argv[2] || '/private/tmp/bloom-sounds-reference';
fs.mkdirSync(out, {recursive:true});
const css = [...html.matchAll(/<style>([\s\S]*?)<\/style>/g)].map(m=>m[1]).join('\n');
const scenes = {};
for (const id of ['ocean','rain','fire','forest']) {
 scenes[id] = vm.runInContext(`soundScene('${id}')`, ctx);
 const markup = vm.runInContext(`soundHTML('${id}',{on:false,el:0,dur:600})`, ctx);
 fs.writeFileSync(path.join(out,id+'.html'),`<!DOCTYPE html><html lang="tr"><meta charset="utf-8"><style>${css}\nhtml,body{margin:0;width:390px;height:844px;min-height:0;background:#000}body{display:block}.phone{position:relative;width:390px;height:844px;border-radius:0;overflow:hidden}.sdet{top:0;left:0;right:0;bottom:0}</style><body><div class="phone">${markup}</div></body></html>`);
}
fs.writeFileSync(path.join(out,'scenes.json'), JSON.stringify(scenes));
console.log(out);
