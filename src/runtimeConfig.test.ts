import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert/strict';
import { buildShipNowRuntimeConfig } from './runtimeConfig.js';

describe('buildShipNowRuntimeConfig', () => {
  it('normalizes the shared gateway and static site bases', () => {
    const config = buildShipNowRuntimeConfig({
      publicBaseUrl: 'https://boringmax.com/',
      apiBaseUrl: 'https://api.boringmax.com/shipnow/api/',
      previewBaseUrl: 'https://api.boringmax.com/shipnow/preview/',
    });

    assert.equal(config.publicBaseUrl, 'https://boringmax.com');
    assert.equal(config.apiBaseUrl, 'https://api.boringmax.com/shipnow/api');
    assert.equal(config.previewBaseUrl, 'https://api.boringmax.com/shipnow/preview');
  });
});
