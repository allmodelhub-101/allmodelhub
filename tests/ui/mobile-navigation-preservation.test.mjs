import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import ts from 'typescript';
import {workspaceGenerationStatus} from '../../src/components/workspace-navigation.ts';
const baseline=JSON.parse(fs.readFileSync(new URL('./mobile-navigation-preservation.json',import.meta.url)));
const hash=text=>crypto.createHash('sha256').update(text.replace(/\r\n/g,'\n')).digest('hex');
for(const [file,expected]of Object.entries(baseline.files))test(`Mobile navigation preserves integration-base source: ${file}`,()=>{
 assert.equal(hash(fs.readFileSync(file,'utf8')),expected,'Preserve restored Chat, generation, theme and unrelated source; do not regenerate this baseline to hide changes.');
});
for(const [name,expected]of Object.entries(baseline.topbarHandlers))test(`Mobile navigation preserves topbar handler: ${name}`,()=>{
 const file='src/components/workspace-topbar.tsx',text=fs.readFileSync(file,'utf8'),ast=ts.createSourceFile(file,text,99,true,4);const found=[];
 function walk(n){if(n.name?.text===name){if(ts.isFunctionDeclaration(n))found.push(hash(n.getText(ast)));else if(ts.isVariableDeclaration(n)&&n.initializer)found.push(hash(n.initializer.getText(ast)))}ts.forEachChild(n,walk)}walk(ast);
 assert.ok(found.includes(expected),'Existing project, wallet, notification, search destinations and retry contracts remain unchanged.');
});
test('Mobile generation count bridge publishes changes, unsubscribes and has a stable empty SSR snapshot',()=>{
 workspaceGenerationStatus.publish(0);const events=[];
 const unsubscribe=workspaceGenerationStatus.subscribe(()=>events.push(workspaceGenerationStatus.getSnapshot()));
 workspaceGenerationStatus.publish(2);workspaceGenerationStatus.publish(2);workspaceGenerationStatus.publish(3);
 assert.deepEqual(events,[2,3]);assert.equal(workspaceGenerationStatus.getServerSnapshot(),0);
 unsubscribe();workspaceGenerationStatus.publish(0);assert.deepEqual(events,[2,3]);assert.equal(workspaceGenerationStatus.getSnapshot(),0);
});
