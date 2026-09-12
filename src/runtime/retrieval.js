'use strict';
const { hash, read, inside, walk } = require('./files');
const { frontmatter, headings } = require('./markdown');
const path = require('path');

const fields = ['outcome','issues','deviations','decisions','acceptance','tasks','files','verification','skills'];
function integer(value, fallback, min, max = Number.MAX_SAFE_INTEGER) {
  if (value === undefined) return fallback;
  if (!/^\d+$/.test(String(value)) || !Number.isSafeInteger(Number(value)) || Number(value) < min || Number(value) > max) throw new Error(`Expected integer ${min}..${max}`);
  return Number(value);
}
function excerpt(text, max = 320, terms = []) {
  text = String(text);
  const at = terms.length ? Math.min(...terms.map(t => text.toLowerCase().indexOf(t)).filter(i => i >= 0)) : 0;
  const offset = Number.isFinite(at) ? Math.max(0, at - 70) : 0;
  return { text: text.slice(offset, offset + max), offset, chars: text.length, truncated: offset > 0 || text.length > offset + max };
}
function pageText(text, options = {}) {
  const offset = integer(options.offset, 0, 0), limit = integer(options.limit, 4000, 1, 16000);
  return { text: text.slice(offset, offset + limit), offset, chars: text.length,
    truncated: offset > 0 || offset + limit < text.length, nextOffset: offset + limit < text.length ? offset + limit : null };
}
function pageEntries(base, entries, options = {}) {
  const offset = integer(options.offset, 0, 0), limit = integer(options.limit, 8, 1, 20);
  const budget = integer(options.budget, 6000, 2000, 64000);
  const out = { ...base, total: entries.length, offset, entries: [], truncated: false, nextOffset: null };
  for (const entry of entries.slice(offset, offset + limit)) {
    out.entries.push(entry);
    // Reserve space for pagination metadata; measure the actual pretty-printed CLI format.
    if (JSON.stringify(out, null, 2).length + 120 > budget) { out.entries.pop(); break; }
  }
  if (!out.entries.length && offset < entries.length) throw new Error('Budget too small for one entry; increase --budget (max 64000).');
  out.nextOffset = offset + out.entries.length < entries.length ? offset + out.entries.length : null;
  out.truncated = offset > 0 || out.nextOffset !== null;
  return out;
}
function resultRecords(result) {
  return fields.flatMap(field => {
    const value = result[field];
    if (value === undefined) return [];
    return (Array.isArray(value) ? value : [value]).map((item, index) => ({ field, index,
      ...(item && typeof item === 'object' ? { id: item.id, status: item.status } : {}),
      ...excerpt(typeof item === 'string' ? item : JSON.stringify(item), 480) }));
  });
}
function summaryRecords(text) {
  const hs = headings(text).filter(h => h.level > 1);
  const entries = hs.map(h => ({ heading: h.title, line: h.start + 1, ...excerpt(h.text, 480) }));
  const priority = h => /issue|deviat|decision|offen|entscheid|block|abweich|grenz/i.test(h.heading) ? 0 : 1;
  entries.sort((a,b) => priority(a) - priority(b) || a.line - b.line);
  const intro = text.split('\n').slice(0,hs[0]?.start ?? text.split('\n').length).join('\n');
  if (intro.trim()) entries.unshift({ heading: null, line: 1, ...excerpt(intro, 480), read: 'Read SUMMARY_PATH from line 1 with offset/limit; includes pre-heading context' });
  return entries;
}
function handoff(root, plan, options = {}) {
  const text = read(inside(root, plan.summary));
  const raw = read(inside(root, plan.result)), result = raw === null ? null : JSON.parse(raw);
  const fm = text === null ? {} : frontmatter(text);
  const matched = result?.schema === 1 && result.plan_sha256 === plan.sha256;
  const base = { plan: plan.id, summary: text === null ? null : `.paul/${plan.summary}`,
    summarySha256: text === null ? null : hash(text), result: raw === null ? null : `.paul/${plan.result}`,
    resultSha256: raw === null ? null : hash(raw), recordedStatus: fm.result || (text ? 'legacy-unverified' : 'not-reconciled'),
    source: matched ? 'result' : 'summary',
    warning: 'Preview only, not verification. Read relevant truncated entries and all applicable issues/decisions before work. Freshness and project rules still apply.',
    read: matched ? 'result-section --plan ID --field FIELD [--item INDEX] [--offset CHARS]' : 'section --file SUMMARY_PATH --heading TITLE --limit 4000 [--offset CHARS]' };
  if (result && !matched) base.resultMismatch = 'RESULT does not match this plan revision; using SUMMARY as historical context only.';
  if (matched) {
    const receipts = JSON.parse(read(inside(root,'runtime/receipts.json')) || '{}');
    const receipt = receipts[`unify:${plan.path}`];
    const extra = text !== null && (receipt?.summaryHash !== hash(text) || receipt?.planHash !== plan.sha256) ? summaryRecords(text) : [];
    if (extra.length) {
      base.source = 'result+summary';
      base.summaryReviewRequired = 'SUMMARY is not covered by an unchanged close receipt; its sections may contain additional decisions or corrections.';
      base.summaryRead = 'section --file SUMMARY_PATH --heading TITLE --limit 4000; native Read for preamble/duplicate headings';
    }
    return pageEntries({ ...base, counts: Object.fromEntries(fields.map(f => [f, Array.isArray(result[f]) ? result[f].length : result[f] === undefined ? 0 : 1])), additionalSummarySections: extra.length }, [...extra, ...resultRecords(result)], options);
  }
  if (text === null) throw new Error('No matching RESULT or historical SUMMARY; inspect this plan and APPLY-LOG.');
  // Include every heading, including German/custom headings, with explicit previews and locations.
  return pageEntries(base, summaryRecords(text), options);
}
function resultSection(root, plan, options = {}) {
  if (!fields.includes(options.field)) throw new Error(`--field must be one of: ${fields.join(', ')}`);
  const raw = read(inside(root, plan.result));
  if (raw === null) throw new Error('No RESULT; read the historical SUMMARY or APPLY-LOG.');
  const result = JSON.parse(raw);
  let value = result[options.field];
  if (value === undefined) throw new Error('Field missing in RESULT');
  if (options.item !== undefined) {
    if (!Array.isArray(value)) throw new Error('--item requires an array field');
    const matches = value.filter(v => v?.id === options.item);
    if (matches.length > 1) throw new Error('Ambiguous item ID');
    value = matches.length ? matches[0] : /^\d+$/.test(String(options.item)) ? value[Number(options.item)] : undefined;
    if (value === undefined) throw new Error('Item not found');
  }
  return { file: `.paul/${plan.result}`, sha256: hash(raw), planMatches: result.plan_sha256 === plan.sha256,
    field: options.field, item: options.item, ...pageText(typeof value === 'string' ? value : JSON.stringify(value,null,2), options),
    instruction: 'Stored evidence, not a fresh check. Continue at nextOffset if present; preserve qualifications and waivers.' };
}
function history(root, query = '', limit = 5, options = {}) {
  const terms = [...new Set(query.toLowerCase().trim().split(/\s+/).filter(Boolean))];
  const entries = [];
  for (const file of walk(inside(root,'phases')).filter(f => /-SUMMARY\.md$/.test(f))) {
    const rel = path.relative(root,file).split(path.sep).join('/'), text = read(file), fm = frontmatter(text);
    const resultRel = rel.replace(/-SUMMARY\.md$/, '-RESULT.json'), resultText = read(inside(root,resultRel));
    // Search full evidence too, so a compact SUMMARY cannot hide a technical search term.
    const sources = [{ path: rel, text }, ...(resultText === null ? [] : [{ path: resultRel, text: resultText }])];
    const corpus = (rel + '\n' + sources.map(s => s.text).join('\n')).toLowerCase();
    const matchedTerms = terms.filter(t => corpus.includes(t));
    if (terms.length && !matchedTerms.length) continue;
    const matches = sources.flatMap(s => s.text.split('\n').flatMap((l,i) => {
      const hits = terms.filter(t => l.toLowerCase().includes(t));
      return hits.length ? [{ file: `.paul/${s.path}`, line: i+1, hits: hits.length, ...excerpt(l,220,hits) }] : [];
    })).sort((a,b) => b.hits-a.hits).slice(0,2);
    entries.push({ path: `.paul/${rel}`, sha256: hash(text), description: excerpt(fm.description || '',240),
      result: fm.result || 'legacy-unverified', matchedTerms, matches,
      completed: fm.completed || '', score: matchedTerms.length });
  }
  entries.sort((a,b) => b.score-a.score || b.completed.localeCompare(a.completed) || b.path.localeCompare(a.path,undefined,{numeric:true}));
  const page = pageEntries({ terms, matching: 'any term; ranked by distinct term coverage',
    instruction: 'Search previews, not proof of relevance or completion. Use handoff --plan ID, then relevant result-section/section. Page remaining hits with --offset.' }, entries, { ...options, limit });
  const { entries: results, ...rest } = page;
  return { ...rest, results };
}
module.exports = { excerpt, pageText, handoff, resultSection, history };
