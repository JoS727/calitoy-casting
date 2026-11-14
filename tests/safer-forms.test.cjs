const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../main.js'),'utf8');
const tick=()=>new Promise(setImmediate);
function field(name,type='text',value='synthetic') {
 return {name,type,value,valid:true,reports:0,checkValidity(){return this.valid;},reportValidity(){this.reports++;return this.valid;}};
}
function setup(talent=false) {
 const handlers={},next=[],requests=[];
 const fields=[field('email','email','audit@example.invalid'),field('password'),field('token'),field('email','password','excluded'),field('source','hidden','override')];
 const optional=field('reel_url','url','https://example.invalid/reel');
 if(talent)fields.push(optional);
 const steps=[fields.slice(0,1),fields.slice(1)].map(items=>({active:false,classList:{toggle(){}},querySelectorAll:()=>items}));
 const message={className:'',style:{},scrollIntoView(){}};
 const button={disabled:false,textContent:'Submit'};
 const form={valid:true,resets:0,parentElement:{querySelector:()=>message},reportValidity(){return this.valid;},reset(){this.resets++;},getBoundingClientRect:()=>({top:0}),addEventListener:(n,f)=>handlers[n]=f,querySelector:s=>s==='[type="submit"]'?button:null,querySelectorAll:s=>s==='.form-step'?steps:s==='[data-next]'?[{addEventListener:(n,f)=>next.push(f)}]:s==='[data-prev]'?[]:s==='input, select, textarea'?fields:[]};
 vm.runInNewContext(source,{document:{querySelector:()=>null,querySelectorAll:()=>[],getElementById:id=>id===(talent?'submit-form':'login-form')?form:id==='form-message'?message:null},window:{scrollTo(){},scrollY:0},fetch:(url,options)=>new Promise((resolve,reject)=>requests.push({payload:JSON.parse(options.body),resolve,reject}))});
 return {fields,optional,form,message,button,requests,next,submit:()=>handlers.submit({preventDefault(){}})};
}
for(const talent of [false,true]) {
 const label=talent?'talent':'early access';
 test(label+': allowlist and concurrent submit guard',async()=>{
  const h=setup(talent);h.submit();h.submit();assert.equal(h.requests.length,1);
  const p=h.requests[0].payload;assert.equal(p.password,undefined);assert.equal(p.token,undefined);assert.equal(p.email,'audit@example.invalid');assert.notEqual(p.source,'override');
  h.requests[0].reject(Error('offline'));await tick();assert.equal(h.form.resets,0);assert.equal(h.button.disabled,false);
  h.submit();assert.equal(h.requests.length,2);
 });
 for(const [label2,response] of [
  ['HTTP error',{ok:false,json:async()=>({success:true})}],
  ['invalid JSON',{ok:true,json:async()=>{throw Error('bad')}}],
  ['null',{ok:true,json:async()=>null}],
  ['string success',{ok:true,json:async()=>({success:'true'})}],
  ['missing success',{ok:true,json:async()=>({})}],
  ['explicit rejection',{ok:true,json:async()=>({success:false})}]
 ])test(label+': '+label2,async()=>{const h=setup(talent);h.submit();h.requests[0].resolve(response);await tick();assert.match(h.message.className,/error/);assert.equal(h.form.resets,0);assert.equal(h.button.disabled,false);});
 test(label+': acknowledged success',async()=>{const h=setup(talent);h.submit();h.requests[0].resolve({ok:true,json:async()=>({success:true})});await tick();assert.match(h.message.className,/success/);assert.equal(h.button.disabled,false);assert.equal(h.form.resets,talent?0:1);});
}
test('invalid early-access input never sends',()=>{const h=setup();h.form.valid=false;h.submit();assert.equal(h.requests.length,0);});
test('optional URL blocks wizard advance and final submission',()=>{const h=setup(true);h.next[0]();h.optional.valid=false;h.next[0]();assert.equal(h.optional.reports,1);h.submit();assert.equal(h.requests.length,0);assert.equal(h.optional.reports,2);assert.equal(h.form.noValidate,true);});
test('earlier required field is revalidated at submission',()=>{const h=setup(true);h.next[0]();h.fields[0].valid=false;h.submit();assert.equal(h.requests.length,0);assert.equal(h.fields[0].reports,1);});
test('empty optional URL is allowed by validity result',()=>{const h=setup(true);h.optional.value='';h.submit();assert.equal(h.requests.length,1);});
