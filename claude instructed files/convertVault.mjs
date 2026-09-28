#!/usr/bin/env node
/* Usage:  node convertVault.mjs <input.json> [output.json]
 *   Converts a PlanetMusic backup/sample vault to the compact v2 format, MINIFIED.
 *   It refuses to write the file unless unpacking the result gives back exactly the original songs.
 *   Already-converted files are left alone. Original files are never overwritten unless
 *   you pass the same path as input and output (keep a copy!). */
import fs from 'fs';
import assert from 'assert';
import zlib from 'zlib';
import { packVault, unpackVault, isPackedVault } from '../src/Application/services/vaultCodec.js';

const [inPath, outPathArg] = process.argv.slice(2);
if (!inPath) { console.error('usage: node convertVault.mjs <input.json> [output.json]'); process.exit(1); }
const outPath = outPathArg || inPath.replace(/\.json$/i, '') + '.v2.json';

const rawText = fs.readFileSync(inPath, 'utf8');
const data = JSON.parse(rawText);
if (isPackedVault(data)) { console.log('Already v2 - nothing to do:', inPath); process.exit(0); }

const original = unpackVault(data);                       // { library, settings } in original shape
const packed = packVault(original);
const packedText = JSON.stringify(packed);                // minified on purpose

// --- verification: what the app will see after loading must equal the original, song by song ---
const reloaded = unpackVault(JSON.parse(packedText));
assert.strictEqual(reloaded.library.length, original.library.length, 'song count changed');
original.library.forEach((song, i) => {
  assert.deepStrictEqual(reloaded.library[i], JSON.parse(JSON.stringify(song)), `song #${i} (${song.trackName}) differs after round-trip`);
});
assert.deepStrictEqual(reloaded.settings, original.settings, 'settings changed');

fs.writeFileSync(outPath, packedText);
const kb = (n) => (n / 1024).toFixed(0) + ' KB';
console.log(`OK  ${original.library.length} songs verified identical after round-trip`);
console.log(`    input   ${kb(rawText.length)}  (gzip ${kb(zlib.gzipSync(rawText).length)})`);
console.log(`    output  ${kb(packedText.length)}  (gzip ${kb(zlib.gzipSync(packedText).length)})  -> ${outPath}`);
