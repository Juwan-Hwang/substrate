import { compilers, defineConfig } from 'fumadocs-mdx/config';

export default defineConfig({
  mdxOptions: {
    defaultPlugins: true,
    link: true,
    typographer: true,
  },
  compilers: [compilers.shiki({ themes: ['github-dark', 'github-light'] })],
});
