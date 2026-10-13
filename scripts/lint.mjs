import {readdirSync,readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
const root=fileURLToPath(new URL('../',import.meta.url)),write=process.argv.includes('--write');let failed=false,count=0;
function scan(dir){for(const entry of readdirSync(dir,{withFileTypes:true})){
  if(['node_modules','.git','dist','test-results'].includes(entry.name))continue;
  const path=join(dir,entry.name);if(entry.isDirectory()){scan(path);continue;}
  if(!/\.(ts|mjs|css|html|json|md|yml)$/.test(path))continue;++count;
  let source=readFileSync(path,'utf8'),normalized=source.replace(/\r\n/g,'\n').split('\n').map(line=>line.replace(/[\t ]+$/,'')).join('\n').replace(/\n*$/,'\n');
  if(source!==normalized){if(write)writeFileSync(path,normalized);else{console.error('Formatting:',path);failed=true;}}
  if(path.endsWith('.json'))try{JSON.parse(source);}catch{failed=true;console.error('Invalid JSON:',path);}
  if(path.endsWith('.mjs'))try{execFileSync(process.execPath,['--check',path],{stdio:'pipe'});}catch(error){failed=true;console.error(error.stderr?.toString());}
  if(path.endsWith('.ts')&&(/@ts-nocheck|@ts-ignore/.test(source)||/\b:\s*any\b/.test(source))){failed=true;console.error('Unsafe TypeScript suppression:',path);}
}}
scan(root);console.log(`Checked formatting, JS syntax, JSON and TypeScript suppression rules: ${count} files.`);if(failed)process.exitCode=1;
