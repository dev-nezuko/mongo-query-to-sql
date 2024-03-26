#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { runCli } from './cli';

const result = runCli(process.argv.slice(2), () => (process.stdin.isTTY ? '' : readFileSync(0, 'utf8')));
process.stdout.write(result.stdout);
process.stderr.write(result.stderr);
process.exitCode = result.code;
