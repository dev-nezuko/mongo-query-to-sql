import JSON5 from 'json5';

type RecordValue = Record<string, unknown>;
const operators: Record<string, string> = { $eq: '=', $ne: '!=', $lt: '<', $lte: '<=', $gt: '>', $gte: '>=' };
function object(value: unknown): value is RecordValue {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function identifier(value: string, renameID = false): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) throw new Error('Unsupported identifier');
  return renameID && value === '_id' ? 'id' : value;
}
function literal(value: unknown): string {
  if (typeof value === 'string') return "'" + value.replace(/'/g, "''") + "'";
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
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
  if (!sqlOperator) throw new Error('Unsupported operator');
  if (operand === null) {
    if (operator === '$eq') return `${field} IS NULL`;
    if (operator === '$ne') return `${field} IS NOT NULL`;
    throw new Error('Unsupported NULL comparison');
  }
  return `${field} ${sqlOperator} ${literal(operand)}`;
}
function condition(value: unknown, renameID: boolean, depth = 0): string {
  if (!object(value) || depth > 20) throw new Error('Unsupported filter');
  return Object.entries(value).map(([key, operand]) => {
    if (key === '$and' || key === '$or') {
      if (!Array.isArray(operand) || !operand.length) throw new Error('Empty logical group');
      const nested = operand.map(item => condition(item, renameID, depth + 1));
      if (nested.some(item => !item)) throw new Error('Empty logical condition');
      // Preserve implicit conjunctions inside every logical operand.
      return '(' + nested.map(item => item.includes(' AND ') ? '(' + item + ')' : item).join(key === '$or' ? ' OR ' : ' AND ') + ')';
    }
    const field = identifier(key, renameID);
    if (!object(operand)) return comparison(field, '$eq', operand);
    if (!Object.keys(operand).length) throw new Error('Empty operator object');
    return Object.entries(operand).map(([operator, item]) => comparison(field, operator, item)).join(' AND ');
  }).join(' AND ');
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
      const where = condition(args[0], removeUnderscoreBeforeID);
      return `SELECT ${projection(args[1], removeUnderscoreBeforeID)} FROM ${identifier(match[1])}${where ? ' WHERE ' + where : ''};`;
    } catch { return ''; }
  }
}
