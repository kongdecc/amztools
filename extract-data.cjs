const fs = require('fs');
const path = require('path');

const htmlPath = 'e:/aitest/amztools7/电商营销日历.html';
const outPath = 'e:/aitest/amztools7/src/app/marketing-calendar/calendar-data.json';

try {
    const content = fs.readFileSync(htmlPath, 'utf8');
    const regex = /const events = (\[.*?\]);/s; // 's' flag for dotAll match
    const match = content.match(regex);
    
    if (match && match[1]) {
        fs.writeFileSync(outPath, match[1], 'utf8');
        console.log('Data extracted successfully');
    } else {
        console.error('No match found');
        process.exit(1);
    }
} catch (e) {
    console.error(e);
    process.exit(1);
}
