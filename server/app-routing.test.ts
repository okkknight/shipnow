import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert/strict';
import { createShipNowApp } from './app.js';

describe('ShipNow app routing', () => {
  it('keeps the backend api-only when the ui shell is disabled', async () => {
    const app = await createShipNowApp({
      serveUiShell: false,
      publicBaseUrl: 'https://boringmax.com',
      apiBaseUrl: 'https://api.boringmax.com/shipnow/api',
      previewBaseUrl: 'https://api.boringmax.com/shipnow/preview',
    });

    try {
      const res = await app.inject({ method: 'GET', url: '/' });
      assert.equal(res.statusCode, 404);
    } finally {
      await app.close();
    }
  });
});
