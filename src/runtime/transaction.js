'use strict';
const fs = require('fs');
const { inside, read, hash, digest, atomicWrite, withLock } = require('./files');

const JOURNAL = 'runtime/transaction.json';
function validateEntry(root, c) {
  if (typeof c.path !== 'string' || c.path === JOURNAL || c.path === 'runtime/lock') throw new Error('Invalid transaction target');
  inside(root, c.path);
  for (const key of ['before', 'after']) if (c[key] !== null && typeof c[key] !== 'string') throw new Error('Invalid journal content');
}
function expected(content) { return content === null ? null : hash(content); }
function applyChanges(root, entries, direction) {
  // Validate every target before touching any file.
  if (new Set(entries.map(c => c.path)).size !== entries.length) throw new Error('Duplicate transaction targets');
  for (const c of entries) {
    validateEntry(root, c);
    const current = digest(inside(root, c.path));
    if (![expected(c.before), expected(c.after)].includes(current)) throw new Error(`Concurrent edit blocks recovery: ${c.path}`);
  }
  for (const c of entries) {
    const file = inside(root, c.path), data = c[direction];
    const current = digest(file);
    if (![expected(c.before), expected(c.after)].includes(current)) throw new Error(`Concurrent edit: ${c.path}`);
    if (data === null) { if (fs.existsSync(file)) fs.unlinkSync(file); }
    else atomicWrite(file, data);
  }
}
function transaction(root, updates, operation, preconditions = {}) {
  return withLock(root, 'runtime/lock', () => {
    const jf = inside(root, JOURNAL);
    if (fs.existsSync(jf)) throw new Error('Interrupted transaction found. Run recover --mode finish or rollback before another mutation.');
    for (const [rel, wanted] of Object.entries(preconditions)) if (digest(inside(root, rel)) !== wanted) throw new Error(`Concurrent edit: ${rel}; refresh context and retry.`);
    const changes = Object.entries(updates).map(([rel, after]) => ({ path: rel, before: read(inside(root, rel)), after })).filter(c => c.before !== c.after);
    for (const c of changes) validateEntry(root, c);
    if (!changes.length) return { unchanged: true };
    const journal = { schema: 1, operation, at: new Date().toISOString(), changes };
    atomicWrite(jf, JSON.stringify(journal));
    // Keep a lossless pre-transition archive, including custom STATE sections.
    const archive = `runtime/history/${Date.now()}-${process.pid}-${require('crypto').randomBytes(4).toString('hex')}.json`;
    atomicWrite(inside(root, archive), JSON.stringify(journal));
    applyChanges(root, changes, 'after');
    fs.unlinkSync(jf);
    return { changed: changes.map(c => c.path), history: archive };
  });
}
function recover(root, mode) {
  if (!['finish', 'rollback'].includes(mode)) throw new Error('Recovery mode must be finish or rollback');
  return withLock(root, 'runtime/lock', () => {
    const jf = inside(root, JOURNAL), text = read(jf);
    if (!text) return { recovered: false, reason: 'No pending transaction' };
    const journal = JSON.parse(text);
    if (journal.schema !== 1 || !Array.isArray(journal.changes)) throw new Error('Invalid transaction journal');
    applyChanges(root, journal.changes, mode === 'finish' ? 'after' : 'before');
    fs.unlinkSync(jf);
    return { recovered: true, mode, operation: journal.operation };
  });
}
module.exports = { transaction, recover };
