const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

// The <script> tag starts with "<script>\n'use strict';" and ends with "</script>"
const scriptRegex = /<script>\s*'use strict';[\s\S]*?<\/script>/;

if (scriptRegex.test(html)) {
    html = html.replace(scriptRegex, '<script src="js/ui.js?v=2"></script>');
    fs.writeFileSync('index.html', html);
    console.log('Script replaced successfully.');
} else {
    console.log('Script block not found!');
}
