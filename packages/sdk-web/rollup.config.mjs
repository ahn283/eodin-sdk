import nodeResolve from '@rollup/plugin-node-resolve';

// Two entry points: public root + internal subpath. internal subpath 는
// first-party (capacitor) 용 — package.json `exports`./internal 을 통해 노출.
export default [
  {
    input: 'dist/esm/index.js',
    output: {
      file: 'dist/cjs/index.js',
      format: 'cjs',
      sourcemap: true,
      inlineDynamicImports: true,
    },
    plugins: [nodeResolve()],
  },
  {
    input: 'dist/esm/internal/index.js',
    output: {
      file: 'dist/cjs/internal/index.js',
      format: 'cjs',
      sourcemap: true,
      inlineDynamicImports: true,
    },
    plugins: [nodeResolve()],
  },
];
