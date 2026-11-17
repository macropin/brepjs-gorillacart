# Pole tool holder

[← All accessories](../README.md)

![Two pole tool holders, in orange, fitted to neighbouring cutouts on one side of the cart's rim, their clips in line](../media/pole-holder-assembled.png)

Carries a long-handled tool along the rim. The key has a U-shaped clip on its top face, for a 25.3 mm tool pole. The pole lies along the rim and snaps in through an opening narrower than the bore.

## What to print

One holder per cutout. The render shows a pair in neighbouring cutouts, 330.7 mm apart, with their clips in line. Source: [src/pole-holder.brep.ts](../src/pole-holder.brep.ts).

For a different pole, change `poleDiameter`. For a taller or shorter stand, change `standHeight`: the clip always sits on the bar's top face.

## Dimensions

![The pole tool holder: a rounded bar with a U-shaped snap clip on top](../media/pole-holder.png)

| | |
|---|---|
| Bar | 19.2 × 51.0 × 113.2 mm (63.5 insert + 50 above the rim − 0.3) |
| Clip profile | Convex hull of the bar's top edge and a 31.6 mm circle, cut flat 4 mm above the circle centre; extruded 51 mm along Y |
| Side lines | From the bar's top corners (±9.6) to tangent points at (±14.02, 8.52) above the bar |
| Bore | 25.6 mm (25.3 + 0.3) along Y, centre 15.8 mm above the bar top (z = 129.0) |
| Wall | 3 mm around the bore and under it |
| Opening | 24.32 mm, 1.28 mm narrower than the bore; 3.13 mm flat lip either side |
| Overall | 31.6 (X) × 51.0 (Y) × 133.0 (Z) mm |

## Design notes

The bar is 50 mm above the rim, as the original file's comment intends, rather than the 193.2 mm machete bar the file actually used.

The clip is a plain extrusion, so its four bottom corners are square where they meet the bar's 3 mm rounded corners. That leaves a slight overhang of up to 1.2 mm at each corner. The original's hull blended these corners into a small twist near the base. A 3 mm fillet doesn't reproduce that here: OCCT carries it up the outer arc to the top lips.
