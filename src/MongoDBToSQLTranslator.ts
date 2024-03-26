import JSON5 from 'json5';

type RecordValue = Record<string, unknown>;
const operators: Record<string, string> = { $eq: '=', $ne: '!=', $lt: '<', $lte: '<=', $gt: '>', $gte: '>=' };
function object(value: unknown): value is RecordValue {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
// Reserved in PostgreSQL or SQLite; these names would not parse unquoted (e.g. `FROM order`).
const reserved = new Set(`ADD ALL ALTER ANALYSE ANALYZE AND ANY ARRAY AS ASC ASYMMETRIC AUTHORIZATION BETWEEN BINARY BOTH
BY CASE CAST CHECK COLLATE COLLATION COLUMN COMMIT CONCURRENTLY CONSTRAINT CREATE CROSS CURRENT_CATALOG CURRENT_DATE
CURRENT_ROLE CURRENT_SCHEMA CURRENT_TIME CURRENT_TIMESTAMP CURRENT_USER DEFAULT DEFERRABLE DELETE DESC DISTINCT DO DROP
ELSE END ESCAPE EXCEPT EXISTS FALSE FETCH FOR FOREIGN FREEZE FROM FULL GLOB GRANT GROUP HAVING ILIKE IN INDEX INITIALLY
INNER INSERT INTERSECT INTO IS ISNULL JOIN LATERAL LEADING LEFT LIKE LIMIT LOCALTIME LOCALTIMESTAMP NATURAL NOT NOTHING
NOTNULL NULL OFFSET ON ONLY OR ORDER OUTER OVERLAPS PLACING PRIMARY REFERENCES REGEXP RETURNING RIGHT SELECT SESSION_USER
SET SIMILAR SOME SYMMETRIC SYSTEM_USER TABLE TABLESAMPLE THEN TO TRAILING TRANSACTION TRUE UNION UNIQUE UPDATE USER USING
VALUES VARIADIC VERBOSE VIEW WHEN WHERE WINDOW WITH`.split(/\s+/));
function identifier(value: string, renameID = false): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) throw new Error('Unsupported identifier');
  const name = renameID && value === '_id' ? 'id' : value;
  // The pattern above rules out double quotes, so wrapping needs no escaping.
  return reserved.has(name.toUpperCase()) ? `"${name}"` : name;
}
function literal(value: unknown): string {
  if (typeof value === 'string') {
    // PostgreSQL rejects NUL in text and some drivers truncate at it, which would change the literal.
    if (value.includes('\0')) throw new Error('Unsupported NUL character');
    return "'" + value.replace(/'/g, "''") + "'";
  }
  // Integers beyond 2^53 were already rounded by the parser; refuse rather than emit a different number.
  if (typeof value === 'number' && Number.isFinite(value) && !(Number.isInteger(value) && !Number.isSafeInteger(value))) {
    return String(value);
  }
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (value === null) return 'NULL';
  throw new Error('Unsupported value');
}
function comparison(field: string, operator: string, operand: unknown): string {
  if (operator === '$in') {
    if (!Array.isArray(operand) || !operand.length || operand.includes(null)) throw new Error('Unsupported IN operands');
    return `${field} IN (${operand.map(literal).join(', ')})`;
  }
  const sqlOperator = operators[operator];
  if (typeof sqlOperator !== 'string') throw new Error('Unsupported operator');
  if (operand === null) {
    if (operator === '$eq') return `${field} IS NULL`;
    if (operator === '$ne') return `${field} IS NOT NULL`;
    throw new Error('Unsupported NULL comparison');
  }
  return `${field} ${sqlOperator} ${literal(operand)}`;
}
function terms(value: unknown, renameID: boolean, depth = 0): string[] {
  if (!object(value) || depth > 20) throw new Error('Unsupported filter');
  return Object.entries(value).flatMap(([key, operand]) => {
    if (key === '$and' || key === '$or') {
      if (!Array.isArray(operand) || !operand.length) throw new Error('Empty logical group');
      const groups = operand.map(item => {
        const parts = terms(item, renameID, depth + 1);
        if (!parts.length) throw new Error('Empty logical condition');
        // An operand with several fields is an implicit conjunction and must stay grouped under OR.
        return parts.length > 1 ? '(' + parts.join(' AND ') + ')' : parts[0];
      });
      return ['(' + groups.join(key === '$or' ? ' OR ' : ' AND ') + ')'];
    }
    const field = identifier(key, renameID);
    if (!object(operand)) return [comparison(field, '$eq', operand)];
    if (!Object.keys(operand).length) throw new Error('Empty operator object');
    return Object.entries(operand).map(([operator, item]) => comparison(field, operator, item));
  });
}
function projection(value: unknown, renameID: boolean): string {
  if (value === undefined || (object(value) && !Object.keys(value).length)) return '*';
  if (!object(value)) throw new Error('Unsupported projection');
  const selected: string[] = [];
  for (const [key, flag] of Object.entries(value)) {
    const name = identifier(key, renameID);
    if (flag === 1) selected.push(name);
    else if (!(key === '_id' && flag === 0)) throw new Error('Only inclusion projections are supported');
  }
  if (!selected.length) throw new Error('Exclusion-only projection needs schema knowledge');
  return selected.join(', ');
}

/** Limited string-to-string translator; it never connects to a database. */
export default class MongoDBToSQLTranslator {
  public produceSQL(input: string, removeUnderscoreBeforeID = false): string {
    try {
      if (input.length > 100000) return '';
      const match = /^db\.([A-Za-z_][A-Za-z0-9_]*)\.find\(([\s\S]*)\);?$/.exec(input.trim());
      if (!match) return '';
      const args: unknown[] = JSON5.parse('[' + match[2] + ']');
      if (args.length < 1 || args.length > 2 || !object(args[0])) return '';
      const where = terms(args[0], removeUnderscoreBeforeID).join(' AND ');
      return `SELECT ${projection(args[1], removeUnderscoreBeforeID)} FROM ${identifier(match[1])}${where ? ' WHERE ' + where : ''};`;
    } catch { return ''; }
  }
}
