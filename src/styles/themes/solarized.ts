import type { ThemeDefinition } from './types';

export const solarizedThemes: ThemeDefinition[] = [
  {
    id: 'solarized-dark',
    label: 'Solarized Dark',
    dark: true,
    colors: {
      rosewater: '#dc322f', flamingo: '#cb4b16', pink: '#d33682', mauve: '#6c71c4',
      red: '#dc322f', maroon: '#cb4b16', peach: '#cb4b16', yellow: '#b58900',
      green: '#859900', teal: '#2aa198', sky: '#2aa198', sapphire: '#268bd2',
      blue: '#268bd2', lavender: '#6c71c4', text: '#839496', subtext1: '#93a1a1',
      subtext0: '#657b83', overlay2: '#586e75', overlay1: '#475b62', overlay0: '#3d5159',
      surface2: '#11404a', surface1: '#073642', surface0: '#052f3a',
      base: '#002b36', mantle: '#00222b', crust: '#001a21',
    },
  },
  {
    id: 'solarized-light',
    label: 'Solarized Light',
    dark: false,
    colors: {
      rosewater: '#dc322f', flamingo: '#cb4b16', pink: '#d33682', mauve: '#6c71c4',
      red: '#dc322f', maroon: '#cb4b16', peach: '#cb4b16', yellow: '#b58900',
      green: '#859900', teal: '#2aa198', sky: '#2aa198', sapphire: '#268bd2',
      blue: '#268bd2', lavender: '#6c71c4', text: '#657b83', subtext1: '#586e75',
      subtext0: '#839496', overlay2: '#93a1a1', overlay1: '#a8b4b4', overlay0: '#c0cccc',
      surface2: '#eee8d5', surface1: '#fdf6e3', surface0: '#f5eedc',
      base: '#fdf6e3', mantle: '#f5eedc', crust: '#eee8d5',
    },
  },
];
