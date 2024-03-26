import { convertToSQL } from './index';

export const usage = `Usage: mongo-to-sql [--rename-id] '<db.collection.find(...)>'
       echo '<db.collection.find(...)>' | mongo-to-sql [--rename-id]

Prints the SQL translation, or exits 1 if the query is outside the supported subset.
  --rename-id  translate the _id field to id`;

export interface CliResult {
  code: number;
  stdout: string;
  stderr: string;
}

/** Pure CLI logic; `stdin` is only consulted when no query argument is given. */
export function runCli(args: string[], stdin: () => string): CliResult {
  if (args.includes('-h') || args.includes('--help')) return { code: 0, stdout: usage + '\n', stderr: '' };
  const renameID = args.includes('--rename-id');
  const rest = args.filter(arg => arg !== '--rename-id');
  if (rest.length > 1 || rest.some(arg => arg.startsWith('-'))) return { code: 2, stdout: '', stderr: usage + '\n' };
  const query = (rest[0] ?? stdin()).trim();
  if (!query) return { code: 2, stdout: '', stderr: usage + '\n' };
  const sql = convertToSQL(query, renameID);
  if (!sql) return { code: 1, stdout: '', stderr: 'mongo-to-sql: unsupported or malformed query\n' };
  return { code: 0, stdout: sql + '\n', stderr: '' };
}
