import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { getVaultArtistData, isPackedVault, packVault, sanitizeVaultSettings, unpackVault } from '../src/Application/services/vaultCodec.js';

const sampleUrl = new URL('../public/PlanetMusic_Backup.json', import.meta.url);

test('sample vault round-trips exactly and packs smaller', async () => {
  const sourceText = await readFile(sampleUrl, 'utf8');
  const source = unpackVault(JSON.parse(sourceText));
  const packedText = JSON.stringify(packVault(source));
  const restored = unpackVault(JSON.parse(packedText));

  assert.deepStrictEqual(restored.library, source.library);
  assert.deepStrictEqual(restored.settings, source.settings);
  assert.ok(Buffer.byteLength(packedText) < Buffer.byteLength(JSON.stringify({
    library: source.library,
    settings: source.settings
  })));
});

test('preserves omitted defaults, split segments, adlibs, and pronunciation', () => {
  const source = {
    library: [
      {
        trackId: 1,
        artistName: 'One',
        artistColors: { One: '#123456' },
        lyrics: 'Keep this text exactly!',
        syncData: [
          { text: 'plain', singer: 'One', color: '#123456', isGradient: false, gradient: '', isSplit: false,
            segments: [{ text: 'plain', color: '#123456', isGradient: false, gradient: '', artists: ['One'] }] },
          { text: 'split', singer: 'One & Two', isGradient: true, gradient: 'linear-gradient(red, blue)',
            segments: [{ text: 'left', color: '#123456', artists: ['One'] }, { text: 'right', color: '#abcdef', artists: ['Two'] }],
            pronunciation: '{"full":"spoken","chunks":[{"type":"en","text":"spoken","trans":"spoken"}]}' },
          { text: 'missing defaults', start: null, adlibs: [{ text: '(echo)', singer: 'One', segments: [{ text: '(echo)', color: '#123456', isGradient: false, gradient: '', artists: ['One'] }] }] }
        ],
        autoSyncData: [
          { text: 'plain', singer: 'One', color: '#123456', isGradient: false, gradient: '', isSplit: false,
            segments: [{ text: 'plain', color: '#123456', isGradient: false, gradient: '', artists: ['One'] }] },
          { text: 'split', singer: 'One & Two', isGradient: true, gradient: 'linear-gradient(red, blue)',
            segments: [{ text: 'left', color: '#123456', artists: ['One'] }, { text: 'right', color: '#abcdef', artists: ['Two'] }],
            pronunciation: '{"full":"spoken","chunks":[{"type":"en","text":"spoken","trans":"spoken"}]}' },
          { text: 'missing defaults', start: null, adlibs: [{ text: '(echo)', singer: 'One', segments: [{ text: '(echo)', color: '#123456', isGradient: false, gradient: '', artists: ['One'] }] }] }
        ]
      }
    ],
    settings: { translationColor: '#ffffff' }
  };

  const restored = unpackVault(JSON.parse(JSON.stringify(packVault(source))));
  assert.deepStrictEqual(restored.library, source.library);
});

test('continues to read legacy arrays and object backups', () => {
  const songs = [{ trackId: 1, lyrics: 'legacy' }];
  assert.deepStrictEqual(unpackVault(songs), { library: songs, settings: undefined });
  assert.deepStrictEqual(unpackVault({ library: songs, settings: { adsEnabled: false } }), {
    library: songs,
    settings: { adsEnabled: false }
  });
  assert.equal(isPackedVault(packVault({ library: songs })), true);
});

test('removes obsolete client credentials from vault settings', () => {
  const settings = {
    spotifyConfig: { clientId: 'public-id', clientSecret: 'private-secret' },
    spotifyClientId: 'legacy-id',
    spotifyClientSecret: 'legacy-secret',
    youtubeApiKey: 'legacy-key',
    deezerArl: 'remembered-arl',
    adsEnabled: false
  };

  assert.deepStrictEqual(sanitizeVaultSettings(settings), {
    deezerArl: 'remembered-arl',
    adsEnabled: false
  });
});

test('reads artist metadata without unpacking packed song lyrics', () => {
  const songs = [
    { trackId: 1, artistColors: { Artist: '#abcdef' }, artistImages: { Artist: '/artist.jpg' }, syncData: [{ text: 'lyrics' }] }
  ];
  const packed = packVault({ library: songs });

  assert.deepStrictEqual(getVaultArtistData(packed), [{
    artistColors: { Artist: '#abcdef' },
    artistImages: { Artist: '/artist.jpg' }
  }]);
  assert.deepStrictEqual(getVaultArtistData({ library: songs }), [{
    artistColors: { Artist: '#abcdef' },
    artistImages: { Artist: '/artist.jpg' }
  }]);
});

test('preserves null and empty sync fields and reserved source keys', () => {
  const source = {
    library: [
      { trackId: 1, syncData: null, autoSyncData: null },
      { trackId: 2, syncData: [], autoSyncData: [] },
      { trackId: 3, syncData: [{ text: 'reserved', _i: 7 }], autoSyncData: [{ text: 'reserved', _i: 7 }] }
    ]
  };

  const restored = unpackVault(JSON.parse(JSON.stringify(packVault(source))));
  assert.deepStrictEqual(restored.library, source.library);
});