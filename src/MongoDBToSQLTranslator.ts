var mongoParse = require('mongo-parse');
import { mongoOperatorsMap, parseObjFromString, buildWhereElement } from './utils';
import { MONGO_QUERY_OPERATOR } from './constants';
import ErrorHandler from './ErrorHandler';

// Define interfaces for parsed query and statements
interface ParsedQuery {
  fromClausePrepared: string;
  queryStatements: string;
}

interface ParsedStatements {
  whereClausePrepared: any[];
  selectClausePrepared: string[];
}

// Class for translating MongoDB queries to SQL
class MongoDBToSQLTranslator {
  // Private method to parse the structure of the original query
  private parseStructure(originalQuery: string): ParsedQuery {
    if (originalQuery.length < 1) {
      ErrorHandler.handleError(new Error('Empty query'));
    }

    let index = originalQuery.indexOf('.');
    if (index === -1) {
      ErrorHandler.handleError(new Error('Wrong format'));
    }

    const prefix = originalQuery.slice(0, index);
    if (prefix !== 'db') {
      ErrorHandler.handleError(new Error('Wrong format'));
    }

    let rest = originalQuery.slice(index + 1);
    index = rest.indexOf('.');
    if (index === -1) {
      ErrorHandler.handleError(new Error('Wrong format'));
    }

    const fromClausePrepared = rest.slice(0, index);
    if (fromClausePrepared.length < 1) {
      ErrorHandler.handleError(new Error('Missing collection name'));
    }

    rest = rest.slice(index + 1);
    index = rest.indexOf('(');
    const method = rest.slice(0, index);
    if (method !== 'find') {
      ErrorHandler.handleError(new Error('Wrong or not supported MongoDB method (' + method + ')'));
    }

    let lastChar = rest.length;
    if (rest[lastChar - 1] === ';') {
      lastChar -= 1;
    }
    const queryStatements = rest.slice(index, lastChar);

    return { fromClausePrepared, queryStatements };
  }

  // Private method to parse the statements within the query
  private parseStatements(originalStatements: string): ParsedStatements {
    if (originalStatements[0] !== '(' || originalStatements[originalStatements.length - 1] !== ')') {
      ErrorHandler.handleError(new Error('Method is not parenthesized'));
    }

    const preparedForObjectParsing = '[' + originalStatements.slice(1, originalStatements.length - 1) + ']';
    const query = parseObjFromString(preparedForObjectParsing);

    const whereParsed = mongoParse.parse(query[0]);
    const selectParsed = mongoParse.parse(query[1]);

    const whereClausePrepared = whereParsed.parts.reduce((prev: any[], curr: any) => [...prev, this.prepareWhereClause(curr)], []);
    const selectClausePrepared = selectParsed.parts.reduce((prev: string[], curr: any) => {
      if (curr.operand === 1) {
        return [...prev, curr.field];
      } else {
        return prev;
      }
    }, []);

    return { whereClausePrepared, selectClausePrepared };
  }

  // Private method to prepare the where clause elements
  private prepareWhereClause(currentMongoParserElement: any): any {
    const { field, operator, operand } = currentMongoParserElement;

    if (typeof field === 'undefined') {
      const nested = operand.reduce((prev: any[], curr: any) => {
        const parsed = mongoParse.parse(curr);
        return [...prev, this.prepareWhereClause(parsed.parts[0])];
      }, []);

      return { field: MONGO_QUERY_OPERATOR, operator: mongoOperatorsMap[operator], operand: nested };
    }

    return { field, operator: mongoOperatorsMap[operator], operand };
  }

  // Private method to build the SQL query
  private buildSQL(describedQuery: { selectClausePrepared: string[]; fromClausePrepared: string; whereClausePrepared: any[] }, removeUnderscoreBeforeID: boolean): string {
    const { selectClausePrepared, fromClausePrepared, whereClausePrepared } = describedQuery;

    if (removeUnderscoreBeforeID) {
      selectClausePrepared.forEach((element, index) => {
        if (element === '_id') {
          selectClausePrepared[index] = 'id';
        }
      });
    }

    // Construct the SQL query
    const select = 'SELECT ' + (selectClausePrepared.length > 0 ? selectClausePrepared.join(', ') : '*');
    const from = 'FROM ' + fromClausePrepared;
    const where = 'WHERE ' + whereClausePrepared.reduce((prev, curr) => [...prev, buildWhereElement(curr, removeUnderscoreBeforeID)], []).join(' AND ');

    return select + ' ' + from + ' ' + where + ';';
  }

  // Public method to produce SQL from MongoDB input
  public produceSQL(input: string, removeUnderscoreBeforeID: boolean = false): string {
    try {
      const { fromClausePrepared, queryStatements } = this.parseStructure(input.trim());
      const { whereClausePrepared, selectClausePrepared } = this.parseStatements(queryStatements.trim());
      return this.buildSQL({
        selectClausePrepared,
        fromClausePrepared,
        whereClausePrepared
      }, removeUnderscoreBeforeID);
    } catch (error) {
      ErrorHandler.handleError(error as Error);
      return ''; // Return a default value in case of an error
    }
  }
}

// Export the MongoDBToSQLTranslator class
export default MongoDBToSQLTranslator;
