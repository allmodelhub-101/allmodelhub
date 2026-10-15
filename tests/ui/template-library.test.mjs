import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../../src/components/template-library.tsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../../src/components/template-library.css',import.meta.url),'utf8');
test('template launch preserves the exact encoded prompt and descriptive accessible action',()=>{
 assert(source.includes('encodeURIComponent(template.prompt)'));
 assert(source.includes('aria-label={`Use ${template.title} template`}'));
 assert(!source.includes('dangerouslySetInnerHTML'));
});
test('search combines with category, announces results and supports reset',()=>{
 assert(source.includes('category === "all" || template.category === category'));
 assert(source.includes('query.trim().toLowerCase()'));
 assert(source.includes('aria-live="polite"'));
 assert(source.includes('setQuery(""); setCategory("all");'));
 assert(source.includes('aria-pressed={category === item}'));
});
test('cards size to content and titles remain readable, with optional decorative motion',()=>{
 assert(css.includes('min-height:0; height:auto;'));
 assert(css.includes('white-space:normal; overflow-wrap:anywhere; text-overflow:clip'));
 assert(css.includes('prefers-reduced-motion:reduce'));
 assert(css.includes('animation:none!important; transition:none!important'));
 assert(css.includes('.low-bandwidth'));
});
