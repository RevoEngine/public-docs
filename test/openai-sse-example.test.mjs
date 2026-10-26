import assert from 'node:assert/strict';
import {existsSync, readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import {codeExamples, exampleSyntaxIssues, publicMemberIssues} from '../scripts/documentation-examples.mjs';
import {publicTextPrivacyIssues} from '../scripts/public-content-privacy.mjs';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const source = read('examples/sse/openai-component.txt');
const invoke = vm.compileFunction('return (async () => {\n' + source + '\n})();', ['api', 'sse', 'vault', 'util', 'console']);
const clone = value => JSON.parse(JSON.stringify(value));
const call = (id = 'call-1', args = {a:37,b:19,op:'multiply'}, name = 'calc') => ({type:'function_call',name,call_id:id,arguments:JSON.stringify(args)});
const answer = text => ({type:'message',role:'assistant',content:[{type:'output_text',text}]});
function responseFrames(output) {
 return [
  ...output.filter(item => item.type === 'function_call').map(item => ({type:'response.output_item.added',item})),
  ...output.filter(item => item.type === 'message').flatMap(item => item.content.map(part => ({type:'response.output_text.delta',delta:part.text}))),
  {type:'response.completed',response:{status:'completed',output}},
 ];
}
function fixture(options = {}) {
 const state = {runs:clone(options.runs ?? []),events:clone(options.events ?? []),sent:[],requests:[],logs:[],closes:0,secrets:0,hook:null,hookPromise:null,connected:true,claims:0};
 const input = options.input ?? {body:{runId:'sample-1',message:'Calculate 37 * 19.'},headers:{}};
 const outputs = options.outputs ?? [[call()],[answer('37 × 19 = 703.')]];
 const findRun = () => state.runs.find(row => row.runId === input.body.runId);
 const api = {
  input:()=>input,currentUser:()=>({userId:options.owner ?? 'user-1'}),
  getDatabaseDataRow:async()=>{if(options.onRead)await options.onRead(state);return clone(findRun() ?? null);},
  acquireIdempotencyKey:async()=>{state.claims++;return options.claim !== false;},
  insertDatabaseData:async(name,rows)=>{
   if(options.failPersistence && name === 'SseAiEvents' && rows[0].event === options.failPersistence)throw new Error('private persistence details');
   if(name === 'SseAiRuns') state.runs.push(...clone(rows));
   else {if(options.persistDelay)await Promise.resolve();state.events.push(...clone(rows));}
  },
  updateDatabaseData:async(name,filter,patch)=>Object.assign(findRun(),clone(patch)),
  getDatabaseData:async(name,query)=>({data:clone(state.events.filter(row=>row.runId===input.body.runId && row.seq>query.filter.and[1].value).sort((a,b)=>a.seq-b.seq).slice(0,query.take))}),
  httpCall:async(request,httpOptions)=>{
   state.requests.push({request:clone(request),options:httpOptions});
   if(options.httpThrow)throw new Error('private upstream credential material');
   const index=state.requests.length-1;
   if(options.beforeModel)await options.beforeModel(state,index);
   return {status:options.httpStatus ?? 200,data:(async function*(){
    const frames=options.frames ?? responseFrames(outputs[index] ?? [answer('Finished.')]);
    for(const frame of frames)yield {data:typeof frame==='string'?frame:JSON.stringify(frame)};
   })(),close:async()=>{state.closes++;}};
  },
 };
 const sse={
  remainingTime:()=>options.remainingMs ?? 60000,
  onDisconnect:hook=>{state.hook=hook;},
  json:async(payload,meta)=>{
   const row=state.events.find(row=>row.seq===Number(meta.id));assert.ok(row,'Persist before send');assert.deepEqual(clone(payload),row.payload);
   if(state.connected)state.sent.push({data:clone(payload),...meta});
   if(options.disconnectAt===meta.event && state.connected){state.connected=false;state.hookPromise=Promise.resolve().then(()=>state.hook());}
  },
 };
 const vault={get:async name=>{assert.equal(name,'OPENAI');state.secrets++;return{revision:{value:'fixture-only-credential'}};}};
 const util={sleep:async()=>{if(options.onSleep)await options.onSleep(state);}};
 const logger={warn:message=>state.logs.push(message)};
 return {state,run:()=>invoke(api,sse,vault,util,logger)};
}

test('published and downloadable Component sources are identical, parse and use only declared APIs',()=>{
 const page=read('operate/sse-openai-example.mdx');
 assert.match(page,/\/examples\/sse\/openai-component\.txt/);
 assert.equal(existsSync(new URL('../examples/sse/openai-component.js',import.meta.url)),false,'Component bodies must not be injected as Mintlify custom JavaScript');
 const block=codeExamples(page).find(example=>example.code.includes('function createEventJournal'));
 assert.ok(block);assert.equal(block.code.trim(),source.trim());assert.deepEqual(exampleSyntaxIssues(page),[]);
 assert.deepEqual(publicMemberIssues(page,read('low-code/reference/source/api.public.d.ts'),'operate/sse-openai-example.mdx'),[]);
 assert.deepEqual(publicTextPrivacyIssues(page),[]);
});
test('tool registry, callbacks and streamed final answer complete one calculation',async()=>{
 const f=fixture();const result=await f.run();
 assert.deepEqual(clone(result),{runId:'sample-1',message:'37 × 19 = 703.',toolCalls:1,modelRequests:2});
 assert.equal(f.state.runs[0].status,'completed');assert.equal(f.state.closes,2);
 assert.deepEqual(f.state.events.map(e=>e.event),['run.started','tool.pending','tool.started','tool.completed','model.delta','run.completed']);
 assert.equal(f.state.events.find(e=>e.event==='tool.completed').payload.value,703);
 assert.ok(f.state.requests[1].request.data.input.some(item=>item.type==='function_call_output' && JSON.parse(item.output).value===703));
 assert.equal(f.state.requests[0].request.data.max_output_tokens,1200);
 assert.equal(f.state.requests[0].request.data.parallel_tool_calls,false);
 assert.equal(f.state.requests[0].options.streamFormat,'sse');
 assert.doesNotMatch(JSON.stringify({events:f.state.events,result}),/fixture-only-credential/);
 assert.ok(f.state.sent.every(frame=>frame.retry===1000));
 assert.ok(f.state.sent.every(frame=>!['result','done','error'].includes(frame.event)));
});
test('a normal text answer does not force a calculator call',async()=>{
 const f=fixture({outputs:[[answer('Hello.')]]});const result=await f.run();
 assert.equal(result.message,'Hello.');assert.equal(result.toolCalls,0);assert.equal(result.modelRequests,1);
 assert.equal(f.state.requests[0].request.data.tool_choice,'auto');
 assert.equal(f.state.events.some(event=>event.event.startsWith('tool.')),false);
});
test('disconnect callback and main flow share ordered persistence; completed recovery does not call model or Vault',async()=>{
 const original=fixture({disconnectAt:'tool.pending',persistDelay:true});const result=await original.run();await original.state.hookPromise;
 assert.equal(original.state.sent.at(-1).id,'2');
 assert.equal(original.state.events.filter(e=>e.event==='run.disconnected').length,1);
 assert.deepEqual(original.state.events.map(e=>e.seq),original.state.events.map((_,i)=>i+1));
 const resumed=fixture({runs:original.state.runs,events:original.state.events,input:{body:{runId:'sample-1'},headers:{'last-event-id':'2'}}});
 assert.deepEqual(clone(await resumed.run()),clone(result));assert.equal(resumed.state.requests.length,0);assert.equal(resumed.state.secrets,0);assert.equal(resumed.state.claims,0);
 assert.ok(resumed.state.sent.every(frame=>Number(frame.id)>2));
 assert.ok(resumed.state.sent.some(frame=>frame.event==='run.disconnected'));
 const completed=fixture({runs:original.state.runs,events:original.state.events,input:{body:{runId:'sample-1',after:original.state.events.length},headers:{}}});
 assert.deepEqual(clone(await completed.run()),clone(result));assert.equal(completed.state.sent.length,0);assert.equal(completed.state.requests.length,0);
});
test('a concurrent observer waits for the stored owner before reading events',async()=>{
 let sleeps=0;
 const f=fixture({claim:false,onSleep:async state=>{sleeps++;state.runs.push({runId:'sample-1',owner:'user-2',message:'Calculate 37 * 19.',status:'completed',final:{message:'private'}});},events:[{runId:'sample-1',seq:1,event:'model.delta',payload:{delta:'private'}}]});
 await assert.rejects(f.run(),/RUN_ACCESS_DENIED|another user/);assert.equal(sleeps,1);assert.equal(f.state.sent.length,0);assert.equal(f.state.secrets,0);
});
test('observer drains all persisted pages before returning final result',async()=>{
 const result={message:'complete'};
 const events=Array.from({length:205},(_,i)=>({runId:'sample-1',seq:i+1,event:'progress',payload:{current:i+1}}));
 const f=fixture({runs:[{runId:'sample-1',owner:'user-1',message:'Calculate 37 * 19.',status:'completed',final:result}],events});
 assert.deepEqual(clone(await f.run()),result);assert.equal(f.state.sent.length,205);assert.equal(f.state.requests.length,0);
});
for(const [name,overrides,pattern] of [
 ['owner mismatch',{runs:[{runId:'sample-1',owner:'user-2'}]},/another user/],
 ['message mismatch',{runs:[{runId:'sample-1',owner:'user-1',message:'different'}]},/different message/],
 ['invalid cursor',{input:{body:{runId:'sample-1',message:'hi'},headers:{'last-event-id':'-1'}}},/Last-Event-ID/],
 ['invalid run ID',{input:{body:{runId:'invalid/run',message:'hi'}}},/runId/],
 ['empty message',{input:{body:{runId:'sample-1',message:' '}}},/message/],
 ['new run without a message',{input:{body:{runId:'sample-1'}}},/message/],
])test('rejects '+name+' before model access',async()=>{const f=fixture(overrides);await assert.rejects(f.run(),pattern);assert.equal(f.state.requests.length,0);assert.equal(f.state.secrets,0);});
for(const [name,overrides,pattern] of [
 ['unknown tool',{outputs:[[call('call-1',{},'delete_all')]]},/UNSUPPORTED_TOOL_CALL/],
 ['duplicate call ID',{outputs:[[call(),call()]]},/UNSUPPORTED_TOOL_CALL/],
 ['prototype operation',{outputs:[[call('call-1',{a:1,b:2,op:'constructor'})]]},/INVALID_TOOL_ARGUMENTS/],
 ['division by zero',{outputs:[[call('call-1',{a:1,b:0,op:'divide'})]]},/DIVISION_BY_ZERO/],
 ['unbounded number',{outputs:[[call('call-1',{a:1e10,b:2,op:'add'})]]},/INVALID_TOOL_ARGUMENTS/],
 ['overflow',{outputs:[[call('call-1',{a:1,b:1e-320,op:'divide'})]]},/INVALID_TOOL_RESULT/],
 ['tool limit',{outputs:[[call('a'),call('b'),call('c'),call('d')]]},/TOOL_LIMIT_REACHED/],
 ['model limit',{outputs:[[call('a')],[call('b')],[call('c')]]},/MODEL_LIMIT_REACHED/],
 ['empty final answer',{outputs:[[]]},/MODEL_EMPTY_RESPONSE/],
 ['HTTP failure',{httpStatus:429},/MODEL_HTTP_ERROR/],
 ['provider failure event',{frames:[{type:'response.failed',response:{error:{message:'private response content'}}}]},/MODEL_FAILED/],
 ['interrupted stream',{frames:[]},/MODEL_STREAM_INTERRUPTED/],
 ['malformed provider JSON',{frames:['invalid-json private-response']},/HARNESS_FAILED/],
 ['connection failure',{httpThrow:true},/MODEL_UNAVAILABLE/],
 ['deadline reserve',{remainingMs:400},/DEADLINE_REACHED/],
])test('handles '+name+' without leaking provider details',async()=>{
 const f=fixture(overrides);await assert.rejects(f.run(),error=>{assert.match(error.message,pattern);assert.doesNotMatch(error.message,/private|fixture-only-credential/);return true;});
 assert.equal(f.state.runs[0].status,'failed');
 assert.doesNotMatch(JSON.stringify(f.state.events),/private response content|fixture-only-credential/);
 if(!overrides.httpThrow && overrides.remainingMs===undefined)assert.equal(f.state.closes,f.state.requests.length);
});
test('event persistence failure poisons the queue and prevents tool execution',async()=>{
 const f=fixture({failPersistence:'tool.started'});await assert.rejects(f.run(),/HARNESS_FAILED/);
 assert.equal(f.state.runs[0].status,'failed');assert.equal(f.state.events.some(e=>e.event==='tool.completed'),false);
 assert.equal(f.state.requests.length,1);assert.ok(f.state.logs.some(message=>/event could not be persisted/.test(message)));
});
