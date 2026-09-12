#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const project = require('./project');
const { inside, read, digest } = require('./files');
const { headings } = require('./markdown');
const { recover } = require('./transaction');
const { update } = require('./update');
function main(args = process.argv.slice(2)) {
  const command = args.shift() || 'help', opts = {};
  const flags = ['project','plan','phase','budget','query','limit','signal','input','mode','file','heading','offset','field','item'];
  while (args.length) {
    const key = args.shift();
    if (!key.startsWith('--') || !flags.includes(key.slice(2)) || !args.length || args[0].startsWith('--')) throw new Error(`Invalid option/value: ${key}`);
    opts[key.slice(2)] = args.shift();
  }
  if (command === 'help' || command === '--help') return { usage: 'node <claude-config>/paul-framework/runtime/cli.js COMMAND [--project DIR]', commands: {
    context: '[--plan ID|PATH] [--phase N] [--budget CHARS] - read-only working context; required context is not truncated',
    section: '--file PROJECT.md --heading Constraints - read one named .paul section',
    history: '[--query WORDS] [--limit N] [--offset N] [--budget CHARS] - ranked, bounded summary/evidence search',
    handoff: '--plan ID [--offset N] [--limit N] [--budget CHARS] - paginated historical handoff, read-only',
    'result-section': '--plan ID --field NAME [--item ID|INDEX] [--offset CHARS] [--limit CHARS] - exact stored evidence field',
    'plan-check': '--plan ID - read-only structure and soft size check',
    'phase-report': '--phase N - compact summary metadata and bounded decision/issue excerpts',
    'phase-status': '--phase N - inspect plan/summary pairing; never infer scope completion',
    'plan-ready': '--plan ID|PATH - register plan, update state/manifest/ledger',
    approve: '--plan ID|PATH --signal TEXT - record actual user approval for this revision',
    'apply-complete': '--plan ID|PATH --input RESULT.json - persist validated evidence and APPLY state',
    evidence: '--plan ID|PATH - inspect recorded evidence freshness',
    close: '--plan ID|PATH - render SUMMARY and reconcile without inferring phase completion',
    update: '--input UPDATE.json - reviewed section edits with revision checks',
    doctor: 'Read-only structure and recovery checks',
    recover: '--mode finish|rollback - recover a pending interrupted transaction'
  } };
  const root = project.projectRoot(opts.project || process.cwd());
  for (const key of ['budget','limit']) if (opts[key] && (!/^\d+$/.test(opts[key]) || Number(opts[key]) < 1)) throw new Error(`${key} must be a positive integer`);
  const input = () => { if (!opts.input) throw new Error('--input JSON file required'); return JSON.parse(fs.readFileSync(path.resolve(opts.input),'utf8')); };
  switch (command) {
    case 'context': return project.context(root, { ...opts, budget: opts.budget ? Number(opts.budget) : undefined });
    case 'section': {
      if (!opts.file || !opts.heading) throw new Error('--file and --heading required');
      const file = inside(root, opts.file.replace(/^\.paul\//,'')), text = read(file);
      if (text === null) throw new Error('File not found');
      const found = headings(text).filter(s => s.title.toLowerCase() === opts.heading.toLowerCase());
      if (found.length !== 1) throw new Error('Section missing or ambiguous; read the source file');
      return { file, sha256: digest(file), section: opts.heading, ...(opts.limit !== undefined || opts.offset !== undefined ? require('./retrieval').pageText(found[0].text, opts) : { text: found[0].text }) };
    }
    case 'history': return project.history(root, opts.query, opts.limit ? Number(opts.limit) : 5, opts);
    case 'handoff': return project.handoff(root, opts.plan, opts);
    case 'result-section': return project.resultSection(root, opts.plan, opts);
    case 'plan-check': return project.planCheck(root, opts.plan);
    case 'phase-status': if (!opts.phase || !/^\d+(?:\.\d+)?$/.test(opts.phase)) throw new Error('--phase N required'); return project.phaseStatus(root,opts.phase);
    case 'phase-report': return project.phaseReport(root, opts.phase);
    case 'plan-ready': return project.planReady(root, opts.plan);
    case 'approve': return project.approve(root, opts.plan, opts.signal);
    case 'apply-complete': return project.applyComplete(root, opts.plan, input());
    case 'evidence': return project.evidenceStatus(root, opts.plan);
    case 'close': return project.close(root, opts.plan, opts.input ? input() : {});
    case 'update': return update(root, input());
    case 'recover': return recover(root, opts.mode);
    case 'doctor': return { project: path.dirname(root), statePresent: read(inside(root,'STATE.md')) !== null, manifestPresent: read(inside(root,'paul.toml')) !== null, legacyJsonPresent: read(inside(root,'paul.json')) !== null, pendingTransaction: read(inside(root,'runtime/transaction.json')) !== null, lockPresent: read(inside(root,'runtime/lock')) !== null, note: 'Read-only. STATE.md remains the current-state authority; no migration is performed.' };
    default: throw new Error(`Unknown command: ${command}`);
  }
}
if (require.main === module) {
  try { console.log(JSON.stringify(main(), null, 2)); }
  catch (e) { console.error(JSON.stringify({ error: e.message })); process.exitCode = 1; }
}
module.exports = { main };
