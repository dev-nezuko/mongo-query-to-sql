import MongoDBToSQLTranslator from './MongoDBToSQLTranslator';

/**
 * Convert MongoDB query to SQL query.
 * The removeUnderscoreBeforeID flag, if true, will convert _id to id. Default is false.
 *
 * @param {string} input - The MongoDB query string.
 * @param {boolean} removeUnderscoreBeforeID - Flag to remove underscores before ID.
 * @returns {string} - The converted SQL query string.
 */
const convertToSQL = (input: string, removeUnderscoreBeforeID: boolean = false): string => {
  if (typeof input !== 'string') {
    throw new Error('Input must be a string');
  }

  const parser = new MongoDBToSQLTranslator();
  return parser.produceSQL(input, removeUnderscoreBeforeID);
};

export { convertToSQL };
