// Investigation only: execute the current product, assert its CURRENT behavior.
// Run: node docs/investigations/addon-escalation-probe.mjs
// All route I/O uses the existing fake-service fixture; no credentials are read.
// No production code is modified. The only injected seam is fixture setup.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { mergeAddonPages, MAX_RETURNED } from '../../builder/site-addon.mjs';
import { validatePages, MAX_PAGES, priorPagesBlock } from '../../builder/page-gen.mjs';
import { BUILD_MODELS } from '../../builder/build-models.mjs';
const root = new URL('../../', import.meta.url);
const fixtureUrl = new URL('test/fixtures/addon-route.mjs', root);
let fixture = fs.readFileSync(fixtureUrl, 'utf8').replace(/\r\n/g,'\n');
fixture = fixture.replace(/from "(\.[^"]+)"/g, (_,p)=>`from "${new URL(p,fixtureUrl).href}"`);
const needle = 'const res = await worker.fetch(req, env, ctx);';
assert.equal(fixture.split(needle).length,2);
fixture=fixture.replace(needle,'if (opts && opts.setup) opts.setup(env, store, slug);\n    '+needle);
const {addon,storedPage,addedTo,writtenPage} = await import('data:text/javascript;base64,'+Buffer.from(fixture).toString('base64'));
// The fixture replaces fetch during each route. Refuse any accidental escape.
globalThis.fetch = async () => { throw new Error('Network is forbidden in this investigation'); };
const chat = fs.readFileSync(new URL('public/chat.js',root),'utf8').replace(/\r\n/g,'\n');
const layersLine = chat.split('\n').find(s=>s.startsWith('const ROUTE_EDIT_LAYERS ='));
assert.ok(layersLine);
const layers = vm.runInNewContext(layersLine+'\nROUTE_EDIT_LAYERS');
const cut = name => {const at=chat.indexOf('\nfunction '+name+'(');assert.ok(at>0);return chat.slice(at,chat.indexOf('\n}\n',at)+3);};
const read = vm.runInNewContext(cut('readRouteReply')+'\nreadRouteReply', {EditPoll:{isRecovered:()=>false}});
const interpret = (httpOk,body,instruction) => {
 const out={rewrite:0,hops:[],messages:[],applied:0};
 const answer=vm.runInNewContext(cut('readRouteReply')+cut('readAddonReply')+cut('addonAnswer')+'\naddonAnswer',{
  EditPoll:{isRecovered:()=>false},ROUTE_EDIT_LAYERS:layers,
  addonOutcomeMsg:s=>s,siteEdit:(_s,d)=>out.hops.push(d.layer),applyAddonResult:()=>out.applied++
 });
 answer(httpOk,body,{instruction,site:{slug:'probe'},finish:t=>out.messages.push(t),fallback:()=>out.rewrite++});
 return out;
};
const records=[];
const component={kinds:['component'],answers:{component:{component:[{page:'/',does:'a parking note',components:['card']}]}},storedPages:[storedPage('/')]};
const cases=[
 ['empty',{instruction:''}],
 ['unconfigured',{setup:env=>{delete env.ANTHROPIC_API_KEY;delete env.XAI_API_KEY;}}],
 ['source-absent',{setup:(env,s,slug)=>s.store.delete(`source/${slug}/pages.json`)}],
 ['source-empty',{setup:(env,s,slug)=>s.store.set(`source/${slug}/pages.json`,'[]')}],
 ['source-read-throws',{setup:(env,s,slug)=>{const get=s.get;s.get=async k=>{if(k===`source/${slug}/pages.json`)throw Error('injected source read failure');return get(k);};}}],
 ['source-transient',{setup:(env,s,slug)=>{const get=s.get;let failed=false;s.get=async k=>{if(k===`source/${slug}/pages.json`&&!failed){failed=true;throw Error('one failed source read');}return get(k);};}}],
 ['source-invalid-json',{setup:(env,s,slug)=>s.store.set(`source/${slug}/pages.json`,'{bad')}],
 ['source-invalid-shape',{setup:(env,s,slug)=>s.store.set(`source/${slug}/pages.json`,'{}')}],
 ['config-read-throws',{setup:(env,s,slug)=>{const get=s.get;s.get=async k=>{if(k===`config/${slug}.json`)throw Error('injected config read failure');return get(k);};}}],
 ['config-invalid-json',{setup:(env,s,slug)=>s.store.set(`config/${slug}.json`,'{bad')}],
 ['config-absent-no-database',{backend:'none',setup:(env,s,slug)=>s.store.delete(`config/${slug}.json`)}],
 ['config-css-only',{backend:'none',setup:(env,s,slug)=>s.store.set(`config/${slug}.json`,JSON.stringify({css:'body { color: red; }'}))}],
 ['config-invalid-look',{backend:'none',setup:(env,s,slug)=>s.store.set(`config/${slug}.json`,JSON.stringify({look:7}))}],
 ['schema-read-fails',{metaFail:true}],
 ['schema-invalid-json',{metaJunk:true}],
 ['no-add-empty',{kinds:[]}],
 ['no-add-invalid',{kinds:['not-a-kind']}],
 ['nothing-returned',{...component,written:[]}],
 ['nothing-valid-returned',{...component,written:[{path:'index.tsx',source:'not a route'}]}],
 ['no-change',{...component,written:[storedPage('/')]}],
 ['picture-hop',{kinds:['photo']}],
 ['backend-unreadable',{backend:'unreadable'}],
 ['healthy-addition',{...component,publishes:true,written:[addedTo('/','<p>Free parking.</p>')]}],
 ['empty-schema-valid-addition',{metaMissing:true,publishes:true,kinds:['table'],answers:{table:{table:[{table:{name:'repairs',columns:[{name:'who',type:'text'}]}}]}}}],
];
for(const [name,opts] of cases){
 const r=await addon('probe-'+name,opts.instruction??'Add a parking note to the homepage',{kinds:[],answers:{},...opts});
 const act=read(r.status>=200&&r.status<300,r.body,layers);
 const rec={name,status:r.status,body:r.body,clientAction:act,browser:interpret(r.status>=200&&r.status<300,r.body,opts.instruction??'Add a parking note to the homepage'),modelCalls:r.prompts.length,compiles:r.compiles.length};
 const stops=['empty','backend-unreadable'];
 const successes=['healthy-addition','empty-schema-valid-addition'];
 assert.equal(rec.browser.rewrite,stops.includes(name)||successes.includes(name)||name==='picture-hop'?0:1,name);
 assert.equal(rec.browser.applied,successes.includes(name)?1:0,name);
 assert.equal(rec.browser.hops.join(','),name==='picture-hop'?'picture':'',name);
 if(name.startsWith('source-'))assert.equal(r.body.reason,'no-source',name);
 if(name.startsWith('config-')||name.startsWith('schema-'))assert.equal(r.body.reason,'no-meta',name);
 if(name.startsWith('no-add-'))assert.equal(r.body.reason,'no-add',name);
 if(name.startsWith('nothing-'))assert.equal(r.body.reason,'nothing-returned',name);
 if(name==='no-change')assert.equal(r.body.reason,'no-change');
 records.push(rec);
 console.log(JSON.stringify({name,status:r.status,reason:r.body.reason||r.body.error||'success',rewrite:rec.browser.rewrite,hop:rec.browser.hops,applied:rec.browser.applied,stubModelCalls:r.prompts.length,stubCompiles:r.compiles.length}));
}
// Focused helper controls for why widening the operation cannot fix its ceiling.
assert.equal(MAX_PAGES,MAX_RETURNED);
const seven=Array.from({length:MAX_RETURNED+1},(_,i)=>writtenPage('/p'+i));
assert.equal(mergeAddonPages([],seven).reason,'too-many');
const validated=validatePages({pages:seven},{partial:true});
assert.equal(validated.pages.length,MAX_RETURNED);
assert.equal(mergeAddonPages([],validated.pages).ok,true);
assert.equal(priorPagesBlock(null),'');
assert.match(priorPagesBlock([storedPage('/')]),/Return every page again/);
for(const model of Object.values(BUILD_MODELS)){
 assert.equal(model.quick,model.design);
 assert.equal(model.quick,model.pages);
}
console.log(JSON.stringify({routeCases:records.length,rewrites:records.reduce((n,r)=>n+r.browser.rewrite,0),hops:1,stops:2,successes:2,helperControls:'page ceiling; absent/present source prompt; same selected model across add and rewrite',network:'stubbed; no paid calls'}));
