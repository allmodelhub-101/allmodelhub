import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import crypto from 'node:crypto';
const baseline=JSON.parse(fs.readFileSync(new URL('./workspace-contract-baseline.json',import.meta.url)));
for(const [key,expected]of Object.entries(baseline))test(`Phase 4 workspace execution contract unchanged: ${key}`,()=>{
 const [file,owner,name]=key.split('#'),text=fs.readFileSync(file,'utf8'),ast=ts.createSourceFile(file,text,99,true,4);const hashes=[];const scope=owner==='module'?ast:ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text===owner);assert.ok(scope,'Controller boundary must remain present');
 if(name==='@prefix'){const statements=scope.body.statements.filter(n=>!ts.isReturnStatement(n));hashes.push(crypto.createHash('sha256').update(statements.map(n=>n.getText(ast)).join('\n').replace(/\r\n/g,'\n')).digest('hex'))}
 if(name==='@formatting'){const calls=[];function collect(n){if(ts.isCallExpression(n)&&(n.expression.getText(ast)==='Number'||(ts.isPropertyAccessExpression(n.expression)&&n.expression.name.text==='toFixed')))calls.push(n.getText(ast));ts.forEachChild(n,collect)}collect(scope.body.statements.find(ts.isReturnStatement));hashes.push(crypto.createHash('sha256').update(calls.sort().join('\n').replace(/\r\n/g,'\n')).digest('hex'))}
 function visit(n){let body;if(ts.isFunctionDeclaration(n)&&n.name?.text===name)body=n;else if(ts.isVariableDeclaration(n)&&ts.isIdentifier(n.name)&&n.name.text===name&&n.initializer&&(ts.isArrowFunction(n.initializer)||ts.isFunctionExpression(n.initializer)))body=n.initializer;if(body)hashes.push(crypto.createHash('sha256').update(body.getText(ast).replace(/\r\n/g,'\n')).digest('hex'));ts.forEachChild(n,visit)}visit(scope);
 assert.ok(hashes.includes(expected),'Original controller handler must remain unchanged; do not regenerate the baseline to conceal changes.');
});
