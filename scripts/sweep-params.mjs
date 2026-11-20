#!/usr/bin/env node
// Builds every part at the limits of the parameters the online generator lets
// a user change, and verifies each build as `make verify` does: a valid solid
// that matches its declared intent.
//
//   node scripts/sweep-params.mjs [part ...]
//
// For each parameter in a part's `schema`, the part is built with that
// parameter at its minimum and at its maximum and everything else at its
// defaults; a toggle's range is off and on. A choice is built with each of its
// options, and under each option every parameter that applies to it is swept
// as above. So is a toggle or dimension that other parameters depend on,
// through `when`: built at each of its values, or its minimum and maximum. Each build is a small wrapper module in out/sweep/ that the brep
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

const { applies } = await import(pathToFileURL(resolve('src/params.ts')).href);

const cases = [];
for (const part of parts) {
  const mod = await import(pathToFileURL(resolve(`src/${part}.brep.ts`)).href);
  const schema = Object.entries(mod.schema ?? {});

  // Every combination of the choices' options, and of the values of toggles
  // other parameters depend on: just {} for a part with none.
  const dependedOn = new Set(schema.flatMap(([, s]) => Object.keys(s.when ?? {})));
  const optionsOf = (spec) =>
    spec.kind === 'choice' ? spec.options.map((o) => o.value) : [spec.min, spec.max];
  const contextNames = schema
    .filter(([name, s]) => s.kind === 'choice' || dependedOn.has(name))
    .map(([name]) => name);
  let contexts = [{}];
  for (const name of contextNames) {
    const spec = mod.schema[name];
    // Only where it applies itself: the gap to a plate that isn't there isn't a case.
    contexts = contexts.flatMap((context) =>
      applies(spec, { ...mod.defaults, ...context })
        ? optionsOf(spec).map((v) => ({ ...context, [name]: v }))
        : [context],
    );
  }

  for (const context of contexts) {
    if (Object.keys(context).length) add(part, context);
    const values = { ...mod.defaults, ...context };
    for (const [name, spec] of schema) {
      if (contextNames.includes(name) || !applies(spec, values)) continue;
      add(part, { ...context, [name]: spec.min });
      add(part, { ...context, [name]: spec.max });
    }
  }
}

/** Writes a wrapper building `part` with `overrides` over its defaults. */
function add(part, overrides) {
  const entries = Object.entries(overrides);
  const label = `${part}: ${entries.map(([name, value]) => `${name} = ${value}`).join(', ')}`;
  const file = `${OUT}/${part}--${entries.map(([name, value]) => `${name}-${value}`).join('--')}.brep.ts`;
  writeFileSync(
    file,
    [
      `// ${label}. Written by scripts/sweep-params.mjs.`,
      `import { defaults, design } from '../../src/${part}.brep.js';`,
      ``,
      `const built = design({ ...defaults, ...${JSON.stringify(overrides)} });`,
      `export default built.model;`,
      `export const expected = built.expected;`,
      ``,
    ].join('\n'),
  );
  cases.push({ label, file });
}

console.log(`sweep: ${cases.length} builds across ${parts.length} parts`);

let failed = 0;
for (const c of cases) {
  const report = `${c.file.slice(0, -'.brep.ts'.length)}.json`;
  const { label } = c;
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
