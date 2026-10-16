import fs from 'node:fs';
import path from 'node:path';
const source=process.argv[2]||'test-results/baseline/results.json';
const label=process.argv[3]||'browser';
const report=JSON.parse(fs.readFileSync(source,'utf8'));
const cases=[];
function visit(suites){for(const suite of suites||[]){for(const spec of suite.specs||[])for(const test of spec.tests||[]){
  const result=test.results.at(-1);
  cases.push({title:spec.title,project:test.projectName,status:result?.status,expectedStatus:test.expectedStatus,
    annotations:test.annotations,errors:result?.errors?.map(e=>e.message),attachments:result?.attachments});
}visit(suite.suites);}}
visit(report.suites);
const summary={source,label,stats:report.stats,counts:cases.reduce((a,c)=>(a[c.status]=(a[c.status]||0)+1,a),{}),cases};
fs.mkdirSync('docs/mobile-baseline',{recursive:true});
const selected=new Set(['chromium-390x844','webkit-390x844','chromium-768x1024','chromium-1366x768']);
fs.mkdirSync('docs/mobile-baseline/screenshots',{recursive:true});
fs.mkdirSync('docs/mobile-baseline/geometry',{recursive:true});
for(const c of cases){
  if(process.argv.includes('--no-curate'))continue;
  if(!selected.has(c.project)||!c.title.includes('loads, controls'))continue;
  const slug=c.title.split(' ')[0].replaceAll('/','-').replace(/^-$/,'home').replace(/^-/,'');
  for(const a of c.attachments||[]){
    const folder=a.name==='responsive-viewport'?'screenshots':a.name==='geometry-and-controls'?'geometry':null;
    if(!folder)continue;
    const extension=folder==='screenshots'?'.png':'.json';
    const destination=path.join('docs/mobile-baseline',folder,`${c.project}-${slug}${extension}`);
    if(a.path&&fs.existsSync(a.path))fs.copyFileSync(a.path,destination);
    else if(a.body)fs.writeFileSync(destination,Buffer.from(a.body,'base64'));
  }
}
for(const c of cases)c.attachments=c.attachments?.map(({name,contentType,path:attachmentPath})=>({name,contentType,path:attachmentPath?path.relative(process.cwd(),attachmentPath).split(path.sep).join('/'):undefined}));
fs.writeFileSync(`docs/mobile-baseline/${label}-summary.json`,JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify({label,stats:summary.stats,counts:summary.counts,failures:cases.filter(c=>c.status==='failed'||c.status==='timedOut').map(c=>({title:c.title,project:c.project,errors:c.errors}))},null,2));
