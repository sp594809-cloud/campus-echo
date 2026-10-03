import { build } from 'esbuild';
import { resolve } from 'node:path';
await build({ entryPoints: ['tests/integration.ts'], outfile: 'tests/.integration.mjs', bundle: true, platform: 'node', format: 'esm', external: ['@electric-sql/pglite'], banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" }, plugins: [{ name: 'isolated-test-adapters', setup(b) { b.onResolve({ filter: /^@workspace\/db$/ }, () => ({ path: resolve('tests/test-db.ts') })); b.onResolve({ filter: /\/lib\/auth$/ }, () => ({ path: resolve('tests/test-auth.ts') })); } }] });
process.env.NODE_ENV = 'production';
await import('./.integration.mjs');

await build({ entryPoints: ['tests/ui.tsx'], outfile: 'tests/.ui.mjs', bundle: true, platform: 'node', format: 'esm', jsx: 'automatic', alias: { '@': resolve('artifacts/campus-echo/src'), 'react': resolve('artifacts/campus-echo/node_modules/react'), '@tanstack/react-query': resolve('artifacts/campus-echo/node_modules/@tanstack/react-query/build/modern/index.js'), 'wouter': resolve('artifacts/campus-echo/node_modules/wouter') }, banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" }, plugins: [{ name: 'auth-render-fixture', setup(b) { b.onResolve({ filter: /^@\/lib\/auth$/ }, () => ({ path: resolve('tests/test-auth-ui.ts') })); } }] });
await import('./.ui.mjs');

await build({ entryPoints: ['tests/supabase-auth.ts'], outfile: 'tests/.supabase-auth.mjs', bundle: true, platform: 'node', format: 'esm' });
await import('./.supabase-auth.mjs');
