const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
async function submit(response) {
 const handlers={}; let payload,reset=false;
 const message={className:'',textContent:'',style:{},scrollIntoView(){}};
 const button={disabled:false,textContent:'Request Early Access'};
 const fields=[{name:'email',type:'email',value:'audit@example.invalid'},{name:'password',type:'password',value:'must-never-leave-browser'}];
 const form={parentElement:{querySelector:()=>message},addEventListener:(n,f)=>handlers[n]=f,querySelector:s=>s==='[type="submit"]'?button:null,querySelectorAll:s=>s==='input, select, textarea'?fields:[],reset(){reset=true}};
 const document={querySelector:()=>null,querySelectorAll:()=>[],getElementById:id=>id==='login-form'?form:null};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../main.js'),'utf8'),{document,window:{},fetch:async(u,o)=>{payload=JSON.parse(o.body);if(response instanceof Error)throw response;return response;}});
 handlers.submit({preventDefault(){}});await new Promise(setImmediate);
 return {message,button,payload,reset};
}
for(const [label,response] of [['HTTP failure',{ok:false,json:async()=>({success:true})}],['invalid JSON',{ok:true,json:async()=>{throw Error('Invalid JSON')}}],['explicit rejection',{ok:true,json:async()=>({success:false})}],['missing acknowledgement',{ok:true,json:async()=>({})}],['network failure',Error('offline')]]) {
 test(label+' preserves input and reports error',async()=>{const r=await submit(response);assert.equal(r.reset,false);assert.match(r.message.className,/error/);assert.equal(r.button.disabled,false);assert.equal(r.payload.password,undefined)});
}
test('acknowledged success resets input without sending passwords',async()=>{const r=await submit({ok:true,json:async()=>({success:true})});assert.equal(r.reset,true);assert.match(r.message.className,/success/);assert.equal(r.payload.email,'audit@example.invalid');assert.equal(r.payload.password,undefined)});
test('early access markup never requests a password',()=>{const s=fs.readFileSync(path.join(__dirname,'../login.html'),'utf8');assert.doesNotMatch(s,/type="password"/);assert.match(s,/Request Early Access/)});
