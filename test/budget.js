'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert');
const baseline=require('./budget-baseline.json');
const current={plan:['commands/plan.md','workflows/plan-phase.md','references/runtime.md','templates/PLAN.md'],apply:['commands/apply.md','workflows/apply-phase.md','references/runtime.md','references/runtime-result.md'],unify:['commands/unify.md','workflows/unify-phase.md','references/runtime.md','references/runtime-result.md','templates/SUMMARY.md']};
let before=0,after=0;const stages={};
for(const [stage,files] of Object.entries(current)){const chars=files.reduce((n,f)=>n+Array.from(fs.readFileSync(path.join(__dirname,'../src',f),'utf8')).length,0);const original=baseline.stages[stage];stages[stage]={beforeChars:original,afterChars:chars,reductionPercent:Math.round((1-chars/original)*1000)/10};before+=original;after+=chars;}
assert.ok(after/before<0.5,'Core framework context exceeded 50% of baseline; inspect expanded mandatory reading');
console.log(JSON.stringify({method:baseline.method,conservativeColdLoad:true,stages,total:{beforeChars:before,afterChars:after,reductionPercent:Math.round((1-after/before)*1000)/10},warning:'Character proxy, not tokenizer counts or observed session savings. Includes runtime contract separately in every stage, result contract in APPLY and UNIFY; conditional reference costs vary.'},null,2));
