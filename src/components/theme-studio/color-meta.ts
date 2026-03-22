export type ColorCategory = 'surfaces' | 'text' | 'accents' | 'semantic' | 'editor';

export interface ColorMeta {
  category: ColorCategory;
  label: string;
  description: string;
}

export const COLOR_META: Record<string, ColorMeta> = {
  base: { category: 'surfaces', label: 'Base', description: 'Editor background, main content area' },
  mantle: { category: 'surfaces', label: 'Mantle', description: 'Panels, modals, elevated surfaces' },
  crust: { category: 'surfaces', label: 'Crust', description: 'Sidebar, deepest background layer' },
  surface0: { category: 'surfaces', label: 'Surface 0', description: 'Input backgrounds, hover states' },
  surface1: { category: 'surfaces', label: 'Surface 1', description: 'Active/selected backgrounds, borders' },
  surface2: { category: 'surfaces', label: 'Surface 2', description: 'Stronger borders, secondary hover' },
  text: { category: 'text', label: 'Text', description: 'Primary text color' },
  subtext1: { category: 'text', label: 'Subtext 1', description: 'Secondary text' },
  subtext0: { category: 'text', label: 'Subtext 0', description: 'Tertiary/muted text' },
  overlay2: { category: 'text', label: 'Overlay 2', description: 'Stronger overlay elements' },
  overlay1: { category: 'text', label: 'Overlay 1', description: 'Icons, subtle UI elements' },
  overlay0: { category: 'text', label: 'Overlay 0', description: 'Placeholder text, disabled state' },
  rosewater: { category: 'accents', label: 'Rosewater', description: 'Warm highlight accent' },
  flamingo: { category: 'accents', label: 'Flamingo', description: 'Warm pink accent' },
  pink: { category: 'accents', label: 'Pink', description: 'Vibrant pink accent' },
  mauve: { category: 'accents', label: 'Mauve', description: 'Purple accent' },
  red: { category: 'accents', label: 'Red', description: 'Error states, destructive actions' },
  maroon: { category: 'accents', label: 'Maroon', description: 'Warm red accent' },
  peach: { category: 'accents', label: 'Peach', description: 'Default accent color' },
  yellow: { category: 'accents', label: 'Yellow', description: 'Warnings, highlights' },
  green: { category: 'accents', label: 'Green', description: 'Success states, confirmations' },
  teal: { category: 'accents', label: 'Teal', description: 'Cool accent' },
  sky: { category: 'accents', label: 'Sky', description: 'Info states, links' },
  sapphire: { category: 'accents', label: 'Sapphire', description: 'Cool blue accent' },
  blue: { category: 'accents', label: 'Blue', description: 'Primary blue accent' },
  lavender: { category: 'accents', label: 'Lavender', description: 'Soft purple accent' },

  // Editor semantic colors
  h1: { category: 'editor', label: 'Heading 1', description: 'First-level headings' },
  h2: { category: 'editor', label: 'Heading 2', description: 'Second-level headings' },
  h3: { category: 'editor', label: 'Heading 3', description: 'Third-level headings' },
  h4: { category: 'editor', label: 'Heading 4', description: 'Fourth-level headings' },
  h5: { category: 'editor', label: 'Heading 5', description: 'Fifth-level headings' },
  h6: { category: 'editor', label: 'Heading 6', description: 'Sixth-level headings' },
  link: { category: 'editor', label: 'Links', description: 'Hyperlinks and wiki-links' },
  bold: { category: 'editor', label: 'Bold', description: 'Bold text' },
  italic: { category: 'editor', label: 'Italic', description: 'Italic text' },
  code: { category: 'editor', label: 'Code', description: 'Inline code spans' },
  'tag-color': { category: 'editor', label: 'Tags', description: 'Hashtag colors' },
  blockquote: { category: 'editor', label: 'Blockquote', description: 'Quoted text' },
  'list-marker': { category: 'editor', label: 'List Markers', description: 'Bullet and number colors' },
};

export const CATEGORIES: { id: ColorCategory | 'all'; label: string }[] = [
  { id: 'surfaces', label: 'Surfaces' },
  { id: 'text', label: 'Text' },
  { id: 'accents', label: 'Accents' },
  { id: 'editor', label: 'Editor' },
];

export function getColorsForCategory(category: ColorCategory | 'all'): string[] {
  if (category === 'all') return Object.keys(COLOR_META);
  return Object.entries(COLOR_META)
    .filter(([, meta]) => meta.category === category)
    .map(([key]) => key);
}
