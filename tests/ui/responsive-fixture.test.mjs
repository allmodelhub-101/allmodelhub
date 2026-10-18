import test from 'node:test';
import assert from 'node:assert/strict';
import { localResponsiveFixtureAllowed } from '../../src/lib/responsive-fixture-access.ts';
const local={mode:'development',flag:'1',host:'127.0.0.1:3100'};
test('explicit development opt-in accepts only loopback hosts',()=>{
  for(const host of ['127.0.0.1:3100','localhost','localhost:3100','[::1]:3100']) assert.equal(localResponsiveFixtureAllowed({...local,host}),true,host);
});
test('fixture fails closed in production and test even with the flag',()=>{
  for(const mode of ['production','test',undefined])assert.equal(localResponsiveFixtureAllowed({...local,mode}),false);
});
test('fixture fails closed without exact explicit opt-in',()=>{
  for(const flag of [undefined,'','0','true'])assert.equal(localResponsiveFixtureAllowed({...local,flag}),false);
});
test('fixture fails closed whenever Vercel is present',()=>{
  for(const vercel of ['1','0',''])assert.equal(localResponsiveFixtureAllowed({...local,vercel}),false);
});
test('fixture rejects remote hosts and loopback lookalikes',()=>{
  for(const host of ['','preview.vercel.app','localhost.evil','127.0.0.1.evil','evil@localhost','localhost:3100.evil','https://localhost','0.0.0.0:3100'])assert.equal(localResponsiveFixtureAllowed({...local,host}),false,host);
});
