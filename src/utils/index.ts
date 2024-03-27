import JSON5 from 'json5';
import { MONGO_QUERY_OPERATOR } from '../constants';
import ErrorHandler from '../ErrorHandler';

// Define a map for MongoDB query operators and their corresponding SQL symbols
const mongoOperatorsMap: Record<string, string> = {
  $or: 'OR',
  $and: 'AND',
  $lt: '<',
  $lte: '<=',
  $gt: '>',
  $gte: '>=',
  $ne: '!=',
  $in: 'IN',
  $eq: '=',
};

/**
 * Convert a string to a JavaScript object using JSON5 library.
 * The string syntax follows JSON5 syntax.
 */
const parseObjFromString = (inputString: string): any => {
  try {
    const obj = JSON5.parse(inputString);
    return obj;
  } catch (error) {
    ErrorHandler.handleError(error as Error);
    return {};
  }
};

/**
 * Get the operand in the correct format based on its type and operator.
 */
const getFormattedOperand = (
  operand: any,
  operator: string | null,
  field: string | null,
  removeUnderscoreBeforeID: boolean
): string => {
  try {
    if (typeof operand === 'string') {
      return "'" + operand + "'";
    } else if (operator === 'IN') {
      // Format arrays for IN operator
      operand = operand.map((op: any) => getFormattedOperand(op, null, null, removeUnderscoreBeforeID)).join(', ');
      return '(' + operand + ')';
    } else if (field === MONGO_QUERY_OPERATOR) {
      // Build nested WHERE clauses
      return operand.reduce((prev: string[], curr: any) => [...prev, buildWhereElement(curr, removeUnderscoreBeforeID)], []).join(' ' + operator + ' ');
    } else {
      return operand.toString(); // Convert other types to strings
    }
  } catch (error) {
    ErrorHandler.handleError(error as Error);
    return '';
  }
};

/**
 * Build an element of the WHERE clause.
 */
const buildWhereElement = (element: any, removeUnderscoreBeforeID: boolean): string => {
  try {
    if (removeUnderscoreBeforeID && element.field === '_id') {
      element.field = 'id'; // Rename _id field to id
    }
    const { field, operator, operand } = element;

    if (field === MONGO_QUERY_OPERATOR) {
      // Handle nested MongoDB query operators
      return '(' + getFormattedOperand(operand, operator, field, removeUnderscoreBeforeID) + ')';
    } else {
      // Construct regular WHERE clause element
      return field + ' ' + operator + ' ' + getFormattedOperand(operand, operator, field, removeUnderscoreBeforeID);
    }
  } catch (error) {
    ErrorHandler.handleError(error as Error);
    return '';
  }
};

export { mongoOperatorsMap, parseObjFromString, buildWhereElement };
