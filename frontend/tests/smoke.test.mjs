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
      'views/admin/login.html',
      'views/admin/dashboard.html',
      'js/admin/login.js',
      'js/admin/shared.js',
      'js/admin/stats.js',
      'js/admin/users.js',
      'js/admin/annunci.js',
      'js/admin/segnalazioni.js',
    ].forEach((file) => {
      assert.equal(existsSync(join(root, file)), true, file);
    });
  });

  it('il client normalizza le risposte API standard', () => {
    const source = readFileSync(join(root, 'js/apiClient.js'), 'utf8');
    assert.match(source, /API_PREFIX = '\/api\/v1'/);
    assert.match(source, /Object\.prototype\.hasOwnProperty\.call\(data, 'ok'\)/);
    assert.match(source, /normalized\?\.message/);
  });

  it('la dashboard admin usa token separato ed endpoint v1', () => {
    const shared = readFileSync(join(root, 'js/admin/shared.js'), 'utf8');
    const login = readFileSync(join(root, 'js/admin/login.js'), 'utf8');
    const stats = readFileSync(join(root, 'js/admin/stats.js'), 'utf8');
    const users = readFileSync(join(root, 'js/admin/users.js'), 'utf8');
    const annunci = readFileSync(join(root, 'js/admin/annunci.js'), 'utf8');
    const segnalazioni = readFileSync(join(root, 'js/admin/segnalazioni.js'), 'utf8');
    const dashboard = readFileSync(join(root, 'views/admin/dashboard.html'), 'utf8');

    assert.match(shared, /adminToken/);
    assert.match(login, /\/api\/v1\/auth\/login/);
    assert.match(stats, /\/admin\/statistiche/);
    assert.match(users, /\/admin\/users/);
    assert.match(annunci, /\/admin\/annunci/);
    assert.match(segnalazioni, /\/admin\/segnalazioni/);
    assert.match(dashboard, /js\/admin\/annunci\.js/);
    assert.match(dashboard, /js\/admin\/segnalazioni\.js/);
  });
});
