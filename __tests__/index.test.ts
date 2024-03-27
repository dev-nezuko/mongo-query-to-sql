const { convertToSQL } = require('../src/index');

// Test cases for MongoDB to SQL conversion
describe('MongoDB to SQL Conversion', () => {
  test('Converts basic find query with projection', () => {
    const mongoQuery = 'db.user.find({_id: 23113},{name: 1, age: 1});';
    const expectedSQL = 'SELECT name, age FROM user WHERE id = 23113;';
    expect(convertToSQL(mongoQuery, true)).toBe(expectedSQL);
  });

  test('Converts find query with condition and projection', () => {
    const mongoQuery = 'db.user.find({age: {$gte: 21}},{name: 1, _id: 1});';
    const expectedSQL = 'SELECT name, id FROM user WHERE age >= 21;';
    expect(convertToSQL(mongoQuery, true)).toBe(expectedSQL);
  });

  test('Converts find query with $ne operator', () => {
    const mongoQuery = 'db.product.find({name: {$ne: \'laptop\'}},{price: 1});';
    const expectedSQL = 'SELECT price FROM product WHERE name != \'laptop\';';
    expect(convertToSQL(mongoQuery, true)).toBe(expectedSQL);
  });

  test('Converts find query with $and operator', () => {
    const mongoQuery = 'db.order.find({$and: [{status: \'placed\'}, {total: {$gt: 100}}]},{_id: 0, customer: 1});';
    const expectedSQL = 'SELECT customer FROM order WHERE (status = \'placed\' AND total > 100);';
    expect(convertToSQL(mongoQuery, true)).toBe(expectedSQL);
  });

  test('Converts find query with $or operator', () => {
    const mongoQuery = 'db.post.find({$or: [{title: \'news\'}, {content: \'announcement\'}]},{title: 1, author: 1});';
    const expectedSQL = 'SELECT title, author FROM post WHERE (title = \'news\' OR content = \'announcement\');';
    expect(convertToSQL(mongoQuery, true)).toBe(expectedSQL);
  });

  test('Converts find query with $in operator', () => {
    const mongoQuery = 'db.user.find({age: {$in: [25, 30]}},{name: 1});';
    const expectedSQL = 'SELECT name FROM user WHERE age IN (25, 30);';
    expect(convertToSQL(mongoQuery, true)).toBe(expectedSQL);
  });

  test('Converts find query without projection', () => {
    const mongoQuery = 'db.task.find({title: \'john\'});';
    const expectedSQL = 'SELECT * FROM task WHERE title = \'john\';';
    expect(convertToSQL(mongoQuery, true)).toBe(expectedSQL);
  });

});
