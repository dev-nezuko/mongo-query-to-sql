# MongoDB to SQL Translator

This project is a powerful tool for translating MongoDB queries to SQL statements. It is written in TypeScript and can be run in a Node.js environment. This project is built for Glassdoor takehome exercise purpose.

## Usage

To use this translator in your project, follow these steps:

1. **Import the `convertToSQL` Function:**
   Import the `convertToSQL` function from the `MongoDBToSQLTranslator` module.

2. **Convert MongoDB Query to SQL**

To convert a MongoDB query into SQL using this function, call the `convertToSQL` function and pass your MongoDB query as a string parameter. Replace `'your MongoDB query'` with your actual MongoDB query.

Here's an example in TypeScript:

```typescript
const sql = convertToSQL('your MongoDB query');
```

By default, the function does not remove underscores before the ID field in the generated SQL. If you want to remove underscores before the ID, you can pass `true` as the second parameter.

```typescript
const sqlWithoutUnderscore = convertToSQL('your MongoDB query', true);
```

The converted SQL query will be stored in the `sql` or `sqlWithoutUnderscore` variable. You can log or use this SQL query as needed.

```typescript
console.log(sql);
console.log(sqlWithoutUnderscore);
```

## Scripts

You can run the following scripts using npm:

- `npm run dev`: Compiles the TypeScript files and runs the resulting JavaScript code in a Node.js environment.
- `npm run test`: Executes the test suite using Jest to ensure the functionality of the translator.

## Dependencies

This project relies on the following dependencies:

- **json5:** Used to parse JSON5 strings.
- **mongo-parse:** Utilized for parsing MongoDB queries.

## Author

This project was authored by Saleem.

## License

This project is licensed under the ISC License. You can find more information about the license in the LICENSE file.

Feel free to contribute to this project by adding more features, enhancing existing functionalities, or fixing any issues. You can also customize the translator according to your project's needs.

If you have any questions, refer to the FAQ section or reach out to the author for assistance.

Happy translating!
