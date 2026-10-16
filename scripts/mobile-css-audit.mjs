import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const postcss=require('postcss');
const inventory=JSON.parse(fs.readFileSync('docs/mobile-route-inventory.json','utf8'));
const output=[];
for(const {file} of inventory.styles){
  const root=postcss.parse(fs.readFileSync(file,'utf8').replaceAll('\r\n','\n'),{from:file});
  const groups=new Map(),dimensions=[],smallTargets=[],queries=[];
  root.walkAtRules(rule=>{if(['media','container'].includes(rule.name))queries.push({type:rule.name,condition:rule.params,line:rule.source.start.line});});
  root.walkRules(rule=>{
    const conditions=[];for(let p=rule.parent;p&&p!==root;p=p.parent)if(p.type==='atrule')conditions.unshift(`@${p.name} ${p.params}`);
    const declarations=Object.fromEntries((rule.nodes||[]).filter(n=>n.type==='decl').map(n=>[n.prop,n.value+(n.important?' !important':'')]));
    const key=conditions.join(' / ')+' | '+rule.selector;
    const entry={selector:rule.selector,conditions,line:rule.source.start.line,declarations};
    if(!groups.has(key))groups.set(key,[]);groups.get(key).push(entry);
    for(const [property,value] of Object.entries(declarations)){
      if(/^(width|min-width|height|min-height|grid-template-columns|overflow-x|position|z-index)$/.test(property)&&(/\d{3,}px|\d+(d|s)?vh|fixed|hidden|clip/.test(value)))dimensions.push({selector:rule.selector,conditions,line:rule.source.start.line,property,value});
      if(/(button|trigger|action|input|select)/i.test(rule.selector)&&/^(width|height|min-height)$/.test(property)&&/^\d+px$/.test(value)&&parseInt(value)<44)smallTargets.push({selector:rule.selector,conditions,line:rule.source.start.line,property,value});
    }
  });
  const repeated=[...groups.values()].filter(g=>g.length>1).map(rules=>({selector:rules[0].selector,conditions:rules[0].conditions,rules}));
  output.push({file,repeated,dimensions,smallTargets,queries});
}
fs.writeFileSync('docs/mobile-css-evidence.json',JSON.stringify(output,null,2)+'\n');
let md='# Generated CSS cascade evidence\n\nRun `pnpm audit:css`. PostCSS parses every stylesheet. Repetition and dimensions are review candidates, not proven browser defects. Conditions and line numbers preserve context; later specificity and import order still require computed-style verification.\n\n';
for(const {file,repeated,dimensions,smallTargets,queries} of output){
  md+=`## ${file}\n\n${queries.length} media/container conditions; ${repeated.length} repeated exact selector + condition groups; ${dimensions.length} dimension/overflow candidates; ${smallTargets.length} small-control declarations.\n\n`;
  md+='| Repeated selector | Condition | Lines |\n|---|---|---|\n';
  for(const r of repeated.slice(0,30))md+=`| ${r.selector.replaceAll('|','\\|')} | ${r.conditions.join('; ')||'base'} | ${r.rules.map(x=>x.line).join(', ')} |\n`;
  md+='\nFull candidates and declarations are in `mobile-css-evidence.json`; this table shows at most 30 groups per stylesheet.\n\n';
}
fs.writeFileSync('docs/mobile-css-evidence.md',md.trimEnd()+'\n');
console.log(output.map(s=>`${path.basename(s.file)}: ${s.repeated.length} repeated groups, ${s.smallTargets.length} small-control declarations`).join('\n'));
