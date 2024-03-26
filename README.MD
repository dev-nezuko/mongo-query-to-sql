# MongoDB find syntax → SQL text


```typescript
import { convertToSQL } from './src';

convertToSQL('db.users.find({age: {$gte: 21}}, {name: 1, _id: 1});', true);
// SELECT name, id FROM users WHERE age >= 21;

convertToSQL('db.users.find({$or: [{age: {$gte: 21}, active: true}, {name: "Sample"}]});');
// SELECT * FROM users WHERE ((age >= 21 AND active = TRUE) OR name = 'Sample');
```

The optional second argument renames an exact `_id` field to `id` in filters and projections. An empty filter produces `SELECT * FROM users;`, without an empty `WHERE` clause.

## Run the examples

```sh
npm ci --ignore-scripts
npm test -- --runInBand
npm run example
```

`npm run build` compiles source into `dist/`. `npm run example` compiles and runs a synthetic query; it never opens MongoDB or a SQL database. The package entry points to `dist/index.js` after building. There is no interactive CLI or web UI.

## Supported subset

| Input | Translation |
| --- | --- |
| Direct string, finite number or boolean values | Equality comparison |
| `$eq`, `$ne`, `$lt`, `$lte`, `$gt`, `$gte` | Corresponding scalar comparison |
| `$in` with a nonempty list of non-null scalar values | `IN (...)` |
| `$and`, `$or` | Recursive logical groups; all fields in each operand are retained |
| Explicit `null` equality/inequality | `IS NULL` / `IS NOT NULL` |
| Projection fields set to `1` | Explicit SQL column list |
| `_id: 0` alongside included fields | Omit `_id` from that projection |

Collection and field names must use simple letters, digits and underscores, without a leading digit. The query is limited to 100,000 characters and logical recursion to 20 levels. JSON5 parses the argument text; no JavaScript is evaluated. Strings use doubled apostrophes for display literals.

Unsupported or malformed queries return `''`, preserving the function's existing failure contract. Non-string input throws. Unsupported operators, dotted paths, nested document literals, exclusion-only projections, method chains, empty `$in`, nonfinite numbers and extra arguments are rejected rather than partially translated.

## Boundaries that matter

This is **not a complete MongoDB-to-SQL compatibility layer**. MongoDB missing-field, array and null behavior do not generally match SQL. Projections do not reproduce MongoDB's implicit `_id` inclusion. There is no schema metadata, identifier quoting or reserved-word handling, and no declared SQL dialect. Some simple identifiers can still be reserved SQL words.

The output is for inspection and learning. Do not execute strings produced from untrusted input. A database-facing implementation should emit an explicit dialect's quoted identifiers and parameterized values, with tests for the target database's semantics. Doubling quotes here does not establish that safety contract across SQL dialects.

## Implementation and checks

`src/index.ts` exposes `convertToSQL`; `src/MongoDBToSQLTranslator.ts` validates the outer call, parses arguments, recursively builds conditions and renders the limited output. The previous extra parser and redundant helper files were removed to keep the supported grammar in one place.

The suite retains the original examples and adds empty-filter, apostrophe, nested-conjunction, range, null and fail-closed cases. TypeScript compilation and the executable example are checked separately. No database integration or cross-dialect correctness was tested.

The unused copied font folder was removed; this library has no font or browser rendering requirement. Package metadata declares ISC, but the repository has no `LICENSE` file; this README does not invent one or change attribution.
