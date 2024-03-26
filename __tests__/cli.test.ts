import { describe, expect, test } from 'vitest';
import { runCli, usage } from '../src/cli';

const noStdin = () => '';

describe('mongo-to-sql CLI', () => {
  test('translates a query argument', () =>
    expect(runCli(['db.users.find({age: {$gt: 30}}, {name: 1});'], noStdin)).toEqual({
      code: 0, stdout: 'SELECT name FROM users WHERE age > 30;\n', stderr: '',
    }));
  test('--rename-id works before or after the query', () => {
    expect(runCli(['--rename-id', 'db.users.find({_id: 7});'], noStdin).stdout).toBe('SELECT * FROM users WHERE id = 7;\n');
    expect(runCli(['db.users.find({_id: 7});', '--rename-id'], noStdin).stdout).toBe('SELECT * FROM users WHERE id = 7;\n');
  });
  test('reads the query from stdin when no argument is given', () =>
    expect(runCli([], () => 'db.users.find({});\n').stdout).toBe('SELECT * FROM users;\n'));
  test('stdin is not read when an argument is given', () =>
    expect(runCli(['db.users.find({});'], () => { throw new Error('stdin read'); }).code).toBe(0));
  test('unsupported queries exit 1 with a message on stderr', () =>
    expect(runCli(['db.users.find({a: {$regex: "x"}});'], noStdin)).toEqual({
      code: 1, stdout: '', stderr: 'mongo-to-sql: unsupported or malformed query\n',
    }));
  test.each([[[]], [['--bogus', 'db.users.find({});']], [['db.a.find({});', 'db.b.find({});']]])('usage errors exit 2: %j', args =>
    expect(runCli(args, noStdin)).toEqual({ code: 2, stdout: '', stderr: usage + '\n' }));
  test('--help prints usage', () => expect(runCli(['--help'], noStdin)).toEqual({ code: 0, stdout: usage + '\n', stderr: '' }));
});
