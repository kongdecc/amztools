
const { DEFAULT_TOOLS } = require('./src/lib/constants');
console.log('Total tools:', DEFAULT_TOOLS.length);
const keys = new Set();
const dups = [];
DEFAULT_TOOLS.forEach(t => {
    if (keys.has(t.key)) dups.push(t.key);
    keys.add(t.key);
});
console.log('Duplicates:', dups);
console.log('Unique count:', keys.size);
