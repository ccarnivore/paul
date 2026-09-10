'use strict';
const test=require('node:test'), assert=require('node:assert/strict'), fs=require('fs'),os=require('os'),path=require('path');
const {install,rollback,rewrite}=require('../src/runtime/install');
const {atomicWrite,read,walk,hash}=require('../src/runtime/files');
const source=path.resolve(__dirname,'..');
function fixture(t){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'paul-install-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return {dir,config:path.join(dir,'.claude')};}
function snapshot(dir){return Object.fromEntries(walk(dir).filter(f=>!f.includes('/paul-backups/')).map(f=>[path.relative(dir,f),hash(fs.readFileSync(f))]));}
test('dry run creates nothing; fresh installation and reinstallation are deterministic',t=>{
 const f=fixture(t);const preview=install(source,f.config,{dryRun:true});assert.ok(preview.changes.length>100);assert.equal(fs.existsSync(f.config),false);
 const result=install(source,f.config);assert.ok(result.backup);assert.equal(install(source,f.config).unchanged,true);
 assert.ok(read(path.join(f.config,'commands/paul/plan.md')).includes(f.config+'/paul-framework/workflows/plan-phase.md'));
 assert.ok(fs.existsSync(path.join(f.config,'paul-framework/runtime/cli.js')));
});
test('customized files block writes; explicit replacement backs up and rollback restores',t=>{
 const f=fixture(t);atomicWrite(path.join(f.config,'commands/paul/plan.md'),'My custom plan');atomicWrite(path.join(f.config,'commands/other.md'),'Other plugin');atomicWrite(path.join(f.dir,'.paul/STATE.md'),'project data');const before=snapshot(f.dir);
 assert.throws(()=>install(source,f.config),/Customized/);assert.deepEqual(snapshot(f.dir),before);
 const r=install(source,f.config,{replaceCustomized:true});assert.equal(read(path.join(f.dir,'.paul/STATE.md')),'project data');assert.equal(read(path.join(f.config,'commands/other.md')),'Other plugin');rollback(f.config,r.backup);assert.deepEqual(snapshot(f.dir),before);
});
test('extension tails and unowned commands survive subsequent upgrades',t=>{
 const f=fixture(t);install(source,f.config);const file=path.join(f.config,'paul-framework/workflows/plan-phase.md');atomicWrite(file,read(file).split('\n## Extensions\n')[0]+'\n## Extensions\n\nCustom extension rules\n');atomicWrite(path.join(f.config,'commands/paul/custom.md'),'user command');
 const r=install(source,f.config);assert.deepEqual(r.conflicts,[]);assert.ok(read(file).includes('Custom extension rules'));assert.equal(read(path.join(f.config,'commands/paul/custom.md')),'user command');
});
test('rollback rejects later edits and corrupted backups before touching files',t=>{
 const f=fixture(t);atomicWrite(path.join(f.config,'commands/paul/plan.md'),'custom');const r=install(source,f.config,{replaceCustomized:true});
 const file=path.join(f.config,'commands/paul/plan.md');atomicWrite(file,read(file)+'later edit');const before=snapshot(f.config);assert.throws(()=>rollback(f.config,r.backup),/after installation/);assert.deepEqual(snapshot(f.config),before);
 atomicWrite(path.join(f.config,'paul-backups',r.backup,'files/commands/paul/plan.md'),'corrupt');assert.throws(()=>rollback(f.config,r.backup),/Corrupted/);
});
test('installer rejects symlink targets and malicious ownership paths',t=>{
 const f=fixture(t);fs.mkdirSync(f.config);fs.symlinkSync(f.dir,path.join(f.config,'paul-framework'));assert.throws(()=>install(source,f.config),/Symlink/);fs.unlinkSync(path.join(f.config,'paul-framework'));
 atomicWrite(path.join(f.config,'paul-install.json'),JSON.stringify({files:{'../outside':'hash'}}));assert.throws(()=>install(source,f.config),/Not a PAUL/);assert.equal(fs.existsSync(path.join(f.dir,'outside')),false);
});
test('only framework references are rewritten',()=>{
 const s=rewrite('@src/workflows/plan-phase.md @src/app.js @~/.claude/paul-framework/rules/a.md','/target/.claude/');assert.ok(s.includes('@/target/.claude/paul-framework/workflows/plan-phase.md'));assert.ok(s.includes('@src/app.js'));assert.ok(!s.includes('~/.claude/'));
});
test('baseline upstream files can be replaced without custom override',t=>{
 const f=fixture(t);const original=fs.readFileSync(path.join(source,'src/documentation/plan-phase-guide.md'),'utf8').split('\n\n').slice(1).join('\n\n');
 // Original source uses the same paths as stock v1.4 installs after substitution.
 const stock=original.replaceAll('~/.claude/',f.config+'/');atomicWrite(path.join(f.config,'paul-framework/workflows/plan-phase.md'),stock);
 assert.deepEqual(install(source,f.config,{dryRun:true}).conflicts,[]);
});
test('partial installation can roll back files already in either before or after state',t=>{
 const f=fixture(t);atomicWrite(path.join(f.config,'commands/paul/plan.md'),'custom');const r=install(source,f.config,{replaceCustomized:true});
 // Simulate a hard interruption during rollback: one old file already restored.
 atomicWrite(path.join(f.config,'commands/paul/plan.md'),'custom');rollback(f.config,r.backup);assert.equal(read(path.join(f.config,'commands/paul/plan.md')),'custom');assert.equal(fs.existsSync(path.join(f.config,'commands/paul/apply.md')),false);
 assert.equal(rollback(f.config,r.backup).restored,r.backup);
});
test('installation write failure restores original content',t=>{
 const f=fixture(t);atomicWrite(path.join(f.config,'commands/paul/plan.md'),'custom');const before=snapshot(f.config),rename=fs.renameSync;
 fs.renameSync=function(from,to){if(to===path.join(f.config,'commands/paul/apply.md'))throw new Error('injected disk error');return rename.apply(this,arguments);};
 try{assert.throws(()=>install(source,f.config,{replaceCustomized:true}),/injected disk error/);}finally{fs.renameSync=rename;}
 assert.deepEqual(snapshot(f.config),before);
});
test('unchanged upstream core keeps local customization',t=>{
 const f=fixture(t);atomicWrite(path.join(f.config,'commands/paul/handoff.md'),'local handoff logic');const r=install(source,f.config);assert.ok(r.preservedCustomized.includes('commands/paul/handoff.md'));assert.equal(read(path.join(f.config,'commands/paul/handoff.md')),'local handoff logic');
});
