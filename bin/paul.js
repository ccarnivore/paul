#!/usr/bin/env node
'use strict';
try { console.log(JSON.stringify(require('../src/runtime/cli').main(), null, 2)); }
catch (e) { console.error(JSON.stringify({ error: e.message })); process.exitCode = 1; }
