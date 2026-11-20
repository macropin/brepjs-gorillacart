# STL generator

[← Development](development.md)

The [STL generator](https://macropin.github.io/brepjs-gorillacart/) is a static site, in [web/](../web). You pick an accessory, change its dimensions, preview it in 3D and download an STL or STEP file. It builds each part in your browser from the same `src/` modules, on the same kernel, as `make export`. There's no server, and nothing is uploaded.

```bash
make web        # http://localhost:5173/brepjs-gorillacart/, rebuilding on save
make web-build  # type-check, then build web/dist as GitHub Pages serves it
make sweep      # build every part at the limits of what the generator lets you change
```

## What you can change

The defaults are the parts as printed from this repo.

| Accessory | Setting | Range | Default |
| --- | --- | --- | --- |
| Side extension kit | Extension height | 80–250 mm | 150 mm |
| | Outward lean | 0–10° | 6° |
| | Groove width | 3–6 mm | 4 mm |
| | Bolt holes, registration boss (posts only) | On or off | On |
| Tie-down block | Strap openings | Two holes, one slit or two slits | Two holes |
| | Strap hole diameter (holes only) | 10–24 mm | 20 mm |
| | Slit length (slits only) | 15–50 mm | 28 mm |
| | Slit height (slits only) | 3–8 mm | 6 mm |
| | Bolt holes, registration pockets | On or off | On |
| Pole tool holder | Pole diameter | 16–40 mm | 25.3 mm |
| | Clip | Compliant or rigid | Compliant |
| | Snap (compliant only) | 2–6 mm | 5 mm |
| | Spring band thickness (compliant only) | 1.5–3 mm | 2 mm |
| | Snap lip height (rigid only) | 1–7 mm | 4 mm |
| | Clip wall (rigid only) | 2–6 mm | 3 mm |
| | Rolled leading edge (rigid only) | On or off | On |
| | Roll bulge (with the rolled edge) | 0–2 mm | 1 mm |
| | Height above the rim | 10–150 mm | 50 mm |
| | Bolt holes, registration pockets | On or off | On |
| Machete sleeve | Blade thickness | 1.5–8 mm | 3 mm |
| | Slot length | 40–200 mm | 110 mm |
| | Bolt holes, registration pockets | On or off | On |
| EGO battery holder | Bolt holes, registration pockets | On or off | On |
| Mounting plate | Hanging plate | On or off | On |
| | Plate drop (with the plate) | 50–200 mm | 100 mm |
| | Plate thickness (with the plate) | 3–8 mm | 4 mm |
| | Bridge thickness | 3–15 mm | 4 mm |
| | Gap to the rim (with the plate) | 3–30 mm | 5 mm |
| | Hole columns | 2–3 | 2 |
| | Hole rows (with the plate) | 2–5 | 2 |
| | Hole diameter | 3–7 mm | 5.5 mm (M5) |
| | Holes in the top (with the plate and a gap of 14 mm or more; always there without it) | On or off | On |
| | Registration boss, bolt holes (with the plate) | On or off | Off |
| All but the stack locator | Fit tolerance | 0–1 mm | 0.3 mm |

- **The kit** shares its settings across its parts. The posts, side panels and corner panels are all built from the same extension, lean and groove width, so they always fit each other. The stack locator has nothing to change: the pockets in the keys take the fit.
- **Fit tolerance** belongs to the printer, not the part, so changing it on one accessory changes it on the others too.
- **The pole tool holder's compliant clip** grows with the pole and its bands. The snap sets how far round the bore the heads sit, so the opening is that much narrower than the pole. See [Compliant clip](pole-holder.md#compliant-clip).
- **The pole tool holder bolted to a post** needs its height above the rim raised to at least the post's extension less 68.5 mm, so the clip clears the post's top. The page can't check this: the holder doesn't know the kit's settings. See [Bolting it to a post](pole-holder.md#bolting-it-to-a-post).
- **The pole tool holder's rolled edge**, on the rigid clip, starts where the bore ends, at the snap lip height, and is the wall plus the bulge across. See [Rolled leading edge](pole-holder.md#rolled-leading-edge).
- **The machete sleeve's bar** grows with its slot, keeping 8.35 mm of solid above and below it.
- **The mounting plate without its plate** is a bracket on the rim: the bridge reaching out past it, with only the holes in its top.
- **The EGO battery holder's rails** match EGO's own wall mounts, so they don't change.
- **Some combinations** of settings, each in range on its own, would leave a wall too thin to print, such as a big snap lip on a small pole. The part then refuses to build, and the page says which wall and by how much.

## How it works

### Parameters

Each part, in `src/<name>.brep.ts`, exports three things ([src/params.ts](../src/params.ts)):

- `defaults`: every dimension the part is built from.
- `schema`: the settings a user may change.
- `design(params)`: the part built from any set of parameters, returning its `model` and its declared intent, `expected`.

The module's default export is the part at its defaults, which is what the brep CLI builds and `make verify` checks.

Every parameter is a number, so a set of them goes in a URL as it is. A schema entry is one of three kinds:

| Kind | Values | Drawn as |
| --- | --- | --- |
| Dimension | A `min`, `max` and `step`, in mm or degrees, or a count with no unit and a step of 1 | A slider and a number box |
| Toggle | 1 for on, 0 for off | A switch |
| Choice | Numbered options, such as the tie-down block's `openings`: 0 for two holes, 1 or 2 for that many slits | A row of buttons |

An entry's `group` puts it in a section of the form: Dimensions, Holes, Stacking or Fit. A `when` makes it apply only while another parameter has certain values, or lies in a range. The form then shows it only in that case, and the build and file name leave it out otherwise: the hole size only for holes, the slit size only for slits.

`design` throws a `DesignError` for a combination it won't build (see `atLeast`), and the page shows that message in place of the part.

### In the browser

- **[web/src/worker.ts](../web/src/worker.ts)** builds the parts, in a Web Worker so the page stays responsive.
  - As soon as it starts, it sends each part's defaults and schema to the page. The form draws straight away, and brepjs only ever loads in the worker.
  - It then downloads OpenCascade (`occt-wasm`, 21 MB, 6.9 MB gzipped), reporting progress, and keeps it in the browser's Cache Storage for later visits.
  - For each build, it checks the part's volume and bounds against `expected`, as `brep verify` does, and warns if they don't match. It returns the part as a binary STL, and as a STEP on request from the same build.
- **[web/src/main.ts](../web/src/main.ts)** runs the page: the accessory picker, part tabs, form, downloads and URL.
  - Edits settle for 250 ms before a build. Only one build runs at a time, and only the newest waits behind it.
  - The URL holds the accessory, part and changed values, such as `#tie-down-block?openings=2`, so a link brings back the same part.
  - File names carry the changed values, such as `pole-holder-poleDiameter32.stl`.
- **[web/src/viewer.ts](../web/src/viewer.ts)** draws the STL itself with three.js, so the preview is exactly the file you download. It renders on demand, not in a loop.

Every part, defaults included, is built in the browser: nothing is pre-built. The kernel needs WebAssembly SIMD, tail calls and exceptions. Where it can't start, the page says so and points to building from source.

## Layout

```
web/
  index.html
  vite.config.ts        base path, kernel size for download progress
  tsconfig.json
  src/main.ts           the page: picker, form, build queue, downloads, URL
  src/worker.ts         the kernel, builds, checks, STL and STEP export
  src/viewer.ts         three.js preview
  src/accessories.ts    the accessories and their parts, as the README lists them
  src/parts.ts          the part modules, for the worker
  src/protocol.ts       messages between the page and the worker
  src/style.css
src/params.ts           parameter kinds, `applies`, `DesignError`
src/stacking.ts         the stacking features, and their toggles
scripts/sweep-params.mjs
scripts/ts-hooks.mjs    lets Node import the .ts parts directly
.github/workflows/pages.yml
```

## Libraries and tools

| What | Version | Used for |
| --- | --- | --- |
| [brepjs](https://github.com/andymai/brepjs) | 20.13.2 | Modelling, `exportSTL`, `exportSTEP`, measuring. Pinned to the version brepjs-cad uses, so the site and the CLI build the same parts |
| [occt-wasm](https://github.com/andymai/occt-wasm) | 5.11.0 | The OpenCascade kernel. LGPL-2.1: served unmodified and credited on the page |
| [three.js](https://threejs.org) | 0.187.0 | The preview: `STLLoader`, `OrbitControls`, `EdgesGeometry` |
| [Vite](https://vite.dev) | 8.3.6 | Dev server, and the production build with the worker and the kernel as assets |
| TypeScript | 6.0.3 | Type-checking the site in `make web-build` |
| GitHub Actions | | `checkout@v7`, `setup-node@v7` (Node 24), `configure-pages@v6`, `upload-pages-artifact@v5`, `deploy-pages@v5` |

The page itself uses no UI framework or CSS library: plain TypeScript and CSS, with light and dark themes.

## Checks

- **`make verify`** checks every part at its defaults, as it always has.
- **`make sweep`** ([scripts/sweep-params.mjs](../scripts/sweep-params.mjs)) checks every setting the generator offers.
  - It builds each part with each dimension at its minimum and at its maximum, and each toggle off and on, with everything else at its defaults.
  - It builds a choice with each of its options, a switch that other settings depend on both on and off, and a dimension they depend on at its minimum and its maximum, such as the mounting plate's gap. Under each, it sweeps every setting that applies the same way.
  - It verifies each build as `make verify` does. A `DesignError` at a limit counts as a failure too: it means the range is too wide.
  - It's about 150 builds, a few minutes.

The sweep doesn't try combinations of several settings at their limits. The `DesignError` checks in each `design` cover the walls those could thin. A combination the kernel itself can't build shows an error asking to nudge a value.

## Adding a setting

1. Add it to the part's `defaults`, and use it in `design`.
2. Add it to the part's `schema`: a dimension with a range, a toggle, or a choice, with a `group` or `when` if it needs one.
3. Run `make sweep`.

If a limit fails, narrow the range. If it only fails in combination with another setting, have `design` refuse that combination with a clear `DesignError`. Keep the default part unchanged: `make verify` asserts it against its `expected` block.

## Publishing

[.github/workflows/pages.yml](../.github/workflows/pages.yml) runs `make verify`, `make sweep` and `make web-build` on every push to `main`, then deploys `web/dist` to GitHub Pages. It needs setting up once, in the repository's Settings → Pages → Build and deployment: set Source to **GitHub Actions**.

The site is built for `/brepjs-gorillacart/`. The workflow passes the path Pages reports in `BASE_PATH`, so a custom domain or a fork under another name works too.

## Known issues

- **First load.** Check whether Pages serves `occt-wasm.wasm` compressed (`Content-Encoding` in the response). If it doesn't, a first visit downloads 21 MB instead of 6.9 MB. Later visits load it from Cache Storage.
- **Tie-down slits.** The chamfer round the slit mouths isn't in the declared volume. At the largest pair of slits the gap is 0.39%, inside the block's 0.5% tolerance. Slits much larger than the current limits would need it modelled.
- **Pole holder bore.** On the rigid clip with a flat lip, OCCT can't chamfer the bore mouths for some sizes. The part then cuts a 45° countersink at each end instead, which makes the same bevel.
- **Not byte for byte.** An STL from the generator isn't byte-identical to one from `make export`. The CLI writes ASCII STL and the site writes binary. OCCT can also triangulate a few faces of the leaning parts differently in Node and in the browser. The solids are the same.
- **The rim's outside edge.** The mounting plate's gap is measured from the rim's outside edge, 14 mm out from the cutout's centre line. That figure comes from product photos, not a measurement.
- **Assemblies.** The `src/assemblies/` scenes and the README renders stay offline: they aren't parts.
