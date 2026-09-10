'use strict';

// Surgical scalar updates: preserve unknown keys, comments and custom tables.
// Unsupported/ambiguous syntax fails before a transaction rather than rewriting it.
function updateToml(text, changes) {
  let lines = text.split('\n');
  if (/"""|'''/.test(text)) throw new Error('Multiline TOML strings require manual review before scalar updates');
  function commentAt(line) {
    let quote = null, escaped = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (escaped) { escaped = false; continue; }
      if (quote === '"' && c === '\\') { escaped = true; continue; }
      if (quote) { if (c === quote) quote = null; }
      else if (c === '"' || c === "'") quote = c;
      else if (c === '#') return i;
    }
    return -1;
  }
  const bare = line => { const i = commentAt(line); return (i < 0 ? line : line.slice(0,i)).trim(); };
  for (const line of lines) {
    const clean = bare(line);
    if (!clean.includes('=')) continue;
    const value = clean.slice(clean.indexOf('=') + 1);
    let quote = null, escaped = false, balance = 0;
    for (const c of value) {
      if (escaped) { escaped = false; continue; }
      if (quote === '"' && c === '\\') { escaped = true; continue; }
      if (quote) { if (c === quote) quote = null; continue; }
      if (c === '"' || c === "'") quote = c;
      else if (c === '[' || c === '{') balance++;
      else if (c === ']' || c === '}') balance--;
    }
    if (balance !== 0) throw new Error('Multiline TOML arrays/inline tables require manual review');
  }
  for (const [table, values] of Object.entries(changes)) {
    if (table && !/^[\w-]+$/.test(table)) throw new Error('Only simple TOML table names can be updated');
    if (table && lines.some(l => bare(l).replace(/[\"']/g,'') === `[${table}]` && bare(l) !== `[${table}]`)) throw new Error(`Quoted TOML table requires review: ${table}`);
    if (table && lines.some(l => new RegExp(`^${table}\\s*\\.`).test(bare(l)))) throw new Error(`Dotted TOML fields require review: ${table}`);
    let start = 0, end = lines.findIndex(l => /^\s*\[/.test(l));
    if (end < 0) end = lines.length;
    if (table) {
      const indices = lines.flatMap((l,i) => bare(l) === `[${table}]` ? [i] : []);
      if (indices.length > 1) throw new Error(`Duplicate TOML table: ${table}`);
      if (!indices.length) { lines.push('', `[${table}]`); start = lines.length; end = lines.length; }
      else { start = indices[0] + 1; end = lines.findIndex((l,i) => i >= start && /^\s*\[/.test(l)); if (end < 0) end = lines.length; }
    }
    let block = lines.slice(start, end);
    if (block.some(l => /'''|"""/.test(l))) throw new Error(`Multiline TOML values in updated table ${table || '(root)'} require manual review`);
    for (const [key, value] of Object.entries(values)) {
      if (!/^[\w-]+$/.test(key)) throw new Error('Invalid TOML key');
      const indices = block.flatMap((l,i) => new RegExp(`^\\s*${key}\\s*=`).test(l) ? [i] : []);
      if (indices.length > 1) throw new Error(`Duplicate TOML key: ${table}.${key}`);
      if (block.some(l => new RegExp(`^\\s*["']${key}["']\\s*=`).test(l))) throw new Error(`Quoted TOML key requires review: ${key}`);
      if (value === null) { if (indices.length) block.splice(indices[0], 1); continue; }
      if (!['string','number','boolean'].includes(typeof value) || (typeof value === 'number' && !Number.isFinite(value))) throw new Error(`Invalid scalar: ${key}`);
      const oldLine = indices.length ? block[indices[0]] : '';
      const commentPosition = commentAt(oldLine);
      const comment = commentPosition < 0 ? '' : ' ' + oldLine.slice(commentPosition);
      const output = `${key} = ${JSON.stringify(value)}${comment}`;
      if (indices.length) block[indices[0]] = output; else block.push(output);
    }
    lines.splice(start, end - start, ...block);
  }
  return lines.join('\n').trimEnd() + '\n';
}
function numeric(text, table, key) {
  let active = !table;
  for (const l of text.split('\n')) {
    if (/^\s*\[/.test(l)) active = l.replace(/\s+#.*$/, '').trim() === `[${table}]`;
    if (active) {
      const m = l.match(new RegExp(`^\\s*${key}\\s*=\\s*(.*?)\\s*(?:#.*)?$`));
      if (m) {
        const value = m[1].replace(/^(["'])(.*)\1$/, '$2');
        if (!/^\d+(?:\.\d+)?$/.test(value)) throw new Error(`Unsupported numeric TOML value: ${table}.${key}`);
        return Number(value);
      }
    }
  }
  return 0;
}
module.exports = { updateToml, numeric };
