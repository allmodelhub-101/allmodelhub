import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {localResponsiveFixtureAllowed} from '@/lib/responsive-fixture-access';

// Same strict gates as the synthetic page. Never a public production media URL.
export async function GET(request:Request){
 if(!localResponsiveFixtureAllowed({mode:process.env.NODE_ENV,flag:process.env.LOCAL_RESPONSIVE_FIXTURES,vercel:process.env.VERCEL,host:request.headers.get('host')||''}))return new Response(null,{status:404});
 const bytes=await readFile(path.join(process.cwd(),'tests/fixtures/studio-tone.wav'));
 return new Response(new Uint8Array(bytes),{headers:{'Content-Type':'audio/wav','Cache-Control':'no-store'}});
}
