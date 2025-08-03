// create-hash.js
const bcrypt = require('bcryptjs');
const password = '2005'; // <-- Put your desired password here

const salt = bcrypt.genSaltSync(10);
const hash = bcrypt.hashSync(password, salt);

console.log('Your password hash is:');
console.log(hash);
