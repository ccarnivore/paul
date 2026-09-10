#!/usr/bin/env node
'use strict';
const path = require('path');
const os = require('os');
const readline = require('readline');
const { install, rollback } = require('../src/runtime/install');
function parse(args) {
  const opts = {}, aliases = { '-g':'--global', '-l':'--local', '-c':'--config-dir', '-h':'--help' };
  while (args.length) {
    let arg = args.shift(); arg = aliases[arg] || arg;
    const eq = arg.indexOf('=');
    if (eq >= 0) { args.unshift(arg.slice(eq+1)); arg = aliases[arg.slice(0,eq)] || arg.slice(0,eq); }
    if (['--global','--local','--help','--dry-run','--replace-customized'].includes(arg)) opts[arg.slice(2)] = true;
    else if (['--config-dir','--project','--rollback'].includes(arg)) {
      if (!args.length || !args[0] || args[0].startsWith('-')) throw new Error(`${arg} requires a value`);
      opts[arg.slice(2)] = args.shift();
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  if (opts.global && (opts.local || opts.project)) throw new Error('--global cannot be combined with --local/--project');
  if (opts['config-dir'] && (opts.local || opts.project)) throw new Error('--config-dir cannot be combined with --local/--project');
  return opts;
}
function expand(p) { return p.startsWith('~/') ? path.join(os.homedir(),p.slice(2)) : p; }
function run(opts) {
  const config = opts.project ? path.join(path.resolve(expand(opts.project)),'.claude') : opts.local ? path.join(process.cwd(),'.claude') : path.resolve(expand(opts['config-dir'] || process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(),'.claude')));
  const settings = { dryRun: !!opts['dry-run'], replaceCustomized: !!opts['replace-customized'] };
  const result = opts.rollback ? rollback(config, opts.rollback, settings) : install(path.join(__dirname,'..'), config, settings);
  console.log(JSON.stringify(result, null, 2));
  if (settings.dryRun && result.conflicts?.length) process.exitCode = 2;
}
try {
  const opts = parse(process.argv.slice(2));
  if (opts.help) console.log(`PAUL for Claude Code — installer / upgrade / rollback

node bin/install.js --project /absolute/project --dry-run
node bin/install.js --project /absolute/project
node bin/install.js --local
node bin/install.js --global [--config-dir PATH]
node bin/install.js --project /absolute/project --rollback BACKUP_ID

--dry-run             Preview without filesystem writes (exit 2: customized files)
--replace-customized Explicitly replace reviewed custom core files, with backup
--rollback ID         Restore installation backup; refuses subsequent local edits

Existing .paul project data, other skills, and custom extension blocks are preserved.
Reload/restart Claude Code after installation. No Codex dependency.`);
  else if (opts.global || opts.local || opts.project || opts['config-dir']) run(opts);
  else {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question('Install PAUL for Claude Code: [1] global [2] local (default 1): ', answer => {
      rl.close();
      try { if (answer.trim() && !['1','2'].includes(answer.trim())) throw new Error('Choose 1 or 2'); run({ ...opts, local: answer.trim()==='2' }); }
      catch (e) { console.error(e.message); process.exitCode = 1; }
    });
  }
} catch (e) { console.error(e.message); process.exitCode = 1; }
