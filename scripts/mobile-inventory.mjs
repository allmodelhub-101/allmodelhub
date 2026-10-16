import fs from 'node:fs';
import path from 'node:path';
const walk = dir => fs.readdirSync(dir, {withFileTypes:true}).flatMap(e => e.isDirectory() ? walk(`${dir}/${e.name}`) : [`${dir}/${e.name}`]);
const files = walk('src');
const read = f => fs.readFileSync(f,'utf8').replaceAll('\r\n','\n');
function imports(file) {
  return [...read(file).matchAll(/(?:from\s*|import\s*)["']([^"']+)["']/g)].flatMap(([,s]) => {
    if (!s.startsWith('.') && !s.startsWith('@/')) return [];
    const p = s.startsWith('@/') ? `src/${s.slice(2)}` : path.posix.normalize(`${path.posix.dirname(file)}/${s}`);
    return [p, ...['.tsx','.ts','.css','/index.tsx','/index.ts'].map(x=>p+x)].filter(x=>files.includes(x));
  });
}
function graph(file, seen=new Set()) { if(seen.has(file)) return seen; seen.add(file); for(const f of imports(file)) graph(f,seen); return seen; }
const pages = files.filter(f=>/\/page\.(tsx|ts|jsx|js)$/.test(f)).sort().map(file=>{
  const route='/'+file.replace(/^src\/app\//,'').replace(/\/?page\.[^.]+$/,'').split('/').filter(s=>!/^\(.*\)$/.test(s)&&!s.startsWith('@')).join('/');
  const layouts=files.filter(f=>/\/layout\.tsx$/.test(f)&&file.startsWith(f.replace(/layout\.tsx$/,'')));
  const dependencies=[...new Set([file,...layouts].flatMap(f=>[...graph(f)]))].sort();
  const access=route==='/studio-fixture'?'development fixture':route.startsWith('/admin')?'admin':route==='/auth/verified'?'confirmation session':route==='/auth/update-password'?'recovery form; session needed to submit':/^\/(auth|privacy|terms|refunds|acceptable-use)(\/|$)/.test(route)||route==='/'?'public':'authenticated';
  return {route,file,access,redirect:[...read(file).matchAll(/redirect\("([^"]+)"\)/g)].map(x=>x[1]),components:dependencies.filter(f=>f.startsWith('src/components/')),styles:dependencies.filter(f=>f.endsWith('.css'))};
});
const handlers=files.filter(f=>/\/route\.[jt]s$/.test(f)).sort().map(file=>({route:'/'+file.replace(/^src\/app\//,'').replace(/\/route\.[jt]s$/,''),file,methods:[...read(file).matchAll(/export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)/g)].map(x=>x[1])}));
const styles=files.filter(f=>f.endsWith('.css')).map(file=>{const css=read(file); return {file,bytes:Buffer.byteLength(css),lines:css.split('\n').length,mediaQueries:(css.match(/@media/g)||[]).length,important:(css.match(/!important/g)||[]).length,viewportUnits:(css.match(/\b\d+(?:d|s|l)?vh/g)||[]).length};});
fs.mkdirSync('docs',{recursive:true});
const auxiliary=[{route:'/manifest.webmanifest',file:'src/app/manifest.ts',kind:'metadata'},{route:'/icon.png',file:'src/app/icon.png',kind:'metadata asset'},{route:'/_not-found',file:'Next.js generated default',kind:'framework fallback'},{route:'/_global-error',file:'Next.js generated default',kind:'framework error fallback'},{route:'(route error boundary)',file:'src/app/error.tsx',kind:'error UI; no independent URL'}];
fs.writeFileSync('docs/mobile-route-inventory.json',JSON.stringify({pages,handlers,auxiliary,styles},null,2)+'\n');
let md='# Generated route and dependency inventory\n\nRun `pnpm audit:routes` from the repository root. Counts are source routes, not authenticated browser passes. Root layout globals apply to every page.\n\n';
md+=`${pages.length} page routes; ${handlers.length} HTTP handlers; ${styles.length} CSS files. No Pages Router exists.\n\n`;
md+='| Route | Access | Source / redirect | Components (transitive) | Styles (transitive) |\n|---|---|---|---|---|\n';
for(const p of pages)md+=`| ${p.route} | ${p.access} | ${p.file}${p.redirect.length?' → '+p.redirect.join(', '):''} | ${p.components.map(f=>f.replace('src/components/','')).join(', ')} | ${p.styles.join(', ')} |\n`;
md+='\n## HTTP handlers — inventoried only; never bulk invoked\n\n| Route | Methods | Source |\n|---|---|---|\n';for(const h of handlers)md+=`| ${h.route} | ${h.methods.join(', ')} | ${h.file} |\n`;
md+='\n## Stylesheet measurements\n\n| File | Bytes | Lines | Media queries | Important declarations | Viewport units |\n|---|---:|---:|---:|---:|---:|\n';for(const s of styles)md+=`| ${s.file} | ${s.bytes} | ${s.lines} | ${s.mediaQueries} | ${s.important} | ${s.viewportUnits} |\n`;
md+='\n## Auxiliary routes and states\n\n| URL/state | Source | Kind |\n|---|---|---|\n';for(const a of auxiliary)md+=`| ${a.route} | ${a.file} | ${a.kind} |\n`;
md+='\nThe dependency graph resolves static local imports, includes ancestor layouts, and intentionally over-approximates shared files with multiple exports. Runtime data states, feature flags and query-string tabs need separate coverage. Inspect dynamic imports and future route conventions before extending this scanner.\n';
fs.writeFileSync('docs/mobile-route-inventory.md',md);
console.log(`${pages.length} pages, ${handlers.length} handlers, ${styles.length} stylesheets`);
