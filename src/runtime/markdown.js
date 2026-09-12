'use strict';
const { hash } = require('./files');

function headings(text) {
  const lines = text.split('\n'), out = [];
  let fence = null;
  for (let i = 0; i < lines.length; i++) {
    const marker = lines[i].match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    if (marker) {
      if (!fence) fence = { char: marker[1][0], length: marker[1].length };
      else if (marker[1][0] === fence.char && marker[1].length >= fence.length && !marker[2].trim()) fence = null;
      continue;
    }
    if (fence) continue;
    const h = lines[i].match(/^ {0,3}(#{1,6})[ \t]+(.+?)[ \t]*$/);
    if (h) out.push({ title: h[2].replace(/[ \t]+#+[ \t]*$/, '').trim(), level: h[1].length, start: i });
  }
  return out.map((s,i) => {
    const end = out.slice(i+1).find(n => n.level <= s.level)?.start ?? lines.length;
    return { ...s, end, text: lines.slice(s.start+1,end).join('\n').trim() };
  });
}
function sections(text) { return headings(text).filter(s => s.level === 2); }
function section(text, title) {
  const found = headings(text).filter(s => s.title.toLowerCase() === title.toLowerCase());
  if (found.length > 1) throw new Error(`Ambiguous duplicate section: ${title}`);
  return found[0]?.text || '';
}
function replaceSection(text, title, body, options = {}) {
  const ss = headings(text).filter(s => s.title.toLowerCase() === title.toLowerCase());
  if (ss.length > 1) throw new Error(`Ambiguous duplicate section: ${title}`);
  if (!ss.length) throw new Error(`Section not found: ${title}; no implicit append. Inspect the document headings.`);
  const lines = text.split('\n'), s = ss[0];
  if (!['subtree','intro'].includes(options.scope || 'subtree')) throw new Error('Section scope must be subtree or intro');
  const children = headings(text).filter(h => h.start > s.start && h.start < s.end);
  const end = options.scope === 'intro' ? (children[0]?.start ?? s.end) : s.end;
  const replacementHeadings = headings(body);
  if (replacementHeadings.some(h => h.level <= s.level)) throw new Error(`Content for ${title} must exclude its own heading and any sibling/parent heading`);
  if (options.scope === 'intro' && replacementHeadings.length) throw new Error('Intro edits cannot contain headings; edit the child section separately');
  if (options.scope !== 'intro') {
    const counts = hs => hs.reduce((m,h) => { const k = `${h.level}:${h.title.toLowerCase()}`; m.set(k,(m.get(k)||0)+1); return m; },new Map());
    const next = counts(replacementHeadings);
    for (const [key,count] of next) if (count > 1 && count > (counts(children).get(key)||0)) throw new Error(`Duplicate child heading in replacement: ${key}`);
    for (const [key,count] of counts(children)) if ((next.get(key)||0) < count) throw new Error(`Update would remove a child heading of ${title}: ${key}. Use scope intro or retain the complete subtree.`);
  }
  // Retain the original heading spelling/level and every byte outside the selected body.
  return [...lines.slice(0,s.start+1), '', body.trim(), '', ...lines.slice(end)].join('\n');
}
function scalar(raw) {
  const v = raw.trim();
  if (v.startsWith('"')) { try { return JSON.parse(v); } catch { return v; } }
  return v.replace(/^'(.*)'$/, '$1').replace(/\s+#.*$/, '');
}
function frontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const result = {};
  if (m) for (const l of m[1].split('\n')) {
    const f = l.match(/^([\w-]+):\s*(.*)$/);
    if (f) result[f[1]] = scalar(f[2]);
  }
  return result;
}
function parsePlan(text, relative) {
  const name = relative.split('/').pop();
  const match = name.match(/^(\d+(?:\.\d+)?)-(\d+)(-FIX)?(?:-PLAN)?\.md$/);
  if (!match) throw new Error(`Unsupported plan filename: ${name}`);
  const acBlock = text.match(/<acceptance_criteria>([\s\S]*?)<\/acceptance_criteria>/)?.[1] || '';
  const ac = [...acBlock.matchAll(/^\s*#{1,4}\s+(AC-[\w.-]+)\s*:/gm)].map(m => m[1]);
  const tasks = [...text.matchAll(/<task\s+type="([^"]+)"[^>]*>([\s\S]*?)<\/task>/g)].map((m,i) => ({
    id: `task-${i + 1}`, type: m[1], name: m[2].match(/<name>([\s\S]*?)<\/name>/)?.[1].trim() || `Task ${i + 1}`,
  }));
  const errors = [];
  if (!ac.length) errors.push('Missing named acceptance criteria (AC-N)');
  if (new Set(ac).size !== ac.length) errors.push('Duplicate acceptance criteria');
  if (!tasks.length) errors.push('Missing executable task definitions');
  const fm = frontmatter(text);
  return { id: `${match[1]}-${match[2]}${match[3] || ''}`, phase: match[1], path: relative, sha256: hash(text), ac, tasks, track: fm.track || 'legacy', description: fm.description || '', errors };
}
module.exports = { headings, sections, section, replaceSection, frontmatter, parsePlan };
