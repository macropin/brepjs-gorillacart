#!/usr/bin/env node
// Renders an assembly scene with the accessories picked out in colour against
// the cart.
//
//   node scripts/render-assembly.mjs --scene <scene.step> --base <cart.step> --out <image.png>
//
// The brepjs viewer draws every body in one grey, so colour comes from two
// renders through the same camera: the whole scene, and the cart alone. The
// camera frames a model by its bounding box, and the scenes are built so the
// cart's box contains the accessories, which keeps the two renders pixel for
// pixel in register. Wherever they differ, an accessory is in view; those
// pixels are tinted, and the rest are darkened like the cart's black tub.
//
// Needs puppeteer (installed with brepjs-cad) and ImageMagick.

import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer';

const VIEWPORT = { width: 2000, height: 1500, deviceScaleFactor: 2 };
const SETTLE_MS = 800;
const READY_TIMEOUT_MS = 90_000;

/** Final image width, the kit's tint, and how dark the cart goes. */
const WIDTH = 1200;
const KIT_COLOUR = '#ff8a3d';
const CART_SHADE = '45%';

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 2) args[argv[i].replace(/^--/, '')] = argv[i + 1];
  for (const name of ['scene', 'base', 'out']) {
    if (!args[name]) {
      console.error('usage: render-assembly.mjs --scene <scene.step> --base <cart.step> --out <image.png>');
      process.exit(2);
    }
  }
  return args;
}

/** Screenshots the iso view of each STEP file through one viewer session. */
async function shoot(steps, outDir) {
  // brepjs-cad doesn't export its viewer server, so load it by path.
  const registry = resolve('node_modules/brepjs-cad/dist/snapshot/registry.js');
  const { acquireServer } = await import(pathToFileURL(registry).href);

  const server = await acquireServer({});
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const shots = [];
  try {
    for (const step of steps) {
      const file = resolve(step);
      const page = await browser.newPage();
      await page.setViewport(VIEWPORT);
      const url = `${server.url}/?dir=${encodeURIComponent(dirname(file))}&file=${encodeURIComponent(basename(file))}&ui=0`;
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      await page.waitForFunction('window.__ready === true', { timeout: READY_TIMEOUT_MS });
      await page.evaluate(() => globalThis.__setScene({ name: 'iso', view: 'iso' }));
      await new Promise((done) => setTimeout(done, SETTLE_MS));
      const png = join(outDir, `${basename(file, '.step')}.png`);
      await page.screenshot({ path: png });
      await page.close();
      shots.push(png);
    }
  } finally {
    await browser.close();
    await server.close();
  }
  return shots;
}

const magick = (...args) => execFileSync('magick', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });

const { scene, base, out } = parseArgs(process.argv.slice(2));
const work = mkdtempSync(join(tmpdir(), 'render-assembly-'));
try {
  const [sceneShot, baseShot] = await shoot([scene, base], work);

  // Where the two renders differ, an accessory is in view. Close pinholes left
  // where an accessory happens to match the shade of the cart behind it.
  const mask = join(work, 'mask.png');
  magick(
    sceneShot, baseShot, '-compose', 'Difference', '-composite',
    '-colorspace', 'Gray', '-threshold', '1.5%',
    '-morphology', 'Close', 'Disk:3',
    mask,
  );

  // The kit: the scene's shading lifted toward white, then multiplied by the tint.
  const kit = join(work, 'kit.png');
  magick(
    sceneShot, '-colorspace', 'Gray', '-level', '0%,72%', '-colorspace', 'sRGB',
    '(', '+clone', '-fill', KIT_COLOUR, '-colorize', '100', ')',
    '-compose', 'Multiply', '-composite',
    kit,
  );

  // The cart: the same shading, darkened. Then the kit laid over it through
  // the mask.
  const composite = join(work, 'composite.png');
  magick(
    sceneShot, '-fill', 'black', '-colorize', CART_SHADE,
    kit, mask, '-compose', 'Over', '-composite',
    composite,
  );

  // Trimmed to the scene, padded with the backdrop's own (darkened) colour,
  // scaled, and stripped of metadata so an unchanged scene gives a
  // byte-identical file.
  const backdrop = magick(composite, '-format', '%[pixel:p{0,0}]', 'info:').trim();
  mkdirSync(dirname(resolve(out)), { recursive: true });
  magick(
    composite,
    '-fuzz', '6%', '-trim', '+repage',
    '-bordercolor', backdrop, '-border', '60',
    '-filter', 'Lanczos', '-resize', `${WIDTH}x`,
    '-strip', '-define', 'png:exclude-chunks=date,time',
    resolve(out),
  );
  console.log(`assembly -> ${out}`);
} finally {
  rmSync(work, { recursive: true, force: true });
}
