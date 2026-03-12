import type { ThemeDefinition } from './types';

export const ayuThemes: ThemeDefinition[] = [
  {
    id: 'ayu-dark',
    label: 'Ayu Dark',
    dark: true,
    colors: {
      rosewater: '#f07178', flamingo: '#f07178', pink: '#d2a6ff', mauve: '#d2a6ff',
      red: '#f07178', maroon: '#f26d78', peach: '#ff8f40', yellow: '#ffb454',
      green: '#aad94c', teal: '#95e6cb', sky: '#73b8ff', sapphire: '#59c2ff',
      blue: '#59c2ff', lavender: '#d2a6ff', text: '#bfbdb6', subtext1: '#acaaa3',
      subtext0: '#9a9891', overlay2: '#878580', overlay1: '#6c6f6f', overlay0: '#565b66',
      surface2: '#3e4250', surface1: '#2d3240', surface0: '#1c2130',
      base: '#0b0e14', mantle: '#080a0f', crust: '#05070a',
    },
  },
  {
    id: 'ayu-mirage',
    label: 'Ayu Mirage',
    dark: true,
    colors: {
      rosewater: '#f07178', flamingo: '#f07178', pink: '#d2a6ff', mauve: '#d2a6ff',
      red: '#f07178', maroon: '#f26d78', peach: '#ff8f40', yellow: '#ffb454',
      green: '#aad94c', teal: '#95e6cb', sky: '#73b8ff', sapphire: '#59c2ff',
      blue: '#59c2ff', lavender: '#d2a6ff', text: '#cccac2', subtext1: '#b8b4ab',
      subtext0: '#a4a199', overlay2: '#8b8983', overlay1: '#6c6f6f', overlay0: '#565b66',
      surface2: '#3e4250', surface1: '#343b4d', surface0: '#2a2f3e',
      base: '#1f2430', mantle: '#191e29', crust: '#131721',
    },
  },
  {
    id: 'ayu-light',
    label: 'Ayu Light',
    dark: false,
    colors: {
      rosewater: '#f07178', flamingo: '#f07178', pink: '#a37acc', mauve: '#a37acc',
      red: '#f07178', maroon: '#e65050', peach: '#fa8d3e', yellow: '#f2ae49',
      green: '#86b300', teal: '#4cbf99', sky: '#399ee6', sapphire: '#399ee6',
      blue: '#399ee6', lavender: '#a37acc', text: '#575f66', subtext1: '#6b737c',
      subtext0: '#828c99', overlay2: '#99a2af', overlay1: '#abb0b6', overlay0: '#c4c8cc',
      surface2: '#d8d8d7', surface1: '#e7e8e9', surface0: '#f0f0f0',
      base: '#fafafa', mantle: '#f0eff0', crust: '#e6e6e6',
    },
  },
];
