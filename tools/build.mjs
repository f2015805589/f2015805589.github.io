import {mkdir, cp} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const destination=path.join(root,'dist');
await mkdir(destination,{recursive:true});
for(const name of ['index.html','styles.css','script.js','assets','.nojekyll']) await cp(path.join(root,name),path.join(destination,name),{recursive:true});
console.log('Static site is ready in dist/.');
