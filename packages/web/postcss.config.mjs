const config = {
  plugins: {
    '@tailwindcss/postcss': {},
    lightningcss: {
      browsers: '>= 0.25%',
      features: {
        'nesting': true,
        'custom-media-queries': true,
      },
    },
  },
};

export default config;
