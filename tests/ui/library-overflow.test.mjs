import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('Library contains decorative overflow without restricting its content height',()=>{
 const css=readFileSync(new URL('../../src/app/globals.css',import.meta.url),'utf8');
 const page=css.match(/body \.library-redesign-page\{[^}]+\}/)?.[0];
 const owner=readFileSync(new URL('../../src/components/workspace-data.module.css',import.meta.url),'utf8');
 assert(page?.includes('overflow:visible'));
 assert.match(owner,/\.surface\.library :global\(\.library-hero-art\)\s*\{[^}]*overflow:clip/);
 assert.match(owner,/\.surface\.library\s*\{[^}]*overflow:visible/);
 assert(page?.includes('height:auto;min-height:100%'));
 assert(css.includes('body .app-content:has(.library-redesign-page){padding:0;overflow:auto;'));
});
