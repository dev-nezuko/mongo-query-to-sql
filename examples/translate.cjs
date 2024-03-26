const { convertToSQL } = require('../dist/index.js');
const input = 'db.users.find({age: {$gte: 21}, active: true}, {name: 1, _id: 1});';
console.log(convertToSQL(input, true));
