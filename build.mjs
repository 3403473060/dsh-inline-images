// 社区规范:源码仓库 + 构建脚本生成 lib/。esbuild 不检查类型。
import { build } from 'esbuild'
import { mkdirSync, readFileSync } from 'node:fs'

mkdirSync('lib', { recursive: true })

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

await build({
  entryPoints: ['src/index.ts'],
  outfile: 'lib/index.js',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  external: ['@deepseek-ai/*', 'zod'],
  sourcemap: true,
})

// 客户端 bundle:宿主客户端加载器只认 `window.__ModuleLoader__.load({ id, factory })`
// —— 脚本执行时仅注册工厂,模块体(含 CSS 注入等副作用)在首次 import/require 时由
// factory(require) 物化。因此这里输出 CJS,再用 banner/footer 包出该契约:
//  - 顶层 IIFE + 全局变量挂载不会被加载器识别(表现为
//    `client-modules: could not load "<id>"`,
//    根因是 `loaded without registering "<id>" via __ModuleLoader__.load`);
//  - `require` 必须由 factory 注入,否则 react 等共享依赖解析不到壳实例。
await build({
  entryPoints: ['src/client.ts'],
  outfile: 'lib/client.js',
  bundle: true,
  platform: 'browser',
  format: 'cjs',
  target: 'es2020',
  external: ['react'],
  sourcemap: true,
  banner: {
    js: [
      'window.__ModuleLoader__.load({',
      `\tid: ${JSON.stringify(pkg.name)},`,
      '\tfactory: (require) => {',
      '\t\t"use strict";',
      '\t\tvar module = { exports: {} };',
      '\t\tvar exports = module.exports;',
      '\t\tObject.defineProperty(exports, Symbol.toStringTag, { value: "Module" });',
    ].join('\n'),
  },
  footer: {
    js: ['\t\treturn module.exports;', '\t}', '});'].join('\n'),
  },
})

console.log('built dsh-inline-images (lib/index.js + lib/client.js)')
