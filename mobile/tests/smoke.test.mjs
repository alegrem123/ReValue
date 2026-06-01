import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;

describe('mobile smoke', () => {
  it('include le schermate principali del flusso mobile', () => {
    [
      'src/screens/AuthScreen.js',
      'src/screens/CatalogScreen.js',
      'src/screens/AnnuncioDetailScreen.js',
      'src/screens/MyBookingsScreen.js',
      'src/screens/QRDisplayScreen.js',
      'src/screens/QRScanScreen.js',
      'src/screens/ChatScreen.js',
      'src/screens/ProfileScreen.js',
    ].forEach((file) => {
      assert.equal(existsSync(join(root, file)), true, file);
    });
  });

  it('il client mobile normalizza le risposte API standard', () => {
    const source = readFileSync(join(root, 'src/api/client.js'), 'utf8');
    assert.match(source, /API_PREFIX = '\/api\/v1'/);
    assert.match(source, /Object\.prototype\.hasOwnProperty\.call\(data, 'ok'\)/);
    assert.match(source, /normalized\?\.message/);
  });
});
