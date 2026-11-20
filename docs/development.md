# Development

[← All accessories](../README.md)

Modelled in [brepjs](https://github.com/andymai/brepjs), code-first B-rep CAD in TypeScript, with OpenCascade compiled to WebAssembly as the kernel. Requires Node 24+ (`brew install node`).

```bash
make install
```

## Make targets

```bash
make            # list the targets and parts
make verify     # kernel validity + assert declared dimensions
make render     # multi-view PNGs into out/<name>/shots, refresh media/<name>.png
make export     # STEP + STL into out/<name>/
make assemblies # assembled renders into media/<name>-assembled.png
make all        # verify, render, export, assemblies
make preview PART=machete-sleeve   # live viewer, re-evaluates on save
make sweep      # build each part at the limits of its adjustable dimensions, and verify each
make web        # run the STL generator locally
make web-build  # type-check and build the STL generator into web/dist
make clean      # drop out/ and the generator's build output
```

Targets act on every part, or on one with `PART=<name>`. `verify` exits non-zero unless each part is a valid solid and matches its `expected` block, and `export` runs the same validity gate first.

## Parts

Each accessory is a `src/<name>.brep.ts` module. At the top, a `defaults` block holds every dimension the part is built from, and a `schema` names the ones the [STL generator](#stl-generator) lets a user change, each with a range. Below them, `design(params)` builds the part from any set of parameters, returning its `model` and its declared intent, `expected`. The module default-exports a zero-arg function returning the part at its defaults, and exports its `expected`, which is what the brep CLI builds and checks. See [src/params.ts](../src/params.ts).

Every part that fits into a cutout or a groove takes `fitTolerance`, the slop between a printed part and what it fits into. The parts that stack also take `boltHoles` and `registration`. These are toggles: 1 includes that [stacking feature](side-extension-kit.md#stacking-accessories), and 0 leaves it off. See [src/stacking.ts](../src/stacking.ts). A choice between forms of a feature numbers its options, like the tie-down block's `openings`: 0 for two holes, 1 or 2 for that many slits. A parameter with a `when` applies only under some options, so the generator shows it only then: the hole size only for holes, the slit size only for slits. The side panels and corner panels take the posts' parameters, from [src/side-extension.brep.ts](../src/side-extension.brep.ts), so the whole kit always fits together.

| Part | Module | Page |
| --- | --- | --- |
| Side extension post | [src/side-extension.brep.ts](../src/side-extension.brep.ts) | [Side extension kit](side-extension-kit.md#posts) |
| Side panel | [src/side-panel.brep.ts](../src/side-panel.brep.ts) | [Side extension kit](side-extension-kit.md#side-panels) |
| Corner panels | [src/corner-panel-left.brep.ts](../src/corner-panel-left.brep.ts), [src/corner-panel-right.brep.ts](../src/corner-panel-right.brep.ts) | [Side extension kit](side-extension-kit.md#corner-panels) |
| Tie-down block | [src/tie-down-block.brep.ts](../src/tie-down-block.brep.ts) | [Tie-down block](tie-down-block.md) |
| Pole tool holder | [src/pole-holder.brep.ts](../src/pole-holder.brep.ts) | [Pole tool holder](pole-holder.md) |
| Pole tool holder, rigid clip | [src/pole-holder-rigid.brep.ts](../src/pole-holder-rigid.brep.ts) | [Pole tool holder](pole-holder.md#rigid-clip) |
| Machete sleeve | [src/machete-sleeve.brep.ts](../src/machete-sleeve.brep.ts) | [Machete sleeve](machete-sleeve.md) |
| EGO battery holder | [src/ego-battery-holder.brep.ts](../src/ego-battery-holder.brep.ts) | [EGO battery holder](ego-battery-holder.md) |
| Mounting plate | [src/mounting-plate.brep.ts](../src/mounting-plate.brep.ts) | [Mounting plate](mounting-plate.md) |
| Stack locator | [src/stack-locator.brep.ts](../src/stack-locator.brep.ts) | [Side extension kit](side-extension-kit.md#stack-locator) |

Shared code lives alongside: [src/cart.ts](../src/cart.ts) for the [cutout measurements](cart.md), [src/key.ts](../src/key.ts) for the bar, [src/stacking.ts](../src/stacking.ts) for the bolt holes and registration that [stack accessories](side-extension-kit.md#stacking-accessories) on the posts, [src/corner-panel.ts](../src/corner-panel.ts) for the corner panel shape both corner parts share, [src/compliant-clip.ts](../src/compliant-clip.ts) for the pole tool holder's compliant clip, [src/outline.ts](../src/outline.ts) for profiles drawn whole as exact lines and arcs (that clip, and the rigid clip's rolled lips), and [src/solid.ts](../src/solid.ts) for boolean result handling.

## Assembly renders

`make assemblies` renders each scene in `src/assemblies/`, or one with `SCENE=<name>`: accessories placed on a schematic cart ([src/assemblies/cart.brep.ts](../src/assemblies/cart.brep.ts)). Scenes aren't parts, so they're never checked against dimensions or exported for printing.

The viewer draws every body in the same grey, so [scripts/render-assembly.mjs](../scripts/render-assembly.mjs) renders the scene and the bare cart through the same camera, then colours whatever the scene adds. It needs ImageMagick.

A scene with a module of the same name in `src/assemblies/backdrops/` is rendered against that backdrop instead of the bare cart, so only what it adds to the backdrop is coloured. The stacked accessories use this to show against the side extension kit in grey. The camera frames each model by its bounding box, so a scene and its backdrop need the same box. Where a scene reaches beyond the cart's box, give both the same specks just outside it, as [src/assemblies/side-extensions-stacked.brep.ts](../src/assemblies/side-extensions-stacked.brep.ts) does.

Scenes listed in `CLOSEUPS` in the [Makefile](../Makefile) are framed on the accessories and the stretch of rim around them, rather than on the whole cart. Use it for accessories too small to read at full-cart scale.

## STL generator

[web/](../web) is the STL generator, published at <https://macropin.github.io/brepjs-gorillacart/>. It builds the parts in the browser from the `src/` modules above. [STL generator](stl-generator.md) describes what each accessory lets you change, how it works, adding a setting, and publishing.

```bash
make web        # http://localhost:5173/brepjs-gorillacart/, rebuilding on save
make web-build  # type-check, then build web/dist as GitHub Pages serves it
make sweep      # build every part at the limits of what the generator lets you change
```
