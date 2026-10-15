import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('Library contains decorative overflow without restricting its content height',()=>{
 const css=readFileSync(new URL('../../src/app/globals.css',import.meta.url),'utf8');
 const page=css.match(/body \.library-redesign-page\{[^}]+\}/)?.[0];
 assert(page?.includes('overflow:clip'));
 assert(page?.includes('height:auto;min-height:100%'));
 assert(css.includes('body .app-content:has(.library-redesign-page){padding:0;overflow:auto;'));
});
