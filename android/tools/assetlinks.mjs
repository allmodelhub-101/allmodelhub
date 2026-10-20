import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const release = JSON.parse(await fs.readFile(path.join(root,'android/release.json'),'utf8'));
const fingerprints = process.argv.slice(2).map(value => value.toUpperCase());
if (!fingerprints.length || fingerprints.some(value => !/^(?:[A-F0-9]{2}:){31}[A-F0-9]{2}$/.test(value))) throw new Error('Provide one or more SHA-256 certificate fingerprints (colon-separated). Include existing identities when adding Play App Signing.');
const destination = path.join(root,'public/.well-known/assetlinks.json');
let existing = [];
try {
  const statements = JSON.parse(await fs.readFile(destination,'utf8'));
  existing = statements.filter(item => item.target?.package_name === release.applicationId).flatMap(item => item.target.sha256_cert_fingerprints);
} catch (error) { if (error.code !== 'ENOENT') throw error; }
const statement = [{ relation: ['delegate_permission/common.handle_all_urls'], target: { namespace: 'android_app', package_name: release.applicationId, sha256_cert_fingerprints: [...new Set([...existing,...fingerprints])] } }];
await fs.mkdir(path.join(root,'public/.well-known'),{recursive:true});
await fs.writeFile(destination,JSON.stringify(statement,null,2)+'\n');
console.log('Public Digital Asset Links written. Deploy approval and canonical-domain verification still required.');
