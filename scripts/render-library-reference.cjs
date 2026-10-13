// Build static HTML documents from the supplied source functions and CSS.
// An offline document renderer consumes these; no browser, network, or WebView.
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const output=process.argv[2];if(!output)throw new Error('Pass a temporary output directory');
fs.mkdirSync(output,{recursive:true});
const html=fs.readFileSync('.local-design/kegel/tasarim.html','utf8');
const between=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)));
const context=vm.createContext({});
const iconStart=html.indexOf('const I = {');
vm.runInContext(html.slice(iconStart,html.indexOf('\n};',iconStart)+3),context);
vm.runInContext('let ham;'+between('let __mhid =','/* ===================== ÖĞREN')+between('const CATS =','/* ===================== PRATİK'),context);
vm.runInContext(between('function statusBar(){','function fitPhones('),context);
vm.runInContext(between('const TAB_ICONS =','</script>'),context);
const css=[...html.matchAll(/<style>([\s\S]*?)<\/style>/g)].map(m=>m[1]).join('\n');
const state={feat:'wave',read:[],saved:[]};
const home=vm.runInContext(`'<div class="phone"><main class="scr">'+learnHTML(${JSON.stringify(state)})+'</main>'+tabsHTML('Öğren')+statusBar()+'</div>'`,context);
function reader(id,read=false,scroll=0){
  const inner=vm.runInContext(`articleHTML(art(${JSON.stringify(id)}),${JSON.stringify({...state,read:read ? [id] : []})})+statusBar()`,context);
  return '<div class="phone"><div class="page">'+inner+'</div></div>';
}
for(const [name,markup,scroll] of [['html-home',home,0],['html-article-top',reader('pe'),0],['html-article-bottom',reader('pe'),1250],['html-completed',reader('pe',true),1250]]) {
  // Translate the scrollable source content for a static bottom snapshot.
  const body=scroll ? markup.replace('<div class="ahero">',`<div style="position:relative;top:-${scroll}px"><div class="ahero">`).replace('</article>','</article></div>') : markup;
  const compatibleBody=body.replace(/<button\b/g,'<div role="button"').replace(/<\/button>/g,'</div>');
  const compatibleCss=css.replace(/\bbutton\b/g,'[role="button"]');
  const longCanvas=name==='html-home' ? '' : '@page{size:390px 3200px}.phone,.page,.scr,html,body{height:3200px}.homebar{top:831px;bottom:auto}';
  const document=`<!DOCTYPE html><html lang="tr"><meta charset="utf-8"><style>${compatibleCss}\n@page{size:390px 844px;margin:0}html,body{width:390px;height:844px;min-height:0;background:#000}body{margin:0}.phone{border-radius:0;box-shadow:none;overflow:hidden}*{animation:none!important;transition:none!important}.scr,.page{top:0;left:0;right:0;bottom:0;width:390px;height:844px}.scr{overflow:hidden}.il{top:0;left:0;right:0;bottom:0}.phone{display:block}.feat{width:358px}.cover.lg{width:358px;height:230px;min-height:230px}.arow{display:block;position:relative;width:330px;min-height:82px;break-inside:avoid}.arow>.cover{float:left}.arow>div:nth-child(2){margin-left:76px;width:240px}.arow>.chev,.arow>.rd{position:absolute;right:0;top:33px}.lgh{width:358px}.lgh .lsec{flex:none;min-width:270px}.ahero{height:330px}.ahero::after{top:0;left:0;right:0;bottom:0;width:100%;height:100%}.lgh>span{min-width:60px;white-space:nowrap;text-align:right}.abody{display:block}.tabs{display:block}.tabs>[role="button"]{display:inline-block;width:25%;text-align:center}.tabs>[role="button"] svg{display:block;width:24px;height:24px;margin:0 auto}.page .art{padding-bottom:0}.cover.v2::after{display:none}${longCanvas}</style><body>${compatibleBody}</body></html>`;
  fs.writeFileSync(path.join(output,name+'.html'),document);
}
console.log('Static offline reference documents generated from actual HTML functions.');
