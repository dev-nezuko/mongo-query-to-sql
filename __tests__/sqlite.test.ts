import { DatabaseSync } from 'node:sqlite';
import fc from 'fast-check';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { convertToSQL } from '../src/index';

// Executing the output against a real engine checks that quoting holds, not just that strings look right.
let db: DatabaseSync;
beforeAll(() => {
  db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE notes (id INTEGER PRIMARY KEY, body TEXT, score REAL, pinned BOOLEAN)');
  db.exec('CREATE TABLE "order" (id INTEGER PRIMARY KEY, "select" TEXT, "group" INTEGER)');
  db.exec(`INSERT INTO "order" VALUES (1, 'a', 10), (2, 'b', 20), (3, NULL, 30)`);
});
afterAll(() => db.close());

function ids(sql: string): number[] {
  // Preparing an empty statement crashes node:sqlite, so a refused translation must fail here instead.
  if (!sql) throw new Error('translation was refused');
  return db.prepare(sql).all().map(row => Number(row.id));
}

function withRows<T>(rows: [string | null, number | null, boolean][], run: () => T): T {
  db.exec('DELETE FROM notes');
  const insert = db.prepare('INSERT INTO notes (id, body, score, pinned) VALUES (?, ?, ?, ?)');
  rows.forEach(([body, score, pinned], i) => insert.run(i + 1, body, score, pinned ? 1 : 0));
  return run();
}

const hostile = fc.string({ unit: fc.constantFrom("'", '"', '\\', ';', '--', '/*', '*/', ' OR 1=1', '\n', 'a', '€', '😀') });
const anyText = fc.oneof(hostile, fc.string({ unit: 'grapheme' }));

describe('generated SQL executes on SQLite', () => {
  test('reserved table and column names are quoted correctly', () => {
    expect(ids(convertToSQL('db.order.find({group: {$gte: 20}}, {id: 1, select: 1});'))).toEqual([2, 3]);
    expect(ids(convertToSQL('db.order.find({select: null}, {id: 1});'))).toEqual([3]);
    expect(ids(convertToSQL('db.order.find({$or: [{select: "a"}, {group: 30}]}, {id: 1});'))).toEqual([1, 3]);
  });

  test('booleans compare against stored 0/1', () =>
    withRows([['x', 1, true], ['y', 2, false]], () => {
      expect(ids(convertToSQL('db.notes.find({pinned: true});'))).toEqual([1]);
      expect(ids(convertToSQL('db.notes.find({pinned: {$ne: true}});'))).toEqual([2]);
    }));

  test('any string literal matches exactly the row that stores it', () => {
    fc.assert(
      fc.property(anyText, anyText, (target, other) => {
        fc.pre(target !== other && !target.includes('\0') && !other.includes('\0'));
        const sql = convertToSQL(`db.notes.find({body: ${JSON.stringify(target)}}, {id: 1});`);
        expect(withRows([[target, null, false], [other, null, false]], () => ids(sql))).toEqual([1]);
      }),
      { numRuns: 300 },
    );
  });

  test('$in over arbitrary strings selects exactly the listed rows', () => {
    fc.assert(
      fc.property(fc.uniqueArray(hostile, { minLength: 2, maxLength: 6 }), values => {
        const picked = values.slice(0, Math.ceil(values.length / 2));
        const sql = convertToSQL(`db.notes.find({body: {$in: ${JSON.stringify(picked)}}}, {id: 1});`);
        const rows = values.map(v => [v, null, false] as [string, null, boolean]);
        expect(withRows(rows, () => ids(sql))).toEqual(picked.map((_, i) => i + 1));
      }),
      { numRuns: 100 },
    );
  });

  test('finite numbers round-trip through the SQL literal; unsafe integers are refused', () => {
    fc.assert(
      fc.property(fc.oneof(fc.maxSafeInteger(), fc.double({ noNaN: true, noDefaultInfinity: true })), n => {
        const sql = convertToSQL(`db.notes.find({score: ${JSON.stringify(n)}}, {id: 1});`);
        if (Number.isInteger(n) && !Number.isSafeInteger(n)) expect(sql).toBe('');
        else expect(withRows([['n', n, false], ['m', n === 1 ? 2 : 1, false]], () => ids(sql))).toEqual([1]);
      }),
      { numRuns: 300 },
    );
  });
});

describe('identifier properties', () => {
  test('a key is either a plain identifier or the whole query is refused', () => {
    fc.assert(
      fc.property(fc.string({ unit: 'binary' }), key => {
        const sql = convertToSQL(`db.notes.find({${JSON.stringify(key)}: 1});`);
        if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) expect(sql).toMatch(/^SELECT \* FROM notes WHERE ("?)[A-Za-z_][A-Za-z0-9_]*\1 = 1;$/);
        else expect(sql).toBe('');
      }),
      { numRuns: 500 },
    );
  });
});
