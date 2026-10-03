import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const envPath = fileURLToPath(new URL('../.env', import.meta.url));
if (existsSync(envPath)) process.loadEnvFile(envPath);
const [command, ...args] = process.argv.slice(2);
if (!command) { console.error('A command is required.'); process.exit(1); }
const child = spawn(command, args, { stdio: 'inherit', env: process.env });
child.on('error', error => { console.error(error.message); process.exit(1); });
child.on('exit', code => process.exit(code ?? 1));
