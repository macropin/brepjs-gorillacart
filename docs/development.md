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
make clean      # drop out/
```

Targets act on every part, or on one with `PART=<name>`. `verify` exits non-zero unless each part is a valid solid and matches its `expected` block, and `export` runs the same validity gate first.

## Parts

Each accessory is a `src/<name>.brep.ts` module that default-exports a zero-arg function returning the shape, with its dimensions in a `params` block at the top and its declared intent in an `expected` block at the bottom.

| Part | Module | Page |
| --- | --- | --- |
| Side extension post | [src/side-extension.brep.ts](../src/side-extension.brep.ts) | [Side extension kit](side-extension-kit.md#posts) |
| Side panel | [src/side-panel.brep.ts](../src/side-panel.brep.ts) | [Side extension kit](side-extension-kit.md#side-panels) |
| Corner panels | [src/corner-panel-left.brep.ts](../src/corner-panel-left.brep.ts), [src/corner-panel-right.brep.ts](../src/corner-panel-right.brep.ts) | [Side extension kit](side-extension-kit.md#corner-panels) |
| Tie-down block | [src/tie-down-block.brep.ts](../src/tie-down-block.brep.ts) | [Tie-down block](tie-down-block.md) |
| Pole tool holder | [src/pole-holder.brep.ts](../src/pole-holder.brep.ts) | [Pole tool holder](pole-holder.md) |
| Machete sleeve | [src/machete-sleeve.brep.ts](../src/machete-sleeve.brep.ts) | [Machete sleeve](machete-sleeve.md) |

Shared code lives alongside: [src/cart.ts](../src/cart.ts) for the [cutout measurements](cart.md), [src/key.ts](../src/key.ts) for the bar, [src/corner-panel.ts](../src/corner-panel.ts) for the corner panel shape both corner parts share, and [src/solid.ts](../src/solid.ts) for boolean result handling.

## Assembly renders

`make assemblies` renders each scene in `src/assemblies/`: accessories placed on a schematic cart ([src/assemblies/cart.brep.ts](../src/assemblies/cart.brep.ts)). Scenes aren't parts, so they're never checked against dimensions or exported for printing.

The viewer draws every body in the same grey, so [scripts/render-assembly.mjs](../scripts/render-assembly.mjs) renders the scene and the bare cart through the same camera, then colours whatever the scene adds. It needs ImageMagick.

Scenes listed in `CLOSEUPS` in the [Makefile](../Makefile) are framed on the accessories and the stretch of rim around them, rather than on the whole cart. Use it for accessories too small to read at full-cart scale.
