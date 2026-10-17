import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import crypto from 'node:crypto';
const baseline=JSON.parse(fs.readFileSync(new URL('./studio-contract-baseline.json',import.meta.url)));
for(const [key,expected]of Object.entries(baseline))test(`Phase 3 studio execution contract unchanged: ${key}`,()=>{
 const [file,name]=key.split('#'),text=fs.readFileSync(file,'utf8'),ast=ts.createSourceFile(file,text,99,true,4);let actual;
 function visit(node){if(ts.isFunctionDeclaration(node)&&node.name?.text===name)actual=crypto.createHash('sha256').update(node.getText(ast).replace(/\r\n/g,'\n')).digest('hex');ts.forEachChild(node,visit)}visit(ast);
 assert.equal(actual,expected,'Review execution changes explicitly; do not regenerate hashes for presentation work.');
});
