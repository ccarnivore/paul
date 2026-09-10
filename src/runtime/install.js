'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { hash, read, digest, inside, atomicWrite, walk, withLock } = require('./files');

const MANIFEST = 'paul-install.json';
const OWNED = /^(commands\/paul\/|paul-framework\/)/;
function owned(file) {
  if (file !== MANIFEST && !OWNED.test(file)) throw new Error(`Not a PAUL installation path: ${file}`);
  return file;
}
function canonical(text, configDir) {
  let s = text.replace(/\r\n/g, '\n');
  for (const prefix of [configDir.replace(/\\/g, '/') + '/', './.claude/']) s = s.split(prefix).join('~/.claude/');
  return s.split('\n## Extensions\n')[0];
}
function rewrite(text, prefix) {
  // Only framework paths; @src/application.ts remains project-relative.
  return text.replace(/~\/\.claude\//g, prefix)
    .replace(/@src\/(workflows|references|templates|rules|documentation)\//g, `@${prefix}paul-framework/$1/`)
    .replace(/@(workflows|references|templates)\//g, `@${prefix}paul-framework/$1/`);
}
function extensionTail(text) {
  const marker = '\n## Extensions\n';
  const i = text.indexOf(marker);
  return i < 0 ? null : text.slice(i + marker.length);
}

function desiredFiles(source, configDir) {
  const out = new Map();
  const prefix = configDir.replace(/\\/g, '/') + '/';
  for (const group of ['commands', 'templates', 'workflows', 'references', 'rules', 'documentation', 'runtime']) {
    for (const file of walk(path.join(source, 'src', group))) {
      const relative = path.relative(path.join(source, 'src', group), file).split(path.sep).join('/');
      const dest = group === 'commands' ? `commands/paul/${relative}` : `paul-framework/${group}/${relative}`;
      const data = fs.readFileSync(file);
      out.set(dest, file.endsWith('.md') ? Buffer.from(rewrite(data.toString('utf8'), prefix)) : data);
    }
  }
  out.set('paul-framework/package.json', fs.readFileSync(path.join(source, 'package.json')));
  return out;
}

function installationPlan(source, configDir, replaceCustomized = false) {
  const next = desiredFiles(source, configDir);
  const previousText = read(inside(configDir, MANIFEST));
  const previous = previousText ? JSON.parse(previousText) : { files: {} };
  if (!previous.files || typeof previous.files !== 'object') throw new Error('Invalid installation manifest');
  const baseline = JSON.parse(fs.readFileSync(path.join(source, 'src/upstream-hashes.json'), 'utf8'));
  const conflicts = [], changes = [], preservedExtensions = [], preservedCustomized = [];
  for (const [rel, initial] of next) {
    const file = inside(configDir, owned(rel));
    const old = read(file);
    let data = initial;
    const sourceRelative = rel.replace(/^commands\/paul\//, 'commands/').replace(/^paul-framework\//, '');
    const sourceText = rel.endsWith('.md') ? read(path.join(source, 'src', sourceRelative)) : null;
    const unchangedUpstream = sourceText !== null && hash(canonical(sourceText, configDir)) === baseline[rel];
    // Keep local customizations when this release has not changed that upstream core.
    if (old !== null && rel.endsWith('.md') && unchangedUpstream && hash(canonical(old, configDir)) !== baseline[rel]) {
      data = Buffer.from(rewrite(old, configDir.replace(/\\/g, '/') + '/'));
      preservedCustomized.push(rel);
    }
    if (old !== null && rel.endsWith('.md')) {
      const tail = extensionTail(old);
      if (tail !== null && extensionTail(data.toString()) !== null) {
        data = Buffer.from(data.toString().split('\n## Extensions\n')[0] + '\n## Extensions\n' + tail);
        if (tail.trim() !== extensionTail(initial.toString()).trim()) preservedExtensions.push(rel);
      }
    }
    next.set(rel, data);
    const before = digest(file), after = hash(data);
    if (before === after) continue;
    const known = (unchangedUpstream && preservedCustomized.includes(rel)) || before === previous.files[rel] ||
      (old !== null && hash(canonical(old, configDir)) === baseline[rel]) ||
      // Extension installers can append blocks without changing core ownership.
      (old !== null && previous.coreHashes && hash(canonical(old, configDir)) === previous.coreHashes[rel]);
    if (before !== null && !known) conflicts.push(rel);
    changes.push({ path: rel, before, after, operation: before === null ? 'create' : 'replace' });
  }
  for (const rel of Object.keys(previous.files)) {
    inside(configDir, owned(rel));
    if (next.has(rel)) continue;
    const before = digest(inside(configDir, rel));
    if (before === null) continue;
    if (before !== previous.files[rel]) conflicts.push(rel);
    changes.push({ path: rel, before, after: null, operation: 'remove' });
  }
  const pkg = JSON.parse(fs.readFileSync(path.join(source, 'package.json'), 'utf8'));
  const manifest = { schema: 1, version: pkg.version, files: {}, coreHashes: {} };
  for (const [rel, data] of next) {
    manifest.files[rel] = hash(data);
    if (rel.endsWith('.md')) manifest.coreHashes[rel] = hash(canonical(data.toString(), configDir));
  }
  const manifestData = Buffer.from(JSON.stringify(manifest, null, 2) + '\n');
  const mf = inside(configDir, MANIFEST);
  if (digest(mf) !== hash(manifestData)) changes.push({ path: MANIFEST, before: digest(mf), after: hash(manifestData), operation: 'manifest' });
  next.set(MANIFEST, manifestData);
  return { next, changes, conflicts, preservedExtensions, preservedCustomized, allowed: !conflicts.length || replaceCustomized, version: pkg.version };
}

function install(source, configDir, options = {}) {
  configDir = path.resolve(configDir);
  const preview = installationPlan(source, configDir, options.replaceCustomized);
  const summary = { target: configDir, version: preview.version, changes: preview.changes, conflicts: preview.conflicts, preservedExtensions: preview.preservedExtensions, preservedCustomized: preview.preservedCustomized, projectDataTouched: false };
  if (options.dryRun) return { ...summary, dryRun: true };
  if (!preview.allowed) throw new Error(`Customized files need review: ${preview.conflicts.join(', ')}. Use --dry-run; --replace-customized explicitly replaces them after backup.`);
  if (!preview.changes.length) return { ...summary, unchanged: true };
  return withLock(configDir, 'paul-install.lock', () => {
    const id = `${new Date().toISOString().replace(/[:.]/g, '-')}-${crypto.randomBytes(3).toString('hex')}`;
    const backup = inside(configDir, `paul-backups/${id}`);
    fs.mkdirSync(backup, { recursive: true });
    // Snapshot all changes before the first mutation; rollback also removes new files.
    for (const c of preview.changes) {
      const file = inside(configDir, c.path);
      if (digest(file) !== c.before) throw new Error(`Installation changed during review: ${c.path}`);
      if (c.before !== null) atomicWrite(inside(backup, 'files/' + c.path), fs.readFileSync(file));
    }
    const metadata = { schema: 1, target: configDir, changes: preview.changes, created: new Date().toISOString() };
    atomicWrite(inside(backup, 'backup.json'), JSON.stringify(metadata, null, 2));
    try {
      for (const c of preview.changes) {
        const target = inside(configDir, c.path);
        if (digest(target) !== c.before) throw new Error(`Concurrent modification: ${c.path}`);
        if (c.after === null) fs.unlinkSync(target);
        else atomicWrite(target, preview.next.get(c.path));
      }
    } catch (e) {
      // Restore only files still equal to the version this operation wrote.
      for (const c of preview.changes.slice().reverse()) {
        const target = inside(configDir, c.path);
        if (digest(target) !== c.after) continue;
        if (c.before === null) { if (fs.existsSync(target)) fs.unlinkSync(target); }
        else atomicWrite(target, fs.readFileSync(inside(backup, 'files/' + c.path)));
      }
      throw new Error(`${e.message}. Recovery backup: ${backup}`);
    }
    return { ...summary, backup: id, rollback: `--rollback ${id}` };
  });
}

function rollback(configDir, id, options = {}) {
  configDir = path.resolve(configDir);
  if (!/^[\w-]+$/.test(id)) throw new Error('Rollback requires a backup ID, not a path');
  const backup = inside(configDir, `paul-backups/${id}`);
  const meta = JSON.parse(fs.readFileSync(inside(backup, 'backup.json'), 'utf8'));
  if (meta.schema !== 1 || meta.target !== configDir || !Array.isArray(meta.changes)) throw new Error('Backup target/schema mismatch');
  const conflicts = [];
  for (const c of meta.changes) {
    const target = inside(configDir, owned(c.path));
    if (![c.before,c.after].includes(digest(target))) conflicts.push(c.path);
    if (c.before !== null && digest(inside(backup, 'files/' + c.path)) !== c.before) throw new Error(`Corrupted backup: ${c.path}`);
  }
  if (options.dryRun) return { target: configDir, rollback: id, changes: meta.changes, conflicts, dryRun: true };
  if (conflicts.length) throw new Error(`Rollback would overwrite changes made after installation: ${conflicts.join(', ')}. Preserve/reconcile these files first.`);
  return withLock(configDir, 'paul-install.lock', () => {
    // A recovery snapshot makes interrupted rollback reviewable and reversible.
    const redo = inside(backup, 'before-rollback');
    for (const c of meta.changes) {
      if (![c.before,c.after].includes(digest(inside(configDir, c.path)))) throw new Error(`Concurrent modification: ${c.path}`);
      if (digest(inside(configDir,c.path)) === c.after && c.after !== null) atomicWrite(inside(redo, c.path), fs.readFileSync(inside(configDir, c.path)));
    }
    const restored = [];
    try {
      for (const c of meta.changes.slice().reverse()) {
        const target = inside(configDir, c.path);
        if (digest(target) === c.before) continue;
        if (digest(target) !== c.after) throw new Error(`Concurrent modification: ${c.path}`);
        if (c.before === null) { if (fs.existsSync(target)) fs.unlinkSync(target); }
        else atomicWrite(target, fs.readFileSync(inside(backup, 'files/' + c.path)));
        restored.push(c);
      }
    } catch (e) {
      for (const c of restored.reverse()) {
        const target = inside(configDir, c.path);
        if (digest(target) !== c.before) continue;
        if (c.after === null) { if (fs.existsSync(target)) fs.unlinkSync(target); }
        else atomicWrite(target, fs.readFileSync(inside(redo, c.path)));
      }
      throw e;
    }
    return { target: configDir, restored: id, projectDataTouched: false };
  });
}
module.exports = { install, rollback, installationPlan, rewrite };
