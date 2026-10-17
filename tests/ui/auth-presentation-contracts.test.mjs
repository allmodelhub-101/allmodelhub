import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import ts from 'typescript';
const baseline=JSON.parse(fs.readFileSync(new URL('./auth-presentation-baseline.json',import.meta.url)));
const source=fs.readFileSync('src/components/login-form.tsx','utf8');
const ast=ts.createSourceFile('login.tsx',source,99,true,4);
for(const [name,expected] of Object.entries(baseline.hashes))test(`Phase 5 authentication contract preserved: ${name}`,()=>{
 const matches=[];
 function visit(n){if(ts.isFunctionDeclaration(n)&&n.name?.text===name)matches.push(crypto.createHash('sha256').update(n.getText(ast).replace(/\r\n/g,'\n')).digest('hex'));ts.forEachChild(n,visit)}
 visit(ast);assert.deepEqual(matches,[expected]);
});
