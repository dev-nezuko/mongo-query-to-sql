import { describe, expect, test } from 'vitest';
import { convertToSQL } from '../src/index';

const find = (filter: string, projection?: string) =>
  convertToSQL(`db.items.find(${filter}${projection ? ', ' + projection : ''});`);

describe('operators at their edges', () => {
  test('$in with an empty array fails closed (SQL has no empty IN list)', () => expect(find('{tag: {$in: []}}')).toBe(''));
  test('$in containing null fails closed', () => expect(find('{tag: {$in: ["a", null]}}')).toBe(''));
  test('$in mixes strings, numbers and booleans', () =>
    expect(find('{tag: {$in: ["a", 2, false]}}')).toBe("SELECT * FROM items WHERE tag IN ('a', 2, FALSE);"));
  test('$in with a nested array fails closed', () => expect(find('{tag: {$in: [[1]]}}')).toBe(''));
  test('$ne null becomes IS NOT NULL', () => expect(find('{owner: {$ne: null}}')).toBe('SELECT * FROM items WHERE owner IS NOT NULL;'));
  test('$eq null becomes IS NULL', () => expect(find('{owner: {$eq: null}}')).toBe('SELECT * FROM items WHERE owner IS NULL;'));
  test('ordering against null fails closed', () => expect(find('{owner: {$gt: null}}')).toBe(''));
  test.each(['$regex', '$exists', '$not', '$nin', '$elemMatch', '$where'])('%s is not translated', op =>
    expect(find(`{name: {${op}: "x"}}`)).toBe(''));
  test('a regex literal is rejected by the parser', () => expect(find('{name: /^a/}')).toBe(''));
  test('$nor at the top level is rejected', () => expect(find('{$nor: [{a: 1}]}')).toBe(''));
});

describe('logical nesting', () => {
  test('$or inside $and', () =>
    expect(find('{$and: [{$or: [{a: 1}, {b: 2}]}, {c: 3}]}')).toBe('SELECT * FROM items WHERE ((a = 1 OR b = 2) AND c = 3);'));
  test('$and inside $or', () =>
    expect(find('{$or: [{$and: [{a: 1}, {b: 2}]}, {c: 3}]}')).toBe('SELECT * FROM items WHERE ((a = 1 AND b = 2) OR c = 3);'));
  test('a logical group beside plain fields', () =>
    expect(find('{kind: "x", $or: [{a: 1}, {b: 2}]}')).toBe("SELECT * FROM items WHERE kind = 'x' AND (a = 1 OR b = 2);"));
  test('an empty operand inside $or fails closed', () => expect(find('{$or: [{}, {a: 1}]}')).toBe(''));
  test('20 nested levels are accepted, 21 are not', () => {
    const nest = (n: number) => '{$and: ['.repeat(n) + '{a: 1}' + ']}'.repeat(n);
    expect(find(nest(20))).not.toBe('');
    expect(find(nest(22))).toBe('');
  });
});

describe('values', () => {
  test('numeric strings stay strings', () => expect(find('{zip: "02134"}')).toBe("SELECT * FROM items WHERE zip = '02134';"));
  test('booleans', () => expect(find('{a: true, b: false}')).toBe('SELECT * FROM items WHERE a = TRUE AND b = FALSE;'));
  test('negative, fractional and hex numbers', () =>
    expect(find('{a: -3, b: 0.25, c: 0x1F}')).toBe('SELECT * FROM items WHERE a = -3 AND b = 0.25 AND c = 31;'));
  test('Infinity fails closed', () => expect(find('{a: Infinity}')).toBe(''));
  test('ISODate() and new Date() are not parsed', () => {
    expect(find('{at: ISODate("2024-01-01T00:00:00Z")}')).toBe('');
    expect(find('{at: new Date("2024-01-01")}')).toBe('');
  });
  test('a date written as a string is compared as text', () =>
    expect(find('{at: {$gte: "2024-01-01"}}')).toBe("SELECT * FROM items WHERE at >= '2024-01-01';"));
  test('a nested document value fails closed', () => expect(find('{meta: {colour: "red"}}')).toBe(''));
  test('unicode string values pass through', () => expect(find('{name: "Zoë – 東京"}')).toBe("SELECT * FROM items WHERE name = 'Zoë – 東京';"));
  test('backslashes are not escape characters in standard SQL', () =>
    expect(find(String.raw`{path: "C:\\tmp\\"}`)).toBe(String.raw`SELECT * FROM items WHERE path = 'C:\tmp\';`));
});

describe('identifiers', () => {
  test.each(['café', '名前', 'naïve_field'])('non-ASCII identifier %s fails closed', name => expect(find(`{"${name}": 1}`)).toBe(''));
  test.each(['1st', 'a-b', 'a b', 'a"b', 'a.b', ''])('identifier %j fails closed', name => expect(find(`{${JSON.stringify(name)}: 1}`)).toBe(''));
  test('a reserved collection name is quoted', () => expect(convertToSQL('db.select.find({});')).toBe('SELECT * FROM "select";'));
  test('__proto__ as a field name does not pollute Object.prototype', () => {
    expect(find('{__proto__: {polluted: 1}}')).toBe('');
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});

describe('projection and call shape', () => {
  test('_id renaming applies to the projection too', () =>
    expect(convertToSQL('db.items.find({}, {_id: 1, name: 1});', true)).toBe('SELECT id, name FROM items;'));
  test('_id: 0 with nothing else included fails closed', () => expect(find('{}', '{_id: 0}')).toBe(''));
  test('a third argument fails closed', () => expect(convertToSQL('db.items.find({}, {a: 1}, {b: 1});')).toBe(''));
  test('trailing semicolon and surrounding whitespace are optional', () =>
    expect(convertToSQL('  db.items.find({a: 1})  ')).toBe('SELECT * FROM items WHERE a = 1;'));
  test('input over 100,000 characters fails closed', () =>
    expect(find(`{a: "${'x'.repeat(100_000)}"}`)).toBe(''));
  test('non-string input throws', () => expect(() => convertToSQL(42 as unknown as string)).toThrow('Input must be a string'));
});
