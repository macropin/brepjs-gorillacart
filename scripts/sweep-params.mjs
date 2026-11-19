#!/usr/bin/env node
// Builds every part at the limits of the parameters the online generator lets
// a user change, and verifies each build as `make verify` does: a valid solid
// that matches its declared intent.
//
//   node scripts/sweep-params.mjs [part ...]
//
// For each parameter in a part's `schema`, the part is built with that
// parameter at its minimum and at its maximum and everything else at its
// defaults. Each build is a small wrapper module in out/sweep/ that the brep
// CLI verifies. A part whose `design` refuses a limit (a DesignError) fails the
// sweep too: the range in its schema is too wide.

import './ts-hooks.mjs';

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const OUT = resolve('out/sweep');
const only = process.argv.slice(2);
const parts = readdirSync('src')
  .filter((f) => f.endsWith('.brep.ts'))
  .map((f) => basename(f, '.brep.ts'))
  .filter((p) => only.length === 0 || only.includes(p));

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const cases = [];
for (const part of parts) {
  const mod = await import(pathToFileURL(resolve(`src/${part}.brep.ts`)).href);
  for (const [name, spec] of Object.entries(mod.schema ?? {})) {
    for (const [end, value] of [
      ['min', spec.min],
      ['max', spec.max],
    ]) {
      const file = `${OUT}/${part}--${name}-${end}.brep.ts`;
      writeFileSync(
        file,
        [
          `// ${part} with ${name} at its ${end}imum, ${value}. Written by scripts/sweep-params.mjs.`,
          `import { defaults, design } from '../../src/${part}.brep.js';`,
          ``,
          `const built = design({ ...defaults, ${name}: ${value} });`,
          `export default built.model;`,
          `export const expected = built.expected;`,
          ``,
        ].join('\n'),
      );
      cases.push({ part, name, end, value, file });
    }
  }
}

console.log(`sweep: ${cases.length} builds across ${parts.length} parts`);

let failed = 0;
for (const c of cases) {
  const report = `${c.file.slice(0, -'.brep.ts'.length)}.json`;
  const label = `${c.part}: ${c.name} = ${c.value} (${c.end})`;
  try {
    execFileSync('npx', ['brep', 'verify', c.file, '--check', '--json', report], {
      stdio: ['ignore', 'ignore', 'ignore'],
    });
    console.log(`  ok    ${label}`);
  } catch {
    failed++;
    console.log(`  FAIL  ${label}\n        ${why(report)}`);
  }
}

/** The failed assertions and errors in a verify report, in a line. */
function why(report) {
  if (!existsSync(report)) return 'no report written';
  const r = JSON.parse(readFileSync(report, 'utf8'));
  const failed = (r.assertions ?? [])
    .filter((a) => !a.passed)
    .map((a) => `${a.name}: expected ${a.expected}, got ${a.actual}`);
  return [...failed, ...(r.errors ?? []).map(String)].join('; ').slice(0, 300) || `see ${report}`;
}

if (failed) {
  console.error(`sweep: ${failed} of ${cases.length} builds failed`);
  process.exit(1);
}
console.log('sweep: every limit builds and verifies');
