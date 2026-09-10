'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const hash = data => crypto.createHash('sha256').update(data).digest('hex');
const read = file => fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
const digest = file => fs.existsSync(file) ? hash(fs.readFileSync(file)) : null;

// Never follow an installation/project symlink when writing managed files.
function inside(root, relative) {
  if (!relative || path.isAbsolute(relative) || relative.split(/[\\/]/).some(p => p === '..')) {
    throw new Error(`Unsafe relative path: ${relative}`);
  }
  const base = path.resolve(root);
  const target = path.resolve(base, relative);
  if (!target.startsWith(base + path.sep)) throw new Error(`Path escapes root: ${relative}`);
  let cursor = target;
  while (true) {
    if (fs.existsSync(cursor) || (() => { try { fs.lstatSync(cursor); return true; } catch { return false; } })()) {
      if (fs.lstatSync(cursor).isSymbolicLink()) throw new Error(`Symlink is not a managed path: ${cursor}`);
    }
    if (cursor === base) break;
    const parent = path.dirname(cursor);
    if (parent === cursor) break;
    cursor = parent;
  }
  return target;
}

function atomicWrite(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${crypto.randomBytes(5).toString('hex')}.tmp`;
  try {
    fs.writeFileSync(tmp, data, { mode: fs.existsSync(file) ? fs.statSync(file).mode & 0o777 : 0o600, flag: 'wx' });
    const fd = fs.openSync(tmp, 'r');
    try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    fs.renameSync(tmp, file);
  } finally { if (fs.existsSync(tmp)) fs.unlinkSync(tmp); }
}

function walk(root) {
  if (!fs.existsSync(root)) return [];
  const result = [];
  for (const e of fs.readdirSync(root, { withFileTypes: true }).sort((a,b) => a.name.localeCompare(b.name))) {
    if (e.isSymbolicLink()) throw new Error(`Symlink in managed tree: ${path.join(root, e.name)}`);
    const full = path.join(root, e.name);
    if (e.isDirectory()) result.push(...walk(full));
    else if (e.isFile()) result.push(full);
  }
  return result;
}

function withLock(root, name, fn) {
  const file = inside(root, name);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  let fd;
  try { fd = fs.openSync(file, 'wx', 0o600); }
  catch (e) { if (e.code === 'EEXIST') throw new Error(`Operation locked: ${file}. Check the recorded process before removing a stale lock.`); throw e; }
  fs.writeFileSync(fd, JSON.stringify({ pid: process.pid, at: new Date().toISOString() }));
  try { return fn(); } finally { fs.closeSync(fd); fs.unlinkSync(file); }
}

module.exports = { hash, read, digest, inside, atomicWrite, walk, withLock };
