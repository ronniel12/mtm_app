const fs = require('fs');
const path = require('path');

function removeDebugConsole(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      removeDebugConsole(fullPath);
    } else if (entry.name.endsWith('.js') || entry.name.endsWith('.vue')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      // Remove lines that are console.log, console.debug, console.info, console.dir
      const lines = content.split('\n');
      const cleanedLines = lines.filter(line => {
        const trimmed = line.trim();
        return !(trimmed.match(/console\.(log|debug|info|dir)\(/));
      });
      const newContent = cleanedLines.join('\n');
      if (newContent !== content) {
        fs.writeFileSync(fullPath, newContent);
        console.log('Cleaned: ' + fullPath);
      }
    }
  }
}

removeDebugConsole('api');
removeDebugConsole('frontend');
