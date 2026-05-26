import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;

describe('frontend smoke', () => {
  it('include le viste principali del flusso web', () => {
    [
      'views/login.html',
      'views/register.html',
      'views/catalog.html',
      'views/annuncio.html',
      'views/mybookings.html',
      'views/qr-display.html',
      'views/qr-scan.html',
      'views/chat.html',
      'views/public-profile.html',
    ].forEach((file) => {
      assert.equal(existsSync(join(root, file)), true, file);
    });
  });

  it('il client normalizza le risposte API standard', () => {
    const source = readFileSync(join(root, 'js/apiClient.js'), 'utf8');
    assert.match(source, /Object\.prototype\.hasOwnProperty\.call\(data, 'ok'\)/);
    assert.match(source, /normalized\?\.message/);
  });
});
