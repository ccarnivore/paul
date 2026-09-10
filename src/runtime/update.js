'use strict';
const { inside, read, digest, hash } = require('./files');
const { replaceSection } = require('./markdown');
const { updateToml, numeric } = require('./toml');
const { transaction } = require('./transaction');
const { phaseStatus, VERSION } = require('./project');

function update(root, input) {
  const events = ['transition','milestone_create','milestone_complete','pause','resume','verify','roadmap'];
  if (input.schema !== 1 || !events.includes(input.action) || typeof input.event_id !== 'string' || !input.event_id.trim()) throw new Error('Update requires schema:1, supported action and stable event_id');
  const receiptPath = 'runtime/updates.json', raw = read(inside(root, receiptPath));
  const receipts = raw ? JSON.parse(raw) : {};
  const signature = hash(JSON.stringify(input));
  if (receipts[input.event_id]) {
    if (receipts[input.event_id].sha256 !== signature) throw new Error('Event ID reused with different content');
    return { unchanged: true, event: input.event_id };
  }
  const phaseRevisions = {};
  const transitionKey = input.action === 'transition' ? String(Number(input.phase)) : null;
  if (transitionKey && Object.values(receipts).some(r => r.transitionKey === transitionKey)) throw new Error('Phase already transitioned. Use the original event ID for retry, or a reviewed roadmap update for later corrections.');
  if (input.phase !== undefined && !/^\d+(?:\.\d+)?$/.test(String(input.phase))) throw new Error('Invalid phase');
  if (input.action === 'transition') {
    if (typeof input.scope_evidence !== 'string' || !input.scope_evidence.trim()) throw new Error('Explicit phase-scope completion evidence required');
    const status = phaseStatus(root, String(input.phase));
    if (!status.allReconciled) throw new Error('Phase contains unreconciled plans');
    for (const p of status.plans) {
      phaseRevisions[p.plan] = digest(inside(root,p.plan));
      phaseRevisions[p.summary] = digest(inside(root,p.summary));
      if (p.status === 'fail') throw new Error(`Failed plan blocks phase transition: ${p.id}`);
      if (!['pass','waived','fail'].includes(p.status)) {
        const attestation = (input.reviewed_summaries || []).find(s => s.path === p.summary);
        if (!attestation || attestation.sha256 !== digest(inside(root,p.summary)) || !['pass','waived'].includes(attestation.result) || !attestation.evidence) throw new Error(`Legacy summary needs explicit evidence review: ${p.summary}`);
      }
    }
  }
  const allowed = ['STATE.md','PROJECT.md','ROADMAP.md','config.md','SPECIAL-FLOWS.md'];
  if (!Array.isArray(input.edits) || !input.edits.length) throw new Error('Provide reviewed section edits');
  const updates = {}, preconditions = { ...phaseRevisions, [receiptPath]: raw === null ? null : hash(raw) };
  for (const edit of input.edits) {
    if (!allowed.includes(edit.path) || typeof edit.section !== 'string' || typeof edit.content !== 'string') throw new Error('Only named sections of PAUL project documents can be updated');
    const current = read(inside(root, edit.path));
    const currentHash = current === null ? null : hash(current);
    if (edit.sha256 !== currentHash) throw new Error(`Stale edit: ${edit.path}. Refresh context first.`);
    preconditions[edit.path] = currentHash;
    updates[edit.path] = replaceSection(updates[edit.path] ?? current ?? '', edit.section, edit.content);
  }
  const manifest = read(inside(root,'paul.toml'));
  if (input.manifest && manifest === null) throw new Error('No paul.toml; register/migrate it before requesting manifest changes');
  if (manifest !== null) {
    if (input.manifest && input.manifest_sha256 !== hash(manifest)) throw new Error('Stale manifest revision');
    preconditions['paul.toml'] = hash(manifest);
    const changes = { ...(input.manifest || {}) };
    changes.paul = { ...(changes.paul || {}), version: VERSION };
    changes.stats = { ...(changes.stats || {}), last_activity: new Date().toISOString() };
    if (input.action === 'transition') changes.stats.total_phases = numeric(manifest,'stats','total_phases') + 1;
    updates['paul.toml'] = updateToml(manifest, changes);
  }
  const ledger = read(inside(root,'ledger.toml'));
  preconditions['ledger.toml'] = ledger === null ? null : hash(ledger);
  const at = new Date().toISOString();
  let entry = `\n\n[[entry]]\naction = ${JSON.stringify(input.action)}\nat = ${JSON.stringify(at)}\n`;
  if (input.phase !== undefined) {
    if (!/^\d+(?:\.\d+)?$/.test(String(input.phase))) throw new Error('Invalid phase');
    entry += `phase = ${Number(input.phase)}\n`;
  }
  updates['ledger.toml'] = (ledger || '# PAUL session history\n').trimEnd() + entry;
  receipts[input.event_id] = { sha256: signature, at, ...(transitionKey ? { transitionKey } : {}) };
  updates[receiptPath] = JSON.stringify(receipts, null, 2)+'\n';
  return transaction(root, updates, input.action, preconditions);
}
module.exports = { update };
