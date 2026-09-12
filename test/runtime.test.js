'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { hash, read, inside, atomicWrite } = require('../src/runtime/files');
const p = require('../src/runtime/project');
const { update } = require('../src/runtime/update');
const { transaction, recover } = require('../src/runtime/transaction');
const { numeric, updateToml } = require('../src/runtime/toml');
const { main } = require('../src/runtime/cli');
function fixture(t) {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'paul-runtime-')); t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const root=path.join(dir,'.paul'); fs.mkdirSync(path.join(root,'phases/01-example'),{recursive:true});
  const write=(rel,text)=>atomicWrite(path.join(root,rel),text);
  write('STATE.md', '# State\n\n## Current Position\n\nMilestone: Test\nPlan: None\nLocal constraint: Preserve me\n\n## Loop Position\n\n```\nPLAN --> APPLY --> UNIFY\n ○        ○        ○\n```\nLoop note: Keep this too\n\n## Standing Rules\n\nNever commit without explicit approval. Fresh tests required.\n\n## Session Continuity\n\nNext action: /paul:plan\nCustom continuation: Important detail\n');
  write('PROJECT.md','# Project\n\n## Constraints\n\nNo data loss.\n\n## Something custom\n\nInspect this for task-specific rules.\n');
  write('ROADMAP.md','# Roadmap\n\n## Phase 1\n\nOne feature plus remaining scope.\n');
  write('paul.toml','[phase]\nnumber = 1\nplans_completed = 0\n[stats]\ntotal_plans = 0\n[custom]\nkeep = "exact" # comment\n');
  write('phases/01-example/01-01-PLAN.md','---\ndescription: "Test behavior"\n---\n<acceptance_criteria>\n## AC-1: Works\nObservable test.\n</acceptance_criteria>\n<tasks>\n<task type="auto"><name>Implement</name><files>app.js</files><action>Fix</action><verify>Check</verify><done>Works</done></task>\n</tasks>\n');
  fs.writeFileSync(path.join(dir,'app.js'),'works');
  const result=()=>({schema:1,plan_sha256:p.resolvePlan(root,'01-01').sha256,started:'2026-01-01T10:00:00Z',completed:'2026-01-01T10:01:00Z',outcome:'Works',acceptance:[{id:'AC-1',status:'pass',evidence:'Measured check passed'}],tasks:[{id:'task-1',status:'DONE',evidence:'Tested'}],files:[{path:'app.js',change:'Fixed'}],verification:['node check.js: exit 0'],decisions:[],deviations:[],issues:[],skills:[]});
  return {dir,root,write,result};
}
test('full loop preserves custom rules and counts only once',t=>{
 const f=fixture(t); p.planReady(f.root,'01-01'); p.approve(f.root,'01-01','Execute this plan'); p.applyComplete(f.root,'01-01',f.result());
 const closed=p.close(f.root,'01-01'); assert.equal(closed.result,'pass'); assert.equal(p.close(f.root,'01-01').unchanged,true);
 const state=read(path.join(f.root,'STATE.md')); for(const text of ['Local constraint: Preserve me','Loop note: Keep this too','Custom continuation: Important detail','Never commit without explicit approval']) assert.ok(state.includes(text));
 assert.equal(p.loopState(state),'closed'); const toml=read(path.join(f.root,'paul.toml')); assert.equal(numeric(toml,'stats','total_plans'),1); assert.ok(toml.includes('keep = "exact" # comment'));
 assert.equal((read(path.join(f.root,'ledger.toml')).match(/action = "unify"/g)||[]).length,1);
 assert.equal(p.phaseStatus(f.root,'1').phaseScopeReviewRequired,true);
});
test('plan revisions invalidate approvals and cannot reset applied work',t=>{
 const f=fixture(t); p.planReady(f.root,'01-01'); p.approve(f.root,'01-01','Approved'); const plan=p.resolvePlan(f.root,'01-01'); f.write(plan.path,plan.text+'\nRevised details\n');
 p.planReady(f.root,'01-01'); assert.throws(()=>p.applyComplete(f.root,'01-01',f.result()),/approval/); p.approve(f.root,'01-01','Approve revision');p.applyComplete(f.root,'01-01',f.result());
 f.write(plan.path,plan.text+'\nAnother revision\n');assert.throws(()=>p.planReady(f.root,'01-01'),/Previous loop/);
});
test('stale evidence blocks close; verified refresh is archived',t=>{
 const f=fixture(t);p.planReady(f.root,'01-01');p.approve(f.root,'01-01','Proceed');p.applyComplete(f.root,'01-01',f.result());
 fs.writeFileSync(path.join(f.dir,'app.js'),'changed');assert.equal(p.evidenceStatus(f.root,'01-01').declaredFilesUnchanged,false);assert.throws(()=>p.close(f.root,'01-01'),/changed/);
 const r=f.result();r.verification=['Fresh check after change: exit 0'];p.applyComplete(f.root,'01-01',r);assert.equal(p.close(f.root,'01-01').result,'pass');
 assert.ok(fs.readdirSync(path.join(f.root,'runtime/history')).length>=5);
});
test('invalid, missing and unapproved waived evidence cannot complete',t=>{
 const f=fixture(t);p.planReady(f.root,'01-01');assert.throws(()=>p.applyComplete(f.root,'01-01',f.result()),/approval/);p.approve(f.root,'01-01','Proceed');
 for(const mutate of [r=>r.acceptance=[],r=>r.tasks[0].evidence='',r=>r.acceptance[0].status='waived',r=>r.plan_sha256='stale']){const r=f.result();mutate(r);assert.throws(()=>p.applyComplete(f.root,'01-01',r));}
 assert.equal(fs.existsSync(path.join(f.root,'phases/01-example/01-01-RESULT.json')),false);
});
test('failed criteria are documented and block phase transition',t=>{
 const f=fixture(t);p.planReady(f.root,'01-01');p.approve(f.root,'01-01','Proceed');const r=f.result();r.acceptance[0].status='fail';p.applyComplete(f.root,'01-01',r);assert.equal(p.close(f.root,'01-01').result,'fail');
 assert.equal(numeric(read(path.join(f.root,'paul.toml')),'stats','total_plans'),0);
 assert.throws(()=>update(f.root,{schema:1,event_id:'transition',action:'transition',phase:'1',scope_evidence:'Reviewed'}),/Failed plan/);
});
test('legacy SUMMARY requires explicit review and does not double count',t=>{
 const f=fixture(t);p.planReady(f.root,'01-01');p.approve(f.root,'01-01','Proceed');p.applyComplete(f.root,'01-01',f.result());
 const rel=p.resolvePlan(f.root,'01-01').summary;f.write(rel,'Old valuable summary');assert.throws(()=>p.close(f.root,'01-01'),/Existing SUMMARY/);
 p.close(f.root,'01-01',{summary_sha256:hash('Old valuable summary'),evidence:'Reviewed old ledger: already counted',already_counted:true});
 assert.equal(numeric(read(path.join(f.root,'paul.toml')),'stats','total_plans'),0);
 const archives=fs.readdirSync(path.join(f.root,'runtime/history')).map(n=>read(path.join(f.root,'runtime/history',n)));assert.ok(archives.some(s=>s.includes('Old valuable summary')));
});
test('context is read-only, does not truncate rules, and inventories omitted sections',t=>{
 const f=fixture(t);const out=p.context(f.root,{plan:'01-01',budget:1});assert.equal(out.budget.truncated,false);assert.equal(out.budget.exceeded,true);assert.ok(out.state.text.includes('Fresh tests required'));assert.equal(out.project.otherSections[0].section,'Something custom');assert.equal(fs.existsSync(path.join(f.root,'runtime')),false);
 assert.throws(()=>p.context(f.root,{phase:'../bad'}),/Invalid phase/);assert.throws(()=>main(['context','--project',f.dir,'--budget','0']),/positive/);
});
test('reviewed section updates are atomic and idempotent; stale edits fail',t=>{
 const f=fixture(t);const doc=read(path.join(f.root,'ROADMAP.md'));const input={schema:1,event_id:'scope-1',action:'roadmap',edits:[{path:'ROADMAP.md',section:'Phase 1',sha256:hash(doc),content:'Updated scope'}]};
 update(f.root,input);assert.equal(update(f.root,input).unchanged,true);assert.throws(()=>update(f.root,{...input,event_id:'scope-2'}),/Stale edit/);assert.throws(()=>update(f.root,{...input,action:'pause'}),/reused/);
});
test('interrupted transaction can finish or roll back without overwriting concurrent edits',t=>{
 const f=fixture(t);const original=read(path.join(f.root,'STATE.md'));const journal={schema:1,operation:'test',changes:[{path:'STATE.md',before:original,after:'new'},{path:'new.md',before:null,after:'created'}]};
 f.write('runtime/transaction.json',JSON.stringify(journal));f.write('STATE.md','new');recover(f.root,'rollback');assert.equal(read(path.join(f.root,'STATE.md')),original);
 f.write('runtime/transaction.json',JSON.stringify(journal));recover(f.root,'finish');assert.equal(read(path.join(f.root,'new.md')),'created');
 f.write('runtime/transaction.json',JSON.stringify(journal));f.write('STATE.md','user edit');assert.throws(()=>recover(f.root,'rollback'),/Concurrent edit/);assert.equal(read(path.join(f.root,'new.md')),'created');
});
test('transaction refuses stale prerequisites and escaping paths',t=>{
 const f=fixture(t);assert.throws(()=>transaction(f.root,{'STATE.md':'bad'},'test',{'STATE.md':hash('stale')}),/Concurrent/);assert.throws(()=>inside(f.root,'../outside'),/Unsafe/);
 fs.symlinkSync(f.dir,path.join(f.root,'link'));assert.throws(()=>inside(f.root,'link/file'),/Symlink/);
});
test('decimal phase values and unknown TOML fields survive updates',()=>{
 const text='[phase]\nnumber = 2.1\nplans_completed = 3\n[custom]\nvalue = "retain"\n';assert.equal(numeric(text,'phase','number'),2.1);assert.ok(updateToml(text,{phase:{plans_completed:4}}).includes('value = "retain"'));assert.throws(()=>updateToml('[phase]\n"number" = 1\n',{phase:{number:2}}),/Quoted/);
});
test('phase completion requires scope evidence and exact plan-summary pairing',t=>{
 const f=fixture(t);assert.throws(()=>update(f.root,{schema:1,event_id:'x',action:'transition',phase:1}),/scope/);
 f.write('phases/01-example/01-99-SUMMARY.md','Unrelated summary');assert.equal(p.phaseStatus(f.root,'1').allReconciled,false);
});
test('explicit project .paul symlink supports evidence relative to the project',t=>{
 const f=fixture(t), evidence=f.result(), shared=path.join(f.dir,'shared-state');fs.renameSync(f.root,shared);fs.symlinkSync(shared,f.root);const root=p.projectRoot(f.dir);
 assert.equal(root,shared);p.planReady(root,'01-01');p.approve(root,'01-01','Proceed');const r={...evidence,plan_sha256:p.resolvePlan(root,'01-01').sha256};p.applyComplete(root,'01-01',r);
 fs.writeFileSync(path.join(f.dir,'app.js'),'changed');assert.equal(p.evidenceStatus(root,'01-01').declaredFilesUnchanged,false);
});
test('runtime bookkeeping listed in changed files does not immediately stale evidence',t=>{
 const f=fixture(t);p.planReady(f.root,'01-01');p.approve(f.root,'01-01','Proceed');const r=f.result();r.files.push({path:'.paul/STATE.md',change:'APPLY status'},{path:'.paul/paul.toml',change:'Sync'});p.applyComplete(f.root,'01-01',r);assert.equal(p.evidenceStatus(f.root,'01-01').declaredFilesUnchanged,true);assert.equal(p.close(f.root,'01-01').result,'pass');
});
test('TOML comments and string hash characters remain syntactically valid',()=>{
 const s=updateToml('[phase] # note\nname = "old # string" # actual comment\nnumber = "22" # number\n',{phase:{name:'new'}});assert.ok(s.includes('name = "new" # actual comment'));assert.equal(numeric(s,'phase','number'),22);assert.throws(()=>updateToml('["phase"]\nnumber = 1\n',{phase:{number:2}}),/Quoted/);assert.throws(()=>updateToml('phase.number = 1\n',{phase:{number:2}}),/Dotted/);
});
test('phase transition increments phase counter once and preserves summary evidence',t=>{
 const f=fixture(t);p.planReady(f.root,'01-01');p.approve(f.root,'01-01','Proceed');p.applyComplete(f.root,'01-01',f.result());p.close(f.root,'01-01');const roadmap=read(path.join(f.root,'ROADMAP.md'));
 const input={schema:1,event_id:'phase-1-complete',action:'transition',phase:'1',scope_evidence:'All roadmap deliverables independently verified',edits:[{path:'ROADMAP.md',section:'Phase 1',sha256:hash(roadmap),content:'Complete; scope verified'}]};
 update(f.root,input);update(f.root,input);assert.equal(numeric(read(path.join(f.root,'paul.toml')),'stats','total_phases'),1);assert.equal(p.phaseReport(f.root,'1').knownUniqueFiles,1);assert.throws(()=>update(f.root,{...input,event_id:'duplicate-phase-close'}),/already transitioned/);
});
test('unsafe nested update fails before any file or journal write',t=>{
 const f=fixture(t);const text='# Roadmap\n\n## Current Milestone\n\nOverview\n\n### Phase 1\n\nEvidence to retain\n';f.write('ROADMAP.md',text);
 for(const edits of [
  [{path:'ROADMAP.md',section:'Current Milestone',sha256:hash(text),content:'## Current Milestone\nDuplicated'}],
  [{path:'ROADMAP.md',section:'Current Milestone',sha256:hash(text),content:'Drops evidence'}],
  [{path:'ROADMAP.md',section:'Current Milestone',sha256:hash(text),content:'Overview\n### Phase 1\nRetained'}, {path:'ROADMAP.md',section:'Phase 1',sha256:hash(text),content:'Conflicting child edit'}]
 ]){assert.throws(()=>update(f.root,{schema:1,event_id:'bad-update',action:'roadmap',edits}));assert.equal(read(path.join(f.root,'ROADMAP.md')),text);assert.equal(fs.existsSync(path.join(f.root,'runtime')),false);}
});
test('parent intro plus child edit is safe and preserves neighboring sections',t=>{
 const f=fixture(t);const text='# Roadmap\n\n## Current Milestone\n\nOld intro\n\n### Phase 1\n\nOld status\n\n### Phase 2\n\nUntouched\n';f.write('ROADMAP.md',text);
 update(f.root,{schema:1,event_id:'nested-safe',action:'roadmap',edits:[{path:'ROADMAP.md',section:'Current Milestone',scope:'intro',sha256:hash(text),content:'New intro'},{path:'ROADMAP.md',section:'Phase 1',sha256:hash(text),content:'Complete'}]});
 assert.equal(read(path.join(f.root,'ROADMAP.md')),text.replace('Old intro','New intro').replace('Old status','Complete'));
});
test('core lifecycle adds no U+2014 to STATE or generated SUMMARY',t=>{
 const f=fixture(t),check=()=>assert.ok(!read(path.join(f.root,'STATE.md')).includes('\u2014'));
 p.planReady(f.root,'01-01');check();p.approve(f.root,'01-01','Proceed');check();p.applyComplete(f.root,'01-01',f.result());check();p.close(f.root,'01-01');check();assert.ok(!read(path.join(f.root,p.resolvePlan(f.root,'01-01').summary)).includes('\u2014'));
});
