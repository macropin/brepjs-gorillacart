// The accessories as the README lists them, and the parts each one prints as.
// Every part of an accessory shares its parameters: the kit's panels are sized
// from its posts. Plain data, so the page loads none of the geometry code.

import egoImage from '../../media/ego-battery-holder-assembled.png';
import macheteImage from '../../media/machete-sleeve-assembled.png';
import plateImage from '../../media/mounting-plate-assembled.png';
import poleImage from '../../media/pole-holder-assembled.png';
import kitImage from '../../media/side-extensions-assembled.png';
import tieDownImage from '../../media/tie-down-block-assembled.png';

export const REPO = 'https://github.com/macropin/brepjs-gorillacart';

export interface PartInfo {
  /** The part's module, src/<id>.brep.ts, and its file names. */
  id: string;
  title: string;
  /** How many to print. */
  count: string;
}

export interface AccessoryInfo {
  id: string;
  title: string;
  summary: string;
  /** Its page in docs/. */
  doc: string;
  image: string;
  parts: PartInfo[];
}

export const accessories: AccessoryInfo[] = [
  {
    id: 'side-extension-kit',
    title: 'Side extension kit',
    summary: 'Raises the walls on three sides: 150 mm as printed, taking the cart from 200 L to about 280 L.',
    doc: 'side-extension-kit',
    image: kitImage,
    parts: [
      { id: 'side-extension', title: 'Post', count: 'Print 8' },
      { id: 'side-panel', title: 'Side panel', count: 'Print 5' },
      { id: 'corner-panel-left', title: 'Left corner', count: 'Print 1' },
      { id: 'corner-panel-right', title: 'Right corner', count: 'Print 1' },
      { id: 'stack-locator', title: 'Stack locator', count: 'One per stacked pair' },
    ],
  },
  {
    id: 'tie-down-block',
    title: 'Tie-down block',
    summary: 'A strap point for holding down an oversize load such as branches.',
    doc: 'tie-down-block',
    image: tieDownImage,
    parts: [{ id: 'tie-down-block', title: 'Tie-down block', count: 'One per cutout, as many as you need' }],
  },
  {
    id: 'pole-holder',
    title: 'Pole tool holder',
    summary: 'A snap clip that carries a long-handled tool along the rim.',
    doc: 'pole-holder',
    image: poleImage,
    parts: [{ id: 'pole-holder', title: 'Pole tool holder', count: 'Print 2 per pole' }],
  },
  {
    id: 'machete-sleeve',
    title: 'Machete sleeve',
    summary: 'A slotted bar that carries a machete on the rim.',
    doc: 'machete-sleeve',
    image: macheteImage,
    parts: [{ id: 'machete-sleeve', title: 'Machete sleeve', count: 'Print 1' }],
  },
  {
    id: 'ego-battery-holder',
    title: 'EGO battery holder',
    summary: 'Upright rails that an EGO 56V battery slides onto, as on a wall mount.',
    doc: 'ego-battery-holder',
    image: egoImage,
    parts: [{ id: 'ego-battery-holder', title: 'EGO battery holder', count: 'Print 1 per battery' }],
  },
  {
    id: 'mounting-plate',
    title: 'Mounting plate',
    summary: 'A flat plate that hangs outside the rim, to bolt a sheet of ply or anything else to.',
    doc: 'mounting-plate',
    image: plateImage,
    parts: [{ id: 'mounting-plate', title: 'Mounting plate', count: 'One per cutout: two or more to carry a sheet' }],
  },
];

export function docUrl(accessory: AccessoryInfo): string {
  return `${REPO}/blob/main/docs/${accessory.doc}.md`;
}
