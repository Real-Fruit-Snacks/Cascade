export type CatppuccinFlavor = 'mocha' | 'macchiato' | 'frappe' | 'latte';

export interface FlavorColors {
  rosewater: string;
  flamingo: string;
  pink: string;
  mauve: string;
  red: string;
  maroon: string;
  peach: string;
  yellow: string;
  green: string;
  teal: string;
  sky: string;
  sapphire: string;
  blue: string;
  lavender: string;
  text: string;
  subtext1: string;
  subtext0: string;
  overlay2: string;
  overlay1: string;
  overlay0: string;
  surface2: string;
  surface1: string;
  surface0: string;
  base: string;
  mantle: string;
  crust: string;
}

// --- Catppuccin ---

const mocha: FlavorColors = {
  rosewater: '#f5e0dc', flamingo: '#f2cdcd', pink: '#f5c2e7', mauve: '#cba6f7',
  red: '#f38ba8', maroon: '#eba0ac', peach: '#fab387', yellow: '#f9e2af',
  green: '#a6e3a1', teal: '#94e2d5', sky: '#89dceb', sapphire: '#74c7ec',
  blue: '#89b4fa', lavender: '#b4befe', text: '#cdd6f4', subtext1: '#bac2de',
  subtext0: '#a6adc8', overlay2: '#9399b2', overlay1: '#7f849c', overlay0: '#6c7086',
  surface2: '#585b70', surface1: '#45475a', surface0: '#313244',
  base: '#1e1e2e', mantle: '#181825', crust: '#11111b',
};

const macchiato: FlavorColors = {
  rosewater: '#f4dbd6', flamingo: '#f0c6c6', pink: '#f5bde6', mauve: '#c6a0f6',
  red: '#ed8796', maroon: '#ee99a0', peach: '#f5a97f', yellow: '#eed49f',
  green: '#a6da95', teal: '#8bd5ca', sky: '#91d7e3', sapphire: '#7dc4e4',
  blue: '#8aadf4', lavender: '#b7bdf8', text: '#cad3f5', subtext1: '#b8c0e0',
  subtext0: '#a5adcb', overlay2: '#939ab7', overlay1: '#8087a2', overlay0: '#6e738d',
  surface2: '#5b6078', surface1: '#494d64', surface0: '#363a4f',
  base: '#24273a', mantle: '#1e2030', crust: '#181926',
};

const frappe: FlavorColors = {
  rosewater: '#f2d5cf', flamingo: '#eebebe', pink: '#f4b8e4', mauve: '#ca9ee6',
  red: '#e78284', maroon: '#ea999c', peach: '#ef9f76', yellow: '#e5c890',
  green: '#a6d189', teal: '#81c8be', sky: '#99d1db', sapphire: '#85c1dc',
  blue: '#8caaee', lavender: '#babbf1', text: '#c6d0f5', subtext1: '#b5bfe2',
  subtext0: '#a5adce', overlay2: '#949cbb', overlay1: '#838ba7', overlay0: '#737994',
  surface2: '#626880', surface1: '#51576d', surface0: '#414559',
  base: '#303446', mantle: '#292c3c', crust: '#232634',
};

const latte: FlavorColors = {
  rosewater: '#dc8a78', flamingo: '#dd7878', pink: '#ea76cb', mauve: '#8839ef',
  red: '#d20f39', maroon: '#e64553', peach: '#fe640b', yellow: '#df8e1d',
  green: '#40a02b', teal: '#179299', sky: '#04a5e5', sapphire: '#209fb5',
  blue: '#1e66f5', lavender: '#7287fd', text: '#4c4f69', subtext1: '#5c5f77',
  subtext0: '#6c6f85', overlay2: '#7c7f93', overlay1: '#8c8fa1', overlay0: '#9ca0b0',
  surface2: '#acb0be', surface1: '#bcc0cc', surface0: '#ccd0da',
  base: '#eff1f5', mantle: '#e6e9ef', crust: '#dce0e8',
};

// --- Nord ---

const nord: FlavorColors = {
  rosewater: '#d08770', flamingo: '#d08770', pink: '#b48ead', mauve: '#b48ead',
  red: '#bf616a', maroon: '#bf616a', peach: '#d08770', yellow: '#ebcb8b',
  green: '#a3be8c', teal: '#8fbcbb', sky: '#88c0d0', sapphire: '#81a1c1',
  blue: '#5e81ac', lavender: '#81a1c1', text: '#eceff4', subtext1: '#e5e9f0',
  subtext0: '#d8dee9', overlay2: '#abb2bf', overlay1: '#7b88a1', overlay0: '#616e88',
  surface2: '#434c5e', surface1: '#3b4252', surface0: '#2e3440',
  base: '#242933', mantle: '#1e222a', crust: '#191d24',
};

// --- Dracula ---

const dracula: FlavorColors = {
  rosewater: '#ff79c6', flamingo: '#ff79c6', pink: '#ff79c6', mauve: '#bd93f9',
  red: '#ff5555', maroon: '#ff6e6e', peach: '#ffb86c', yellow: '#f1fa8c',
  green: '#50fa7b', teal: '#8be9fd', sky: '#8be9fd', sapphire: '#6272a4',
  blue: '#6272a4', lavender: '#bd93f9', text: '#f8f8f2', subtext1: '#e2e2dc',
  subtext0: '#ccccc6', overlay2: '#a9a9a3', overlay1: '#7a7a75', overlay0: '#5a5a55',
  surface2: '#44475a', surface1: '#383a4a', surface0: '#282a36',
  base: '#21222c', mantle: '#1a1b26', crust: '#13141c',
};

// --- Gruvbox ---

const gruvboxDark: FlavorColors = {
  rosewater: '#d65d0e', flamingo: '#d65d0e', pink: '#d3869b', mauve: '#b16286',
  red: '#cc241d', maroon: '#fb4934', peach: '#fe8019', yellow: '#fabd2f',
  green: '#98971a', teal: '#689d6a', sky: '#83a598', sapphire: '#458588',
  blue: '#458588', lavender: '#b16286', text: '#ebdbb2', subtext1: '#d5c4a1',
  subtext0: '#bdae93', overlay2: '#a89984', overlay1: '#928374', overlay0: '#7c6f64',
  surface2: '#504945', surface1: '#3c3836', surface0: '#32302f',
  base: '#282828', mantle: '#1d2021', crust: '#1a1a1a',
};

const gruvboxLight: FlavorColors = {
  rosewater: '#d65d0e', flamingo: '#d65d0e', pink: '#d3869b', mauve: '#b16286',
  red: '#cc241d', maroon: '#9d0006', peach: '#af3a03', yellow: '#d79921',
  green: '#79740e', teal: '#427b58', sky: '#076678', sapphire: '#076678',
  blue: '#458588', lavender: '#8f3f71', text: '#3c3836', subtext1: '#504945',
  subtext0: '#665c54', overlay2: '#7c6f64', overlay1: '#928374', overlay0: '#a89984',
  surface2: '#d5c4a1', surface1: '#ebdbb2', surface0: '#f2e5bc',
  base: '#fbf1c7', mantle: '#f9f5d7', crust: '#f0eaca',
};

// --- Tokyo Night ---

const tokyoNight: FlavorColors = {
  rosewater: '#f7768e', flamingo: '#f7768e', pink: '#bb9af7', mauve: '#bb9af7',
  red: '#f7768e', maroon: '#ff7a93', peach: '#ff9e64', yellow: '#e0af68',
  green: '#9ece6a', teal: '#73daca', sky: '#7dcfff', sapphire: '#7aa2f7',
  blue: '#7aa2f7', lavender: '#bb9af7', text: '#c0caf5', subtext1: '#a9b1d6',
  subtext0: '#9aa5ce', overlay2: '#787c99', overlay1: '#565f89', overlay0: '#414868',
  surface2: '#3b4261', surface1: '#292e42', surface0: '#24283b',
  base: '#1a1b26', mantle: '#16161e', crust: '#13131a',
};

// --- One Dark ---

const oneDark: FlavorColors = {
  rosewater: '#e06c75', flamingo: '#e06c75', pink: '#c678dd', mauve: '#c678dd',
  red: '#e06c75', maroon: '#be5046', peach: '#d19a66', yellow: '#e5c07b',
  green: '#98c379', teal: '#56b6c2', sky: '#56b6c2', sapphire: '#61afef',
  blue: '#61afef', lavender: '#c678dd', text: '#abb2bf', subtext1: '#9da5b4',
  subtext0: '#8b929e', overlay2: '#7f848e', overlay1: '#636d83', overlay0: '#4b5263',
  surface2: '#3e4451', surface1: '#2c313a', surface0: '#282c34',
  base: '#21252b', mantle: '#1b1f27', crust: '#181a1f',
};

// --- Solarized ---

const solarizedDark: FlavorColors = {
  rosewater: '#dc322f', flamingo: '#cb4b16', pink: '#d33682', mauve: '#6c71c4',
  red: '#dc322f', maroon: '#cb4b16', peach: '#cb4b16', yellow: '#b58900',
  green: '#859900', teal: '#2aa198', sky: '#2aa198', sapphire: '#268bd2',
  blue: '#268bd2', lavender: '#6c71c4', text: '#839496', subtext1: '#93a1a1',
  subtext0: '#657b83', overlay2: '#586e75', overlay1: '#475b62', overlay0: '#3d5159',
  surface2: '#11404a', surface1: '#073642', surface0: '#052f3a',
  base: '#002b36', mantle: '#00222b', crust: '#001a21',
};

const solarizedLight: FlavorColors = {
  rosewater: '#dc322f', flamingo: '#cb4b16', pink: '#d33682', mauve: '#6c71c4',
  red: '#dc322f', maroon: '#cb4b16', peach: '#cb4b16', yellow: '#b58900',
  green: '#859900', teal: '#2aa198', sky: '#2aa198', sapphire: '#268bd2',
  blue: '#268bd2', lavender: '#6c71c4', text: '#657b83', subtext1: '#586e75',
  subtext0: '#839496', overlay2: '#93a1a1', overlay1: '#a8b4b4', overlay0: '#c0cccc',
  surface2: '#eee8d5', surface1: '#fdf6e3', surface0: '#f5eedc',
  base: '#fdf6e3', mantle: '#f5eedc', crust: '#eee8d5',
};

// --- Rosé Pine ---

const rosePineDawn: FlavorColors = {
  rosewater: '#d7827e', flamingo: '#d7827e', pink: '#ea9d34', mauve: '#907aa9',
  red: '#b4637a', maroon: '#b4637a', peach: '#ea9d34', yellow: '#ea9d34',
  green: '#286983', teal: '#56949f', sky: '#56949f', sapphire: '#286983',
  blue: '#286983', lavender: '#907aa9', text: '#575279', subtext1: '#6e6a86',
  subtext0: '#797593', overlay2: '#9893a5', overlay1: '#b4b0be', overlay0: '#cecacd',
  surface2: '#dfdad9', surface1: '#f2e9e1', surface0: '#f4ede8',
  base: '#faf4ed', mantle: '#fffaf3', crust: '#f2e9e1',
};

const rosePineMoon: FlavorColors = {
  rosewater: '#ea9a97', flamingo: '#ea9a97', pink: '#f6c177', mauve: '#c4a7e7',
  red: '#eb6f92', maroon: '#eb6f92', peach: '#f6c177', yellow: '#f6c177',
  green: '#3e8fb0', teal: '#9ccfd8', sky: '#9ccfd8', sapphire: '#3e8fb0',
  blue: '#3e8fb0', lavender: '#c4a7e7', text: '#e0def4', subtext1: '#d0cde4',
  subtext0: '#b8b5cf', overlay2: '#908caa', overlay1: '#6e6a86', overlay0: '#56526e',
  surface2: '#44415a', surface1: '#393552', surface0: '#2a273f',
  base: '#232136', mantle: '#1e1d2f', crust: '#191724',
};

// --- All built-in themes ---

export type BuiltinThemeId =
  | 'mocha' | 'macchiato' | 'frappe' | 'latte'
  | 'nord' | 'dracula'
  | 'gruvbox-dark' | 'gruvbox-light'
  | 'tokyo-night' | 'one-dark'
  | 'solarized-dark' | 'solarized-light'
  | 'rose-pine-moon' | 'rose-pine-dawn';

export const flavors: Record<string, FlavorColors> = {
  mocha,
  macchiato,
  frappe,
  latte,
  nord,
  dracula,
  'gruvbox-dark': gruvboxDark,
  'gruvbox-light': gruvboxLight,
  'tokyo-night': tokyoNight,
  'one-dark': oneDark,
  'solarized-dark': solarizedDark,
  'solarized-light': solarizedLight,
  'rose-pine-moon': rosePineMoon,
  'rose-pine-dawn': rosePineDawn,
};

export const flavorLabels: Record<string, string> = {
  mocha: 'Catppuccin Mocha',
  macchiato: 'Catppuccin Macchiato',
  frappe: 'Catppuccin Frapp\u00e9',
  latte: 'Catppuccin Latte',
  nord: 'Nord',
  dracula: 'Dracula',
  'gruvbox-dark': 'Gruvbox Dark',
  'gruvbox-light': 'Gruvbox Light',
  'tokyo-night': 'Tokyo Night',
  'one-dark': 'One Dark',
  'solarized-dark': 'Solarized Dark',
  'solarized-light': 'Solarized Light',
  'rose-pine-moon': 'Ros\u00e9 Pine Moon',
  'rose-pine-dawn': 'Ros\u00e9 Pine Dawn',
};

const darkThemes = new Set<string>([
  'mocha', 'macchiato', 'frappe', 'nord', 'dracula',
  'gruvbox-dark', 'tokyo-night', 'one-dark', 'solarized-dark', 'rose-pine-moon',
]);

export function applyFlavor(flavor: CatppuccinFlavor) {
  applyColors(flavors[flavor]);
}

function applyColors(colors: FlavorColors) {
  const root = document.documentElement;
  for (const [key, value] of Object.entries(colors)) {
    // Convert camelCase keys to kebab-case for CSS vars
    const cssKey = key.replace(/([A-Z])/g, (_, c: string) => c.toLowerCase());
    root.style.setProperty(`--ctp-${cssKey}`, value);
  }
}

export interface CustomTheme {
  id: string;
  name: string;
  dark: boolean;
  colors: FlavorColors;
}

// Registry of loaded custom themes
const customThemes = new Map<string, CustomTheme>();

export function registerCustomTheme(theme: CustomTheme) {
  customThemes.set(theme.id, theme);
}

export function unregisterCustomTheme(id: string) {
  customThemes.delete(id);
}

export function getCustomThemes(): CustomTheme[] {
  return Array.from(customThemes.values());
}

export function getCustomTheme(id: string): CustomTheme | undefined {
  return customThemes.get(id);
}

export function isBuiltinFlavor(theme: string): boolean {
  return theme in flavors;
}

export function applyTheme(theme: string) {
  if (isBuiltinFlavor(theme)) {
    applyColors(flavors[theme]);
  } else {
    const custom = customThemes.get(theme);
    if (custom) {
      applyColors(custom.colors);
    }
  }
}

export function isDarkTheme(theme: string): boolean {
  if (darkThemes.has(theme)) return true;
  if (isBuiltinFlavor(theme)) return false; // light built-in
  const custom = customThemes.get(theme);
  return custom ? custom.dark : true;
}

export function isDarkFlavor(flavor: CatppuccinFlavor): boolean {
  return flavor !== 'latte';
}
