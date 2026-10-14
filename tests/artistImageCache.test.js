import assert from 'node:assert/strict';
import test from 'node:test';

test('reuses image preloads and evicts entries beyond the bounded cache', async () => {
  const previousImage = globalThis.Image;
  const instances = [];
  globalThis.Image = class {
    constructor() {
      this.complete = false;
      this.naturalWidth = 100;
      instances.push(this);
    }

    decode() {
      this.complete = true;
      return Promise.resolve();
    }
  };

  try {
    const { preloadArtistImage } = await import(
      '../src/Application/utils/artistImageCache.js?artist-image-cache-test'
    );
    await preloadArtistImage('artist-a.jpg');
    await preloadArtistImage('artist-a.jpg');
    assert.equal(instances.length, 1);

    await Promise.all(Array.from({ length: 48 }, (_, index) =>
      preloadArtistImage(`artist-${index}.jpg`)
    ));
    await preloadArtistImage('artist-a.jpg');
    assert.equal(instances.length, 50);
  } finally {
    if (previousImage === undefined) delete globalThis.Image;
    else globalThis.Image = previousImage;
  }
});
