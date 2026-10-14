// Render supplied functions; no product WebView. Source examples stay labelled as such.
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const target=process.argv[2];if(!target)throw Error('Output directory required');fs.mkdirSync(target,{recursive:true});
const html=fs.readFileSync('.local-design/kegel/tasarim.html','utf8'),context=vm.createContext({});
const a=html.indexOf('const I = {');vm.runInContext(html.slice(a,html.indexOf('\n};',a)+3),context);
const icons=html.indexOf('Object.assign(I, {');vm.runInContext(html.slice(icons,html.indexOf('\n});',icons)+4),context);
vm.runInContext('let __rid=0;'+html.slice(html.indexOf('/* ===================== PRATİK'),html.indexOf('/* ===================== KORUMA (')),context);
const css=[...html.matchAll(/<style>([\s\S]*?)<\/style>/g)].map(m=>m[1]).join('\n');
const p={elapsed:756,pauses:[{at:122,dur:46}],q:{er:8,content:true,end:'stopped',feel:['Kontrollü','Sakin']},pfAsked:true};
const scenes=[['html-intro','practiceIntroHTML()'],['html-practice',`practiceHTML(${JSON.stringify({...p,pauses:[]})})`],['html-pause',`pauseHTML(${JSON.stringify({...p,pauses:[]})},46)`],['html-question-1',`questionHTML(${JSON.stringify(p)},0,true,26)`],['html-question-2',`questionHTML(${JSON.stringify(p)},1,true,26)`],['html-question-3',`questionHTML(${JSON.stringify(p)},2,true,26)`],['html-summary',`pSummaryHTML(${JSON.stringify(p)},710)`]];
for(const [name,expression] of scenes){const markup=vm.runInContext(expression,context);fs.writeFileSync(path.join(target,name+'.html'),`<!DOCTYPE html><html lang="tr"><meta charset="utf-8"><style>${css}\nhtml,body{margin:0;width:390px;height:844px;min-height:0;background:#000}body{display:block}.phone{width:390px;height:844px;border-radius:0;box-shadow:none}.prx,.onb,.sum{padding-top:58px}*{animation:none!important;transition:none!important}.prx .pend{padding-bottom:0}.psum{height:844px;padding:58px 18px 34px;background:#000;color:#fff;border-radius:0;font-size:16px;font-weight:400}.sum .end{margin-top:18px}.donering .b{stroke-dashoffset:0}.donering .ck{transform:rotate(45deg) scale(1)}</style><body><div class="phone">${markup}</div></body></html>`);}
console.log('Seven source Practice HTML scenes generated.');
