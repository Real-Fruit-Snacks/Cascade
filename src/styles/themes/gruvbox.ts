import type { ThemeDefinition } from './types';

export const gruvboxThemes: ThemeDefinition[] = [
  {
    id: 'gruvbox-dark',
    label: 'Gruvbox Dark',
    dark: true,
    colors: {
      rosewater: '#d65d0e', flamingo: '#d65d0e', pink: '#d3869b', mauve: '#b16286',
      red: '#cc241d', maroon: '#fb4934', peach: '#fe8019', yellow: '#fabd2f',
      green: '#98971a', teal: '#689d6a', sky: '#83a598', sapphire: '#458588',
      blue: '#458588', lavender: '#b16286', text: '#ebdbb2', subtext1: '#d5c4a1',
      subtext0: '#bdae93', overlay2: '#a89984', overlay1: '#928374', overlay0: '#7c6f64',
      surface2: '#504945', surface1: '#3c3836', surface0: '#32302f',
      base: '#282828', mantle: '#1d2021', crust: '#1a1a1a',
    },
  },
  {
    id: 'gruvbox-light',
    label: 'Gruvbox Light',
    dark: false,
    colors: {
      rosewater: '#d65d0e', flamingo: '#d65d0e', pink: '#d3869b', mauve: '#b16286',
      red: '#cc241d', maroon: '#9d0006', peach: '#af3a03', yellow: '#d79921',
      green: '#79740e', teal: '#427b58', sky: '#076678', sapphire: '#076678',
      blue: '#458588', lavender: '#8f3f71', text: '#3c3836', subtext1: '#504945',
      subtext0: '#665c54', overlay2: '#7c6f64', overlay1: '#928374', overlay0: '#a89984',
      surface2: '#d5c4a1', surface1: '#ebdbb2', surface0: '#f2e5bc',
      base: '#fbf1c7', mantle: '#f9f5d7', crust: '#f0eaca',
    },
  },
];
