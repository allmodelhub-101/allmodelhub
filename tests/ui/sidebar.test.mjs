import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sidebar=readFileSync(new URL('../../src/components/app-sidebar.tsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../../src/components/app-sidebar.css',import.meta.url),'utf8');
test('collapsed navigation keeps accessible labels and linked toggle state',()=>{
 assert(sidebar.includes('aria-label={label}'));
 assert(sidebar.includes('aria-expanded={!collapsed}'));
 assert(sidebar.includes('aria-controls="workspace-sidebar-links"'));
 assert(css.includes('.sidebar-section { display:none; }'));
 assert(css.includes('overflow-y:auto'));
});
test('account menu remains readable and keyboard operable in both sidebar states',()=>{
 assert(!sidebar.includes('<span className="sidebar-label">{language'));
 assert(sidebar.includes('accountTriggerRef.current?.focus()'));
 for(const key of ['ArrowDown','ArrowUp','Home','End','Escape'])assert(sidebar.includes(key));
 assert(sidebar.includes('document.addEventListener("focusin", blur)'));
 assert(css.includes('max-height:calc(100dvh - 100px)'));
});
test('sidebar motion and saved preferences have safe fallbacks',()=>{
 assert(css.includes('prefers-reduced-motion:reduce'));
 assert(sidebar.includes('try { setCollapsed(window.localStorage.getItem'));
 assert(sidebar.includes('try { window.localStorage.setItem'));
});
