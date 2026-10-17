import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import ts from 'typescript';
const hashes=JSON.parse(fs.readFileSync(new URL('./chat-contract-baseline.json',import.meta.url)));
const text=fs.readFileSync(new URL('../../src/components/chat-client.tsx',import.meta.url),'utf8');
const source=ts.createSourceFile('chat-client.tsx',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const actual={};
function visit(node){const name=node.name?.getText(source);if(name in hashes&&(ts.isFunctionDeclaration(node)||ts.isVariableDeclaration(node)))actual[name]=crypto.createHash('sha256').update(node.getText(source).replace(/\r\n/g,'\n')).digest('hex');ts.forEachChild(node,visit)}
visit(source);
for(const [name,hash] of Object.entries(hashes))test(`Phase 2 transport/persistence boundary unchanged: ${name}`,()=>assert.equal(actual[name],hash,'Review any contract change explicitly; never update this baseline for a presentation-only change.'));
