'use strict';
const fs = require('fs');
const path = require('path');
const { hash, read, digest, inside, walk } = require('./files');
const { sections, section, replaceSection, frontmatter, parsePlan } = require('./markdown');
const { transaction } = require('./transaction');
const { updateToml, numeric } = require('./toml');
const VERSION = (() => { try { return require('../package.json').version; } catch { return require('../../package.json').version; } })();

const projectDirectories = new Map();
function projectRoot(project) {
  const selected = path.join(path.resolve(project), '.paul');
  const root = fs.existsSync(selected) ? fs.realpathSync(selected) : selected;
  projectDirectories.set(root, path.resolve(project));
  if (!fs.existsSync(root)) throw new Error('No .paul directory. Run /paul:init first.');
  return root;
}
function inventory(root) {
  return walk(inside(root, 'phases')).filter(f => /-(?:PLAN|FIX|SUMMARY|RESULT)\.(?:md|json)$/.test(f)).map(f => path.relative(root, f).split(path.sep).join('/'));
}
function resolvePlan(root, argument) {
  let rel = argument;
  if (!rel) {
    const s = read(inside(root, 'STATE.md')) || '';
    const next = section(s, 'Session Continuity');
    const explicit = next.match(/(?:Resume file:\s*|\/paul:(?:apply|unify)\s+)([^\s`]*-(?:PLAN|FIX)\.md)/);
    rel = explicit?.[1] || next.match(/\/paul:(?:apply|unify)\s+(\d+(?:\.\d+)?-\d+(?:-FIX)?)/)?.[1];
    if (!rel) {
      const pos = section(s, 'Current Position');
      rel = pos.match(/^Plan:\s*(?:\*\*)?(\d+(?:\.\d+)?-\d+(?:-FIX)?)/m)?.[1];
    }
    if (!rel) throw new Error('Cannot unambiguously identify a plan. Pass --plan ID or .paul-relative path.');
  }
  if (path.isAbsolute(rel)) rel = path.relative(root, rel).split(path.sep).join('/');
  rel = rel.replace(/^\.\//, '').replace(/^\.paul\//, '');
  if (!rel.includes('/')) {
    const candidates = inventory(root).filter(p => [rel, `${rel}-PLAN.md`, `${rel}.md`].includes(path.basename(p)) && /-(PLAN|FIX)\.md$/.test(p));
    if (candidates.length !== 1) throw new Error(`Plan ${rel}: expected one match, found ${candidates.length}`);
    rel = candidates[0];
  }
  const file = inside(root, rel), text = read(file);
  if (!text) throw new Error(`Plan not found: ${rel}`);
  const plan = parsePlan(text, rel);
  if (plan.errors.length) throw new Error(plan.errors.join('; '));
  const summary = rel.replace(/(?:-PLAN|-FIX)\.md$/, m => m === '-FIX.md' ? '-FIX-SUMMARY.md' : '-SUMMARY.md');
  return { ...plan, text, summary, result: summary.replace(/-SUMMARY\.md$/, '-RESULT.json') };
}
function loopState(text) {
  const body = section(text, 'Loop Position');
  const rows = body.split('\n').map(l => l.match(/[✓○◉►]/g)).filter(x => x && x.length === 3);
  if (rows.length !== 1) return 'unknown';
  const [p,a,u] = rows[0];
  if (p === '✓' && a === '✓' && u === '✓') return 'closed';
  if (p === '✓' && a === '✓') return 'applied';
  if (p === '✓') return 'planned';
  if (a === '○' && u === '○') return 'idle';
  return 'unknown';
}
function snapshot(root) {
  const result = {};
  for (const rel of ['STATE.md','PROJECT.md','ROADMAP.md','paul.toml','ledger.toml','runtime/receipts.json','runtime/approvals.json']) result[rel] = digest(inside(root, rel));
  return result;
}
function jsonFile(root, rel, fallback) { const t = read(inside(root, rel)); return t ? JSON.parse(t) : fallback; }
function phaseStatus(root, phase) {
  const plans = inventory(root).filter(p => new RegExp(`^phases/0*${phase.replace(/\./g,'\\.')}-[^/]+/`).test(p) && /-(PLAN|FIX)\.md$/.test(p));
  const entries = plans.map(p => {
    const plan = resolvePlan(root, p), sum = read(inside(root, plan.summary));
    const fm = sum ? frontmatter(sum) : {};
    return { id: plan.id, plan: p, summary: sum ? plan.summary : null, status: fm.result || (sum ? 'legacy-unverified' : 'open') };
  });
  return { phase, plans: entries, allReconciled: !!entries.length && entries.every(e => e.summary), allPassed: !!entries.length && entries.every(e => ['pass','waived'].includes(e.status)), phaseScopeReviewRequired: true };
}

function phaseReport(root, phase) {
  if (!/^\d+(?:\.\d+)?$/.test(String(phase))) throw new Error('Invalid phase');
  const status = phaseStatus(root, String(phase));
  const files = new Set(), timestamps = [], reports = [];
  let missingFileMetadata = 0;
  for (const entry of status.plans) {
    if (!entry.summary) continue;
    const text = read(inside(root, entry.summary)), fm = frontmatter(text);
    const plan = resolvePlan(root, entry.plan), result = jsonFile(root, plan.result, null);
    if (result?.files) for (const file of result.files) files.add(file.path);
    else missingFileMetadata++;
    for (const key of ['started','completed']) if (Number.isFinite(Date.parse(fm[key]))) timestamps.push(Date.parse(fm[key]));
    const excerpts = ['Accomplishments','Decisions Made','Issues Encountered','Deviations from Plan'].map(title => {
      const body = section(text, title);
      return { section: title, text: body.slice(0,2000), truncated: body.length > 2000 };
    });
    reports.push({ ...entry, sha256: hash(text), description: fm.description || '', started: fm.started || null, completed: fm.completed || null, excerpts });
  }
  return { ...status, summaries: reports, knownUniqueFiles: files.size, summariesWithoutStructuredFileMetadata: missingFileMetadata,
    observedStart: timestamps.length ? new Date(Math.min(...timestamps)).toISOString() : null,
    observedEnd: timestamps.length ? new Date(Math.max(...timestamps)).toISOString() : null,
    instruction: 'Metadata and bounded excerpts only. Open truncated/relevant sections for complete decisions, blockers and verification. Missing legacy fields are unknown, not zero. Review explicit roadmap scope.' };
}

function context(root, options = {}) {
  const state = read(inside(root, 'STATE.md')) || '';
  const project = read(inside(root, 'PROJECT.md')) || '';
  const roadmap = read(inside(root, 'ROADMAP.md')) || '';
  let plan = null;
  if (options.plan) plan = resolvePlan(root, options.plan);
  const requiredSections = sections(project).filter(s => /constraint|decision|boundar|rule|core value/i.test(s.title));
  const phase = options.phase || plan?.phase;
  if (phase && !/^\d+(?:\.\d+)?$/.test(String(phase))) throw new Error('Invalid phase');
  const available = [];
  if (phase) {
    for (const f of walk(inside(root, 'phases'))) {
      const rel = path.relative(root, f).split(path.sep).join('/');
      if (new RegExp(`^phases/0*${String(phase).replace(/\./g,'\\.')}-`).test(rel) && /(?:CONTEXT|RESEARCH|DISCOVERY)\.md$/.test(rel)) available.push({ path: `.paul/${rel}`, sha256: digest(f), chars: fs.statSync(f).size });
    }
  }
  const refs = ['SPECIAL-FLOWS.md','config.md','ISSUES.md'].filter(p => fs.existsSync(inside(root,p))).map(p => `.paul/${p}`);
  const output = {
    schema: 1, mode: 'read-only', revisions: snapshot(root), loop: loopState(state),
    state: { path: '.paul/STATE.md', text: state },
    project: { path: '.paul/PROJECT.md', required: requiredSections.map(s => ({ section: s.title, text: s.text })), otherSections: sections(project).filter(s => !requiredSections.some(r => r.title === s.title)).map(s => ({ section: s.title, chars: s.text.length })) },
    roadmap: { path: '.paul/ROADMAP.md', sections: sections(roadmap).map(s => ({ section: s.title, chars: s.text.length })) },
    plan: plan ? { id: plan.id, path: `.paul/${plan.path}`, sha256: plan.sha256, ac: plan.ac, tasks: plan.tasks, result: `.paul/${plan.result}` } : null,
    phase: phase ? phaseStatus(root, String(phase)) : null, availableContext: available, conditionalReads: refs,
    instructions: 'STATE is complete, including project overrides. Read the selected plan and relevant roadmap scope. Review listed project sections for additional task requirements; unknown headings are not assumed irrelevant. Read required skills/config and relevant context artifacts before execution. History is searchable with history --query. No archived constraints are automatically assumed obsolete.',
  };
  const chars = JSON.stringify(output).length;
  output.budget = { chars, targetChars: options.budget || 16000, exceeded: chars > (options.budget || 16000), truncated: false };
  return output;
}
function history(root, query = '', limit = 5, options = {}) {
  return require('./retrieval').history(root, query, limit, options);
}
function handoff(root, argument, options = {}) {
  return require('./retrieval').handoff(root, resolvePlan(root, argument), options);
}
function resultSection(root, argument, options = {}) {
  return require('./retrieval').resultSection(root, resolvePlan(root, argument), options);
}
function planCheck(root, argument) {
  const plan = resolvePlan(root, argument), bytes = Buffer.byteLength(plan.text), targetBytes = 6144;
  return { plan: plan.id, path: `.paul/${plan.path}`, sha256: plan.sha256, bytes, targetBytes,
    exceeded: bytes > targetBytes, ac: plan.ac, tasks: plan.tasks,
    instruction: bytes > targetBytes ? 'Soft target exceeded. Retain all requirements. Remove duplicated explanations with targeted edits if useful; do not reprint/rewrite the entire plan just to shrink it.' : 'Structure parsed. Review semantics, scope, skills, AC coverage and verification; size is not evidence of quality.' };
}
function updateState(state, plan, stage, next, result = '') {
  // Change only known scalar fields; retain all other text, including local rules.
  function fields(text, heading, values) {
    let body = section(text, heading);
    for (const [key, value] of Object.entries(values)) {
      const pattern = new RegExp('^' + key + ':.*$', 'gm');
      const matches = body.match(pattern) || [];
      if (matches.length > 1) throw new Error(`Ambiguous state field: ${heading}/${key}`);
      body = matches.length ? body.replace(pattern, () => `${key}: ${value}`) : body.trimEnd() + `\n${key}: ${value}`;
    }
    return replaceSection(text, heading, body);
  }
  let out = fields(state, 'Current Position', {
    Phase: `${plan.phase} (${path.basename(path.dirname(plan.path))})`, Plan: plan.id,
    Status: `${stage}${result ? ' - ' + result : ''}`, 'Last activity': `${new Date().toISOString()} - ${plan.id}`
  });
  const marks = stage === 'PLAN' ? '✓        ○        ○' : stage === 'APPLY' ? '✓        ✓        ○' : '✓        ✓        ✓';
  const oldLoop = section(out, 'Loop Position');
  const rows = oldLoop.split('\n').filter(l => (l.match(/[✓○◉►]/g) || []).length === 3);
  if (rows.length !== 1) throw new Error('Ambiguous loop markers; review STATE.md');
  out = replaceSection(out, 'Loop Position', oldLoop.replace(rows[0], () => '  ' + marks));
  return fields(out, 'Session Continuity', {
    'Last session': new Date().toISOString(), 'Stopped at': `${stage} ${plan.id}`,
    'Next action': next, 'Resume file': `.paul/${stage === 'UNIFY' ? plan.summary : plan.path}`
  });
}
function syncFiles(root, action, plan, result, receipts, timestamp) {
  const manifest = read(inside(root, 'paul.toml'));
  const out = {};
  if (manifest !== null) {
    const changes = { paul: { version: VERSION }, stats: { last_activity: timestamp }, loop: { position: action.toUpperCase(), plan: plan.id, plan_path: plan.path } };
    if (action === 'plan') {
      changes.phase = { number: Number(plan.phase), name: path.basename(path.dirname(plan.path)).replace(/^[\d.]+-/, ''), status: 'in_progress' };
      if (numeric(manifest, 'phase', 'number') !== Number(plan.phase)) changes.phase.plans_completed = 0;
    }
    if (action === 'unify') {
      changes.loop = { position: 'IDLE', plan: null, plan_path: null };
      if (result !== 'fail') {
        changes.phase = { plans_completed: numeric(manifest, 'phase', 'plans_completed') + 1 };
        changes.stats.total_plans = numeric(manifest, 'stats', 'total_plans') + 1;
      }
    }
    out['paul.toml'] = updateToml(manifest, changes);
  }
  const phase = Number(plan.phase);
  const ledger = read(inside(root, 'ledger.toml')) || '# PAUL session history; append-only.\n';
  out['ledger.toml'] = ledger.trimEnd() + `\n\n[[entry]]\naction = ${JSON.stringify(action)}\nphase = ${phase}\nplan = ${JSON.stringify(plan.id)}\nat = ${JSON.stringify(timestamp)}\n`;
  out['runtime/receipts.json'] = JSON.stringify(receipts, null, 2) + '\n';
  return out;
}
function planReady(root, argument) {
  const before = snapshot(root), plan = resolvePlan(root, argument);
  const state = read(inside(root, 'STATE.md')) || '';
  const receipts = jsonFile(root, 'runtime/receipts.json', {});
  const key = `plan:${plan.path}:${plan.sha256}`;
  if (receipts[key]) return { unchanged: true, plan: plan.id };
  if (!['idle','closed'].includes(loopState(state)) && !(loopState(state) === 'planned' && resolvePlan(root).path === plan.path)) throw new Error('Previous loop is open or ambiguous. Reconcile it before creating another plan.');
  if (fs.existsSync(inside(root, plan.summary))) throw new Error('This plan already has a summary. Use a new plan ID for new work.');
  receipts[key] = { at: new Date().toISOString() };
  const updates = syncFiles(root, 'plan', plan, null, receipts, receipts[key].at);
  updates['STATE.md'] = updateState(state, plan, 'PLAN', `/paul:apply ${plan.id} after explicit plan approval`);
  before[plan.path] = plan.sha256;
  return { plan: plan.id, ...transaction(root, updates, 'plan-ready', before) };
}
function approve(root, argument, signal) {
  if (!signal || !signal.trim()) throw new Error('Provide --signal containing the actual user approval. Do not infer approval.');
  const plan = resolvePlan(root, argument), rel = 'runtime/approvals.json';
  const before = { [rel]: digest(inside(root, rel)), [plan.path]: plan.sha256 };
  const approvals = jsonFile(root, rel, {});
  approvals[plan.path] = { sha256: plan.sha256, signal, at: new Date().toISOString() };
  return transaction(root, { [rel]: JSON.stringify(approvals, null, 2) + '\n' }, 'approve', before);
}
function validateResult(plan, result) {
  if (result.schema !== 1 || result.plan_sha256 !== plan.sha256) throw new Error('Result schema or plan SHA256 does not match current plan');
  if (typeof result.outcome !== 'string' || !result.outcome.trim()) throw new Error('Result requires a substantive outcome');
  for (const [key, expected, statuses] of [['acceptance',plan.ac,['pass','fail','waived']],['tasks',plan.tasks.map(t => t.id),['DONE','DONE_WITH_CONCERNS','BLOCKED','SKIPPED']]]) {
    const items = result[key];
    if (!Array.isArray(items) || items.length !== expected.length || new Set(items.map(i => i.id)).size !== expected.length) throw new Error(`Result must cover every ${key} ID exactly once`);
    for (const i of items) {
      if (!expected.includes(i.id) || !statuses.includes(i.status) || typeof i.evidence !== 'string' || !i.evidence.trim()) throw new Error(`Invalid ${key} evidence: ${i.id}`);
      if (['waived','SKIPPED'].includes(i.status) && (typeof i.user_approval !== 'string' || !i.user_approval.trim())) throw new Error(`Explicit user approval required for ${i.id}`);
    }
  }
  for (const key of ['files','decisions','deviations','issues','skills','verification']) if (!Array.isArray(result[key])) throw new Error(`Result requires ${key} array (empty is allowed)`);
  for (const f of result.files) if (!f || typeof f.path !== 'string' || typeof f.change !== 'string') throw new Error('Each file needs path and change');
  for (const key of ['decisions','deviations','issues','skills','verification']) for (const item of result[key]) if (typeof item !== 'string' || !item.trim()) throw new Error(`${key} entries must be nonempty strings`);
  for (const key of ['started','completed']) if (typeof result[key] !== 'string' || !Number.isFinite(Date.parse(result[key]))) throw new Error(`Valid ${key} timestamp required`);
  if (Date.parse(result.completed) < Date.parse(result.started)) throw new Error('Completion precedes start');
}
function fileFingerprints(project, files) {
  return files.map(f => {
    const file = path.resolve(project, f.path);
    // This reads explicitly declared evidence files; all runtime writes stay in .paul.
    if (fs.existsSync(file) && !fs.statSync(file).isFile()) throw new Error(`Evidence path is not a file: ${f.path}`);
    return { path: f.path, sha256: digest(file) };
  });
}
function applyComplete(root, argument, result) {
  const before = snapshot(root), plan = resolvePlan(root, argument);
  const approval = jsonFile(root, 'runtime/approvals.json', {})[plan.path];
  if (approval?.sha256 !== plan.sha256) throw new Error('Current plan revision has no recorded user approval. Run approve after receiving approval.');
  validateResult(plan, result);
  const receipts = jsonFile(root, 'runtime/receipts.json', {});
  if (receipts[`unify:${plan.path}`]) throw new Error('Plan already reconciled; create a new plan for additional work');
  const key = `apply:${plan.path}:${plan.sha256}`;
  const inputHash = hash(JSON.stringify(result));
  if (receipts[key]?.inputHash === inputHash) return { unchanged: true, plan: plan.id };
  // Reverification before UNIFY may refresh evidence; transaction history retains the previous result.
  const recorded = { ...result, recorded_at: new Date().toISOString(), fingerprints: fileFingerprints(projectDirectories.get(root) || path.dirname(root), result.files) };
  receipts[key] = { at: recorded.recorded_at, inputHash };
  before[plan.path] = plan.sha256; before[plan.result] = digest(inside(root, plan.result));
  const updates = syncFiles(root, 'apply', plan, null, receipts, recorded.recorded_at);
  updates[plan.result] = JSON.stringify(recorded, null, 2) + '\n';
  updates['STATE.md'] = updateState(read(inside(root, 'STATE.md')) || '', plan, 'APPLY', `/paul:unify ${plan.id}`);
  const projectDirectory = projectDirectories.get(root) || path.dirname(root);
  for (const fingerprint of recorded.fingerprints) {
    const absolute = path.resolve(projectDirectory, fingerprint.path);
    if (absolute === path.resolve(projectDirectory, '.paul', plan.result)) throw new Error('RESULT cannot fingerprint itself; omit the generated RESULT from evidence files');
    for (const [relative, content] of Object.entries(updates)) {
      if (relative !== plan.result && absolute === path.resolve(projectDirectory, '.paul', relative)) fingerprint.sha256 = content === null ? null : hash(content);
    }
  }
  updates[plan.result] = JSON.stringify(recorded, null, 2) + '\n';
  return { plan: plan.id, result: `.paul/${plan.result}`, ...transaction(root, updates, 'apply-complete', before) };
}
function evidenceStatus(root, argument) {
  const plan = resolvePlan(root, argument), result = jsonFile(root, plan.result, null);
  if (!result) return { available: false, result: `.paul/${plan.result}`, legacy: true };
  validateResult(plan, result);
  const current = fileFingerprints(projectDirectories.get(root) || path.dirname(root), result.files);
  const changes = current.filter((f,i) => f.sha256 !== result.fingerprints?.[i]?.sha256 || f.path !== result.fingerprints?.[i]?.path);
  return { available: true, declaredFilesUnchanged: changes.length === 0, changedFiles: changes, result: `.paul/${plan.result}`, instruction: 'Fingerprint checks cover declared files only. Validate environment, dependencies, unlisted changes and project rules before reusing evidence. This is not automatic permission to skip tests.' };
}
function renderSummary(plan, r) {
  const status = r.acceptance.some(a => a.status === 'fail') || r.tasks.some(t => t.status === 'BLOCKED') ? 'fail' : r.acceptance.some(a => a.status === 'waived') || r.tasks.some(t => t.status === 'SKIPPED') ? 'waived' : 'pass';
  const cell = s => String(s).replace(/\|/g,'\\|').replace(/\r?\n/g,'<br>');
  const list = xs => xs.length ? xs.map(x => `- ${x}`).join('\n') : 'None.';
  const duration = Math.round((Date.parse(r.completed)-Date.parse(r.started))/60000);
  const evidence = plan.result.split('/').pop();
  const lines = [
    '---', `phase: ${JSON.stringify(plan.phase)}`, `plan: ${JSON.stringify(plan.id)}`,
    `started: ${JSON.stringify(r.started)}`, `completed: ${JSON.stringify(r.completed)}`,
    `duration: ${JSON.stringify(duration+'min')}`, `description: ${JSON.stringify(`${plan.id}: ${status}; outcome and limitations in body`)}`,
    'type: Summary', `about: ${JSON.stringify(frontmatter(plan.text).about || '')}`,
    `result: ${status}`, 'summary_schema: 2', `plan_sha256: ${plan.sha256}`, '---', '', `# ${plan.id} Summary`, '',
    '## Accomplishments', '', r.outcome, '',
    '## Acceptance Criteria Results', '',
    '| Criterion | Reported status | Full evidence in RESULT |', '|---|---|---|',
    ...r.acceptance.map((a,i) => `| ${cell(a.id)} | ${a.status} | acceptance[${i}]${a.user_approval ? ' User waiver: '+cell(a.user_approval) : ''} |`), '',
    '## Tasks', '', list(r.tasks.map((t,i) => `${t.id}: ${t.status} - tasks[${i}]${t.user_approval ? ' User approval: '+t.user_approval : ''}`)), '',
    '## Decisions Made', '', list(r.decisions), '',
    '## Deviations from Plan', '', list(r.deviations), '',
    '## Issues Encountered', '', list(r.issues), '',
    '## Evidence', '', `Complete evidence: ${evidence}. Outcome, decisions, deviations and issues are retained above.`,
    'Status labels alone are not proof. AC/task qualifications, full verification, skill audit and file changes remain in RESULT.',
    'Read relevant fields before reusing evidence: result-section --plan '+plan.id+' --field acceptance --item AC-1.',
    'Fields: acceptance, tasks, verification, skills, files. Large fields paginate with --offset/--limit.',
    `Recorded files: ${r.files.length}; verification entries: ${r.verification.length}; skill entries: ${r.skills.length}.`,
    'Follow project freshness rules. Phase completion requires a separate scope review.', ''
  ];
  return { status, text: lines.join('\n') };
}
function close(root, argument, review = {}) {
  const before = snapshot(root), plan = resolvePlan(root, argument), receipts = jsonFile(root, 'runtime/receipts.json', {});
  const key = `unify:${plan.path}`;
  if (receipts[key]) {
    if (receipts[key].planHash !== plan.sha256 || digest(inside(root, plan.summary)) !== receipts[key].summaryHash) throw new Error('Reconciled plan/summary changed; review history before further work');
    return { unchanged: true, plan: plan.id, phaseScopeReviewRequired: true };
  }
  const result = jsonFile(root, plan.result, null);
  if (!result) throw new Error('No structured APPLY result. Reconstruct verified evidence from legacy logs, record approval and apply-complete first; do not assume success.');
  validateResult(plan, result);
  const status = evidenceStatus(root, argument);
  if (!status.declaredFilesUnchanged) throw new Error('Declared files changed since APPLY evidence. Re-verify and refresh apply-complete before UNIFY; old evidence is preserved in transaction history.');
  const existingSummary = read(inside(root, plan.summary));
  if (existingSummary !== null && (review.summary_sha256 !== hash(existingSummary) || !review.evidence || typeof review.already_counted !== 'boolean')) throw new Error('Existing SUMMARY requires --input with summary_sha256, evidence and already_counted after reviewing legacy reconciliation. Original is archived in transaction history.');
  const sum = renderSummary(plan, result), at = new Date().toISOString();
  receipts[key] = { at, planHash: plan.sha256, summaryHash: hash(sum.text), status: sum.status };
  const updates = syncFiles(root, 'unify', plan, review.already_counted ? 'fail' : sum.status, receipts, at);
  updates[plan.summary] = sum.text;
  updates['STATE.md'] = updateState(read(inside(root, 'STATE.md')) || '', plan, 'UNIFY', sum.status === 'fail' ? `/paul:plan (address failed criteria from ${plan.id})` : `/paul:plan (review phase ${plan.phase} scope first)`, sum.status);
  before[plan.path] = plan.sha256; before[plan.result] = digest(inside(root, plan.result)); before[plan.summary] = existingSummary === null ? null : hash(existingSummary);
  return { plan: plan.id, result: sum.status, summary: `.paul/${plan.summary}`, phaseScopeReviewRequired: true, ...transaction(root, updates, 'unify', before) };
}
module.exports = { VERSION, projectRoot, resolvePlan, phaseStatus, phaseReport, context, history, handoff, resultSection, planCheck, planReady, approve, applyComplete, evidenceStatus, close, renderSummary, validateResult, loopState };
