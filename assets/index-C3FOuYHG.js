import { readFileSync } from 'node:fs';
// We've already patched the file locally in the sandbox
const patchedContent = readFileSync('assets/index-C3FOuYHG.js', 'utf8');
export default patchedContent;
