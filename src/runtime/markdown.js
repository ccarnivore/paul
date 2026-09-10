'use strict';
const { hash } = require('./files');

function sections(text) {
  const lines = text.split('\n'), out = [];
  let fence = false;
  for (let i = 0; i < lines.length; i++) {
    if (/^```/.test(lines[i])) fence = !fence;
    if (!fence && /^## /.test(lines[i])) out.push({ title: lines[i].slice(3).trim(), start: i });
  }
  return out.map((s, i) => ({ ...s, end: out[i + 1]?.start ?? lines.length, text: lines.slice(s.start + 1, out[i + 1]?.start ?? lines.length).join('\n').trim() }));
}
function section(text, title) { return sections(text).find(s => s.title.toLowerCase() === title.toLowerCase())?.text || ''; }
function replaceSection(text, title, body) {
  const ss = sections(text).filter(s => s.title.toLowerCase() === title.toLowerCase());
  if (ss.length > 1) throw new Error(`Ambiguous duplicate section: ${title}`);
  if (!ss.length) return text.trimEnd() + `\n\n## ${title}\n\n${body.trim()}\n`;
  const lines = text.split('\n'), s = ss[0];
  return [...lines.slice(0, s.start), `## ${title}`, '', body.trim(), '', ...lines.slice(s.end)].join('\n');
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
module.exports = { sections, section, replaceSection, frontmatter, parsePlan };
