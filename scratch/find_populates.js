import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const srcDir = path.join(__dirname, '../src');
const keys = [
  'dpUser', 'dpDetail', 'broadcaster', 'packageDetail', 'dpimages',
  'orderRequest', 'customer', 'dpDetailDrop', 'dpUserDrop', 'broadcast',
  'rating', 'order', 'dp', 'dpLocation', 'pdc', 'requestedUser',
  'requestedDpLocation'
];

const walk = (dir, callback) => {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      walk(fullPath, callback);
    } else if (stat.isFile() && file.endsWith('.js')) {
      callback(fullPath);
    }
  }
};

walk(srcDir, (filePath) => {
  const lines = fs.readFileSync(filePath, 'utf8').split('\n');
  lines.forEach((line, index) => {
    keys.forEach(key => {
      // Find populate('key') or populate("key")
      const regex = new RegExp(`populate\\([^)]*${key}[^)]*\\)`);
      if (regex.test(line)) {
        console.log(`${filePath}:${index + 1}: ${line.trim()}`);
      }
    });
  });
});
