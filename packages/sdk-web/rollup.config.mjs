import nodeResolve from '@rollup/plugin-node-resolve';

// Dual entry (root + internal). cjs + esm 양쪽 출력.
//
// H1 결정 (Phase 1.1 review): EodinAnalytics 가 stateful singleton 이라 dual-
// package hazard 위험. 단, capacitor (CJS publish artifact) 가 @eodin/web/
// internal 을 require 하는 호환성 때문에 internal entry 는 dual 유지. 대신:
// - root entry (EodinAnalytics) 는 globalThis 에 state 를 pin 하여 두 module
//   instance 가 evaluate 되어도 state 는 단일화 (Phase 3 EodinAnalytics 구현
//   에서 globalThis.__eodin_analytics_state__ 패턴 사용)
// - internal/* 는 stateless 유틸이라 dual 인스턴스가 functionally 동일
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
