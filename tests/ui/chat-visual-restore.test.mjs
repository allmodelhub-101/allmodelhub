import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import postcss from 'postcss';

const css=fs.readFileSync(new URL('../../src/components/chat-workspace.css',import.meta.url),'utf8');
const marker='/* Chat-only visual restoration from 314c764';
const restoration=css.slice(css.indexOf(marker));

test('classic Chat restoration cannot style surrounding chrome or other pages',()=>{
 assert(css.includes(marker));
 let count=0;
 postcss.parse(restoration).walkRules(rule=>{
  count++;
  for(const selector of rule.selectors){
   assert(selector.includes('.responsive-workspace .chat-workspace'),selector);
   assert(!/app-sidebar|app-topbar|app-main|app-content|mobile-nav|wallet|profile|(?:^|\s)body(?:\s|$)/.test(selector),selector);
  }
 });
 assert(count>30);
});

test('classic Chat keeps the pre-overhaul hero, pastel cards and narrow composer',()=>{
 for(const value of ['font-weight:850','clamp(40px,3.9vw,62px)','width:min(640px,calc(100% - 48px))','#4daaff','#925bff','#ff73b8','#30dda0','linear-gradient(145deg,transparent 62%'])assert(restoration.includes(value),value);
 assert(restoration.includes('@media (min-width:901px) and (max-height:650px)'));
 assert(restoration.includes('@media (min-width:901px) and (prefers-reduced-motion:reduce)'));
});
