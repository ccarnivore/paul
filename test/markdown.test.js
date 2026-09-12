'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { headings, replaceSection } = require('../src/runtime/markdown');
const roadmap = '# Roadmap\n\n## Current Milestone\n\nOverview.\n\n### Phase 15\n\nKeep phase 15 evidence.\n\n### Phase 16\n\nOld phase 16 status.\n\n## Next Milestone\n\nKeep future scope.\n';
test('replace a nested phase without promoting or moving its heading',()=>{
 const updated=replaceSection(roadmap,'Phase 16','Verified complete.');
 assert.equal(updated,roadmap.replace('Old phase 16 status.','Verified complete.'));
 assert.deepEqual(headings(updated).map(h=>[h.level,h.title]),headings(roadmap).map(h=>[h.level,h.title]));
});
test('reject supplied own heading instead of duplicating it',()=>{
 assert.throws(()=>replaceSection(roadmap,'Current Milestone','## Current Milestone\nChanged'),/exclude its own heading/);
 assert.throws(()=>replaceSection(roadmap,'Phase 16','### Phase 16\nChanged'),/exclude its own heading/);
});
test('reject parent replacements that drop nested sections',()=>{
 assert.throws(()=>replaceSection(roadmap,'Current Milestone','New overview.'),/remove a child heading/);
});
test('intro replacement preserves all nested content exactly',()=>{
 const updated=replaceSection(roadmap,'Current Milestone','New overview.',{scope:'intro'});
 assert.equal(updated,roadmap.replace('Overview.','New overview.'));
});
test('unknown headings fail instead of appending new top-level sections',()=>{
 assert.throws(()=>replaceSection(roadmap,'Phase 99','Complete'),/Section not found/);
});
test('heading scanner respects tilde and longer backtick fences and H1 boundaries',()=>{
 const text='## Real\n~~~~markdown\n### Not a section\n~~~\n## Still fenced\n~~~~\n````markdown\n```\n## Fenced example\n````\n### Real child\nBody\n# New document\n## C#\nEnd\n';
 assert.deepEqual(headings(text).map(h=>h.title),['Real','Real child','New document','C#']);
 assert.ok(!headings(text)[0].text.includes('# New document'));
});
test('replacement cannot introduce duplicate child headings or a sibling heading',()=>{
 assert.throws(()=>replaceSection(roadmap,'Current Milestone','### Phase 15\nA\n### Phase 16\nB\n### Phase 16\nC'),/Duplicate child/);
 assert.throws(()=>replaceSection(roadmap,'Phase 16','## Next Milestone\nWrong'),/sibling\/parent/);
});
