# Gorilla Cart Accessories

3D-printable accessories that plug into the rim cutouts of the [Gorilla Cart 200L Poly Dump Cart](https://gorillacarts.com.au/collections/poly-carts/products/gcg7-au). Nothing is drilled or bolted to the cart: each part drops into a cutout and lifts out again.

## Accessories

<table>
<tr>
<td width="50%" valign="top">

[![The side extension kit fitted to the cart, in orange](media/side-extensions-assembled.png)](docs/side-extension-kit.md)

### [Side extension kit](docs/side-extension-kit.md)

Raises the walls 150 mm on three sides, taking the cart from 200 L to about 280 L.

**Print:** 8 posts, 5 side panels, 2 corner panels

</td>
<td width="50%" valign="top">

[![Two tie-down blocks on the cart's rim, in orange](media/tie-down-block-assembled.png)](docs/tie-down-block.md)

### [Tie-down block](docs/tie-down-block.md)

A strap point for holding down an oversize load such as branches.

**Print:** one per cutout, as many as you need

</td>
</tr>
<tr>
<td width="50%" valign="top">

[![Two pole tool holders on the cart's rim, in orange](media/pole-holder-assembled.png)](docs/pole-holder.md)

### [Pole tool holder](docs/pole-holder.md)

A snap clip that carries a 25 mm tool pole along the rim.

**Print:** two per pole

</td>
<td width="50%" valign="top">

[![The machete sleeve standing in a cutout, in orange](media/machete-sleeve-assembled.png)](docs/machete-sleeve.md)

### [Machete sleeve](docs/machete-sleeve.md)

A slotted bar that carries a machete on the rim.

**Print:** one

</td>
</tr>
<tr>
<td width="50%" valign="top">

[![The EGO battery holder standing in a cutout, in orange](media/ego-battery-holder-assembled.png)](docs/ego-battery-holder.md)

### [EGO battery holder](docs/ego-battery-holder.md)

Upright rails that an EGO 56V battery slides onto, as on a wall mount.

**Print:** one per battery

</td>
<td width="50%" valign="top">

</td>
</tr>
</table>

## Will it fit?

The accessories are designed for the 200L poly dump cart linked above. Its rim has eight cutouts, each 51.3 × 19.5 mm and 63.5 mm deep: three along each long side and two at the handle end. Every accessory stands on the same 51.0 × 19.2 mm key that drops into one.

The side extension kit uses all eight cutouts. The other accessories take one cutout each, in any combination. With the kit fitted, the machete sleeve, EGO battery holder and tie-down block bolt to its posts instead, two deep if you like, with M5 bolts: see [Stacking accessories](docs/side-extension-kit.md#stacking-accessories).

Full measurements: [Cart cutout dimensions](docs/cart.md).

## Printing

| Part | Quantity | Overall size (mm) | Notes |
| --- | --- | --- | --- |
| [Side extension post](docs/side-extension-kit.md#posts) | 8 | 34.88 × 51.0 × 213.7 | Print standing |
| [Side panel](docs/side-extension-kit.md#side-panels) | 5 | 295.4 × 150 × 7.7 | **Needs a bed at least 296 mm long.** Print flat, lips up. Print the handle-end panel in PETG |
| [Corner panel](docs/side-extension-kit.md#corner-panels) | 1 left, 1 right | 142.3 × 164.6 × 149.2 | Print standing, with a brim |
| [Tie-down block](docs/tie-down-block.md) | 1 per cutout | 19.2 × 72 × 103.5 | Print lying on a broad face, no supports |
| [Pole tool holder](docs/pole-holder.md) | 2 per pole | 31.6 × 51.0 × 133.3 | Print standing |
| [Machete sleeve](docs/machete-sleeve.md) | 1 | 19.2 × 51.0 × 193.5 | Print standing, with a brim |
| [EGO battery holder](docs/ego-battery-holder.md) | 1 per battery | 19.2 × 92 × 186.5 | Print standing, with a brim |

Each accessory's page has its printing and fitting instructions.

## Getting the files

The models are code, so the STL and STEP files are built from source. This needs Node 24+ (`brew install node`).

```bash
make install
```

```bash
make export
```

The files land in `out/<part>/`. To change a dimension, edit the `params` block at the top of the part's `src/<part>.brep.ts` and export again.

See [Development](docs/development.md) for the toolchain, the other make targets and how the renders are produced.

## Licence

[MIT](LICENSE)
