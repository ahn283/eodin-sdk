import nodeResolve from '@rollup/plugin-node-resolve';

export default {
  input: 'dist/esm/index.js',
  output: [
    {
      file: 'dist/plugin.cjs.js',
      format: 'cjs',
      sourcemap: true,
      inlineDynamicImports: true,
    },
    {
      file: 'dist/plugin.js',
      format: 'iife',
      name: 'capacitorEodin',
      globals: {
        '@capacitor/core': 'capacitorExports',
        '@eodin/web': 'eodinWeb',
        '@eodin/web/internal': 'eodinWebInternal',
      },
      sourcemap: true,
      inlineDynamicImports: true,
    },
  ],
  // Phase 2 review H3: '@eodin/web/internal' 도 external 처리 — capacitor
  // dist 에 EventQueue / validateEndpoint 등이 인라인되지 않도록. 사용자는
  // capacitor 의 dependencies (`@eodin/web: ^1.0.0-beta.1`) 을 통해 별도
  // 설치된 @eodin/web 을 런타임에 참조.
  external: ['@capacitor/core', '@eodin/web', '@eodin/web/internal'],
  plugins: [nodeResolve()],
};
