import type { Preview } from '@storybook/react';

import '../src/styles.css';
import '../src/tokens.css';
import '../src/theme.css';

const preview: Preview = {
  parameters: {
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
    backgrounds: {
      options: {
        dark: { name: 'Dark', value: '#0a0a0c' },
        light: { name: 'Light', value: '#ffffff' },
      },
      default: 'dark',
    },
  },
};

export default preview;
