import type { ThemeDefinition } from './types';

export const githubThemes: ThemeDefinition[] = [
  {
    id: 'github-dark',
    label: 'GitHub Dark',
    dark: true,
    colors: {
      rosewater: '#ff7b72', flamingo: '#ff7b72', pink: '#d2a8ff', mauve: '#d2a8ff',
      red: '#ff7b72', maroon: '#ffa198', peach: '#ffa657', yellow: '#e3b341',
      green: '#7ee787', teal: '#56d4dd', sky: '#79c0ff', sapphire: '#79c0ff',
      blue: '#79c0ff', lavender: '#d2a8ff', text: '#e6edf3', subtext1: '#c9d1d9',
      subtext0: '#b1bac4', overlay2: '#8b949e', overlay1: '#6e7681', overlay0: '#484f58',
      surface2: '#30363d', surface1: '#21262d', surface0: '#161b22',
      base: '#0d1117', mantle: '#090c10', crust: '#060809',
    },
  },
  {
    id: 'github-light',
    label: 'GitHub Light',
    dark: false,
    colors: {
      rosewater: '#cf222e', flamingo: '#cf222e', pink: '#8250df', mauve: '#8250df',
      red: '#cf222e', maroon: '#a40e26', peach: '#bc4c00', yellow: '#9a6700',
      green: '#116329', teal: '#0969da', sky: '#0969da', sapphire: '#0550ae',
      blue: '#0550ae', lavender: '#8250df', text: '#1f2328', subtext1: '#31363b',
      subtext0: '#59636e', overlay2: '#6e7781', overlay1: '#8c959f', overlay0: '#afb8c1',
      surface2: '#d0d7de', surface1: '#e6edf3', surface0: '#eef1f5',
      base: '#ffffff', mantle: '#f6f8fa', crust: '#eef1f5',
    },
  },
];
