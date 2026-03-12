import type { ThemeDefinition } from './types';

export const monokaiThemes: ThemeDefinition[] = [
  {
    id: 'monokai',
    label: 'Monokai',
    dark: true,
    colors: {
      rosewater: '#f92672', flamingo: '#f92672', pink: '#f92672', mauve: '#ae81ff',
      red: '#f92672', maroon: '#e6194b', peach: '#fd971f', yellow: '#e6db74',
      green: '#a6e22e', teal: '#66d9ef', sky: '#66d9ef', sapphire: '#66d9ef',
      blue: '#66d9ef', lavender: '#ae81ff', text: '#f8f8f2', subtext1: '#e0e0e0',
      subtext0: '#c0c0c0', overlay2: '#a0a0a0', overlay1: '#75715e', overlay0: '#5e5e5e',
      surface2: '#49483e', surface1: '#3e3d32', surface0: '#2d2d2d',
      base: '#272822', mantle: '#1e1f1c', crust: '#171813',
    },
  },
];
