// Only run after the owner approves publication to public HTTPS hosting.
// Downloads the exact immutable asset and compares with the local signed release.
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const android = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const releasePath = path.join(android,'release.json');
const release = JSON.parse(await fs.readFile(releasePath,'utf8'));
const [url] = process.argv.slice(2);
const expectedPath = `/allmodelhub-101/allmodelhub/releases/download/android-v${release.versionName}/models-suite-${release.versionName}.apk`;
const parsed = new URL(url);
if (parsed.origin !== 'https://github.com' || parsed.pathname !== expectedPath || parsed.search || parsed.hash) throw new Error('Expected the versioned GitHub release APK URL for this version. Never use latest/download or an untrusted mirror.');
const report = JSON.parse(await fs.readFile(path.join(android,`artifacts/${release.versionName}/release-artifacts.json`),'utf8'));
const expected = report.artifacts.find(item => item.file.endsWith('.apk'));
if (report.applicationId !== release.applicationId || report.version !== release.versionName || !expected) throw new Error('Build metadata mismatch');
const response = await fetch(url, { signal: AbortSignal.timeout(120000) });
if (!response.ok) throw new Error(`APK is not publicly available: ${response.status}`);
const bytes = Buffer.from(await response.arrayBuffer());
const sha256 = createHash('sha256').update(bytes).digest('hex');
if (bytes.length !== expected.bytes || sha256 !== expected.sha256 || bytes.readUInt32LE(0) !== 0x04034b50) throw new Error('Hosted APK differs from verified signed build');
release.distribution = { published: true, apkUrl: url, sha256, bytes: bytes.length };
await fs.writeFile(releasePath,JSON.stringify(release,null,2)+'\n');
console.log('Verified public APK recorded. Review and deploy this website metadata change before exposing the download CTA.');
