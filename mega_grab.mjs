import { File } from 'megajs';
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileP = promisify(execFile);

const url = 'https://mega.nz/folder/fEd0RCLT#Z2bEGVuHX-QouvXR8P0dCg';

// Output roots (parent of WEBSITE/, so videos stay outside Vercel deploy)
const PARENT = path.resolve('..', 'MEDIA');
const ORIG = path.join(PARENT, 'originals');
const THUMBS = path.join(PARENT, 'thumbs');
const SONGS = path.join(PARENT, 'songs');
for (const d of [ORIG, THUMBS, SONGS]) fs.mkdirSync(d, { recursive: true });

console.log('[mega] Loading folder...');
const root = File.fromURL(url);
await root.loadAttributes();

// Flatten all files
const allFiles = [];
function collect(node) {
    if (node.directory) {
        for (const c of node.children || []) collect(c);
    } else {
        allFiles.push(node);
    }
}
collect(root);

const videos = allFiles.filter(f => f.name.toLowerCase().endsWith('.mp4'));
const thumbs = allFiles.filter(f => f.name.toLowerCase().endsWith('.jpg'));

console.log(`[mega] ${videos.length} videos, ${thumbs.length} thumbnails`);

function fmtMB(b) { return (b / 1024 / 1024).toFixed(1) + ' MB'; }

async function downloadFile(node, destDir) {
    const dest = path.join(destDir, node.name);
    if (fs.existsSync(dest) && fs.statSync(dest).size === node.size) {
        return { dest, skipped: true };
    }
    await new Promise((resolve, reject) => {
        const stream = node.download();
        const out = fs.createWriteStream(dest);
        stream.pipe(out);
        out.on('finish', resolve);
        out.on('error', reject);
        stream.on('error', reject);
    });
    return { dest, skipped: false };
}

async function extractAudio(videoPath, destDir) {
    const base = path.basename(videoPath, path.extname(videoPath));
    const out = path.join(destDir, base + '.mp3');
    if (fs.existsSync(out)) return { out, skipped: true };
    await execFileP('ffmpeg', ['-y', '-loglevel', 'error', '-i', videoPath, '-vn', '-acodec', 'libmp3lame', '-q:a', '4', out]);
    return { out, skipped: false };
}

// 1. Thumbnails (small, fast)
console.log('\n[1/3] Downloading thumbnails...');
for (let i = 0; i < thumbs.length; i++) {
    const t = thumbs[i];
    process.stdout.write(`  [${i+1}/${thumbs.length}] ${t.name} `);
    try {
        const r = await downloadFile(t, THUMBS);
        console.log(r.skipped ? '(cached)' : 'OK');
    } catch (e) { console.log('FAIL: ' + e.message); }
}

// 2. Videos
console.log('\n[2/3] Downloading videos (large — this will take a while)...');
const totalMB = videos.reduce((a, v) => a + v.size, 0) / 1024 / 1024;
console.log(`  Total: ${totalMB.toFixed(0)} MB across ${videos.length} files\n`);
let done = 0;
for (let i = 0; i < videos.length; i++) {
    const v = videos[i];
    process.stdout.write(`  [${i+1}/${videos.length}] ${v.name} (${fmtMB(v.size)}) ... `);
    try {
        const r = await downloadFile(v, ORIG);
        done += v.size;
        console.log(r.skipped ? 'cached' : 'OK');
    } catch (e) { console.log('FAIL: ' + e.message); }
}

// 3. Extract MP3 audio
console.log('\n[3/3] Extracting MP3 audio with ffmpeg...');
for (let i = 0; i < videos.length; i++) {
    const v = videos[i];
    const vPath = path.join(ORIG, v.name);
    if (!fs.existsSync(vPath)) { console.log(`  [skip] ${v.name} (not downloaded)`); continue; }
    process.stdout.write(`  [${i+1}/${videos.length}] ${v.name} `);
    try {
        const r = await extractAudio(vPath, SONGS);
        console.log(r.skipped ? '(cached)' : '-> ' + path.basename(r.out));
    } catch (e) { console.log('FAIL: ' + e.message); }
}

console.log('\n[done] All operations complete.');
console.log(`  Videos:     ${ORIG}`);
console.log(`  Thumbnails: ${THUMBS}`);
console.log(`  Audio:      ${SONGS}`);
