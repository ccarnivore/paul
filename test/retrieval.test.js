'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('fs'), os = require('os'), path = require('path');
const p = require('../src/runtime/project'), r = require('../src/runtime/retrieval');
const { main } = require('../src/runtime/cli');
const { hash, walk } = require('../src/runtime/files');
function fixture(t) {
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'paul-retrieval-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const root=path.join(dir,'.paul'), rel='phases/01-example/01-01';
 fs.mkdirSync(path.join(root,'phases/01-example'),{recursive:true});
 const write=(rel,text)=>fs.writeFileSync(path.join(root,rel),text);
 write(rel+'-PLAN.md','---\ndescription: "Example"\n---\n<acceptance_criteria>\n## AC-1: Behavior\nCheck it\n</acceptance_criteria>\n<task type="auto"><name>Implement</name></task>\n');
 const plan=p.resolvePlan(root,'01-01');
 const evidence={schema:1,plan_sha256:plan.sha256,outcome:'A delivered outcome with a limitation.',started:'2026-01-01T00:00:00Z',completed:'2026-01-01T00:01:00Z',
 acceptance:[{id:'AC-1',status:'waived',evidence:'checks '.repeat(1200)+'RUNTIME CHECK STILL OPEN',user_approval:'User accepted this specific missing check'}],
 tasks:[{id:'task-1',status:'DONE_WITH_CONCERNS',evidence:'Measured check'}],files:[{path:'src/example.js',change:'Fixed'}],
 issues:['Missing runtime proof; do not silently count it as measured.'],deviations:['Scope narrowed by user.'],decisions:['Keep boundary.'],verification:['test command: exit 0'],skills:['Required skill used']};
 const save=()=>{write(rel+'-RESULT.json',JSON.stringify(evidence,null,2));const summary=p.renderSummary(plan,evidence).text;write(rel+'-SUMMARY.md',summary);fs.mkdirSync(path.join(root,'runtime'),{recursive:true});write('runtime/receipts.json',JSON.stringify({['unify:'+plan.path]:{summaryHash:hash(summary),planHash:plan.sha256}}));};save();
 const snapshot=()=>Object.fromEntries(walk(root).map(f=>[f,hash(fs.readFileSync(f))]));
 return {dir,root,rel,plan,evidence,write,save,snapshot};
}
test('SUMMARY avoids duplicate evidence but retains outcome, decisions, concerns and actual waiver',t=>{
 const f=fixture(t), old=JSON.stringify(f.evidence), s=p.renderSummary(f.plan,f.evidence);
 assert.equal(s.status,'waived');assert.equal(s.text.split(f.evidence.outcome).length-1,1);
 for(const field of ['decisions','deviations','issues'])for(const v of f.evidence[field])assert.ok(s.text.includes(v));
 assert.ok(s.text.includes('User accepted this specific missing check'));assert.ok(s.text.includes('DONE_WITH_CONCERNS'));
 assert.ok(!s.text.includes('checks '.repeat(100)));assert.ok(s.text.includes('01-01-RESULT.json'));
 assert.equal(JSON.stringify(f.evidence),old);assert.ok(s.text.length<3000);
});
test('handoff paginates every record without changing hashes or dropping late concerns',t=>{
 const f=fixture(t);f.evidence.issues=Array.from({length:35},(_,i)=>`Concern ${i}: `+'detail '.repeat(100));f.save();
 const before=f.snapshot(), seen=[];let offset=0;
 do{const out=p.handoff(f.root,'01-01',{offset,budget:2500});assert.ok(JSON.stringify(out,null,2).length<=2500);seen.push(...out.entries);offset=out.nextOffset;}while(offset!==null);
 assert.equal(seen.filter(e=>e.field==='issues').length,35);assert.ok(seen.find(e=>e.field==='issues'&&e.index===34).truncated);
 assert.deepEqual(f.snapshot(),before);
});
test('result-section retrieves a late qualification exactly through pagination and by ID',t=>{
 const f=fixture(t),before=f.snapshot();let offset=0,text='';
 do{const out=main(['result-section','--project',f.dir,'--plan','01-01','--field','acceptance','--item','AC-1','--offset',String(offset),'--limit','1000']);text+=out.text;offset=out.nextOffset;}while(offset!==null);
 assert.deepEqual(JSON.parse(text),f.evidence.acceptance[0]);assert.ok(text.includes('RUNTIME CHECK STILL OPEN'));
 assert.deepEqual(f.snapshot(),before);
 assert.throws(()=>p.resultSection(f.root,'01-01',{field:'unknown'}),/field/);
 assert.throws(()=>p.resultSection(f.root,'01-01',{field:'acceptance',item:'AC-99'}),/not found/);
});
test('stale RESULT is flagged and does not replace legacy SUMMARY context',t=>{
 const f=fixture(t);f.evidence.plan_sha256='outdated';f.save();
 const h=p.handoff(f.root,'01-01');assert.equal(h.source,'summary');assert.ok(h.resultMismatch);
 assert.equal(p.resultSection(f.root,'01-01',{field:'issues'}).planMatches,false);
});
test('legacy German and custom headings remain discoverable with bounded complete reads',t=>{
 const f=fixture(t);fs.unlinkSync(path.join(f.root,f.rel+'-RESULT.json'));
 f.write(f.rel+'-SUMMARY.md','# Summary\n\n## Eigene Vorgaben\n\n'+'regel '.repeat(1200)+'\n\n### Offene Nachweise\n\nNiemals als erledigt markieren.\n');
 const h=p.handoff(f.root,'01-01');assert.equal(h.recordedStatus,'legacy-unverified');
 assert.ok(h.entries.find(e=>e.heading==='Eigene Vorgaben').truncated);assert.ok(h.entries.find(e=>e.heading==='Offene Nachweise'));
 const s=main(['section','--project',f.dir,'--file',f.rel+'-SUMMARY.md','--heading','Eigene Vorgaben','--limit','300']);assert.equal(s.text.length,300);assert.equal(s.nextOffset,300);
 const full=main(['section','--project',f.dir,'--file',f.rel+'-SUMMARY.md','--heading','Eigene Vorgaben']);assert.ok(full.text.includes('Niemals als erledigt markieren.'));
});
test('history ranks separate case-insensitive terms and searches evidence omitted from SUMMARY',t=>{
 const f=fixture(t);f.evidence.acceptance[0].evidence='CSV\nFormat\nLieferant\nSysConfig';f.save();
 f.write('phases/01-example/01-02-SUMMARY.md','# Summary\nCSV only');
 const h=p.history(f.root,'CSV Format Lieferant SysConfig',5);
 assert.equal(h.total,2);assert.ok(h.results[0].path.endsWith('01-01-SUMMARY.md'));assert.equal(h.results[0].matchedTerms.length,4);
 assert.ok(h.results[0].matches.some(m=>m.file.endsWith('RESULT.json')));
 assert.equal(p.history(f.root,'NoSuchTerm',5).total,0);
});
test('huge single-line history matches are bounded, located and pageable',t=>{
 const f=fixture(t);for(let i=2;i<9;i++)f.write(`phases/01-example/01-${String(i).padStart(2,'0')}-SUMMARY.md`,'# Summary\n'+'A'.repeat(20000)+'CSV'+'B'.repeat(20000));
 const before=f.snapshot();let offset=0, paths=[];
 do{const h=main(['history','--project',f.dir,'--query','CSV','--budget','2500','--offset',String(offset)]);assert.ok(JSON.stringify(h,null,2).length<=2500);paths.push(...h.results.map(x=>x.path));for(const e of h.results){assert.ok(e.matches[0].text.includes('CSV'));assert.equal(e.matches[0].truncated,true);}offset=h.nextOffset;}while(offset!==null);
 assert.equal(new Set(paths).size,7);assert.equal(paths.length,7);assert.deepEqual(f.snapshot(),before);
});
test('plan-check is advisory, reports byte size and never registers a plan',t=>{
 const f=fixture(t);f.write(f.rel+'-PLAN.md',f.plan.text+'\n'+'Implementation detail. '.repeat(400));const before=f.snapshot();
 const c=main(['plan-check','--project',f.dir,'--plan','01-01']);assert.equal(c.exceeded,true);assert.deepEqual(c.ac,['AC-1']);assert.ok(c.bytes>6144);assert.deepEqual(f.snapshot(),before);
});
test('pagination refuses invalid bounds and never silently skips an oversized entry',t=>{
 const f=fixture(t);assert.throws(()=>p.handoff(f.root,'01-01',{offset:-1}),/integer/);assert.throws(()=>p.handoff(f.root,'01-01',{budget:1}),/integer/);
 assert.throws(()=>p.resultSection(f.root,'01-01',{field:'issues',limit:0}),/integer/);
 assert.throws(()=>p.history(f.root,'CSV',21),/integer/);
});

test('manual SUMMARY corrections and pre-heading context are not hidden by matching RESULT',t=>{
 const f=fixture(t);f.write(f.rel+'-SUMMARY.md','# Summary\n\nUser correction before headings.\n\n## New boundary\n\nDo not touch the new billing module.\n');
 const h=p.handoff(f.root,'01-01');assert.equal(h.source,'result+summary');assert.ok(h.summaryReviewRequired);
 assert.ok(h.entries.some(e=>e.text.includes('User correction before headings')));
 assert.ok(h.entries.some(e=>e.heading==='New boundary'));
});
