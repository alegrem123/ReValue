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
      'views/notifiche.html',
      'views/chat.html',
      'views/messaggi.html',
      'views/premi.html',
      'views/my-premi.html',
      'views/profile.html',
      'views/public-profile.html',
      'views/swap-success.html',
      'views/admin/login.html',
      'views/admin/dashboard.html',
      'js/layout.js',
      'js/catalog.js',
      'js/annuncio.js',
      'js/mybookings.js',
      'js/qr-display.js',
      'js/qr-scan.js',
      'js/notifiche.js',
      'js/chat.js',
      'js/premi.js',
      'js/admin/login.js',
      'js/admin/shared.js',
      'js/admin/stats.js',
      'js/admin/users.js',
      'js/admin/annunci.js',
      'js/admin/segnalazioni.js',
      'js/admin/coupon.js',
    ].forEach((file) => {
      assert.equal(existsSync(join(root, file)), true, file);
    });
  });

  it('le viste principali caricano gli script funzionali attesi', () => {
    const expectedScripts = {
      'views/catalog.html': ['js/catalog.js'],
      'views/annuncio.html': ['js/annuncio.js'],
      'views/mybookings.html': ['js/mybookings.js'],
      'views/qr-display.html': ['js/qr-display.js'],
      'views/qr-scan.html': ['js/qr-scan.js'],
      'views/notifiche.html': ['js/notifiche.js'],
      'views/chat.html': ['js/chat.js'],
      'views/messaggi.html': ['js/messaggi.js'],
      'views/premi.html': ['js/premi.js'],
      'views/my-premi.html': ['js/myPremi.js'],
      'views/profile.html': ['js/layout.js'],
      'views/swap-success.html': ['js/swap-success.js'],
    };

    for (const [view, scripts] of Object.entries(expectedScripts)) {
      const html = readFileSync(join(root, view), 'utf8');
      for (const script of scripts) {
        assert.match(html, new RegExp(script.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `${view} -> ${script}`);
      }
    }
  });

  it('il client normalizza le risposte API standard', () => {
    const source = readFileSync(join(root, 'js/apiClient.js'), 'utf8');
    assert.match(source, /API_PREFIX = '\/api\/v1'/);
    assert.match(source, /function normalizeEndpoint\(endpoint\)/);
    assert.match(source, /endpoint\.startsWith\('\/api\/'\)/);
    assert.match(source, /Object\.prototype\.hasOwnProperty\.call\(data, 'ok'\)/);
    assert.match(source, /normalized\?\.message/);
    assert.match(source, /window\.api = api/);
    assert.match(source, /window\.apiRequest = request/);
  });

  it('la dashboard admin usa token separato ed endpoint v1', () => {
    const shared = readFileSync(join(root, 'js/admin/shared.js'), 'utf8');
    const login = readFileSync(join(root, 'js/admin/login.js'), 'utf8');
    const stats = readFileSync(join(root, 'js/admin/stats.js'), 'utf8');
    const users = readFileSync(join(root, 'js/admin/users.js'), 'utf8');
    const annunci = readFileSync(join(root, 'js/admin/annunci.js'), 'utf8');
    const segnalazioni = readFileSync(join(root, 'js/admin/segnalazioni.js'), 'utf8');
    const coupon = readFileSync(join(root, 'js/admin/coupon.js'), 'utf8');
    const dashboard = readFileSync(join(root, 'views/admin/dashboard.html'), 'utf8');

    assert.match(shared, /adminToken/);
    assert.match(login, /\/api\/v1\/auth\/login/);
    assert.match(stats, /\/admin\/statistiche/);
    assert.match(users, /\/admin\/users/);
    assert.match(annunci, /\/admin\/annunci/);
    assert.match(segnalazioni, /\/admin\/segnalazioni/);
    assert.match(coupon, /\/admin\/coupon/);
    assert.match(dashboard, /js\/admin\/annunci\.js/);
    assert.match(dashboard, /js\/admin\/segnalazioni\.js/);
    assert.match(dashboard, /js\/admin\/coupon\.js/);
    assert.match(dashboard, /coupon-panel/);
  });

  it('le prenotazioni web espongono il flusso QR', () => {
    const mybookings = readFileSync(join(root, 'js/mybookings.js'), 'utf8');

    assert.match(mybookings, /qr-display\.html\?prenotazione=/);
    assert.match(mybookings, /qr-scan\.html/);
    assert.match(mybookings, /bi-qr-code/);
    assert.match(mybookings, /bi-qr-code-scan/);
  });

  it('la mappa catalogo usa pin custom e popup dettagliati', () => {
    const map = readFileSync(join(root, 'js/map.js'), 'utf8');
    const css = readFileSync(join(root, 'css/style.css'), 'utf8');
    const picker = readFileSync(join(root, 'js/locationPicker.js'), 'utf8');
    const create = readFileSync(join(root, 'js/createAnnuncio.js'), 'utf8');
    const createView = readFileSync(join(root, 'views/create-annuncio.html'), 'utf8');

    assert.match(map, /createMarkerIcon/);
    assert.match(map, /catalog-pin-active/);
    assert.match(map, /map-popup-card/);
    assert.match(map, /openPopup/);
    assert.match(map, /invalidateSize/);
    assert.match(map, /requestAnimationFrame/);
    assert.match(css, /\.catalog-pin/);
    assert.match(css, /\.catalog-map-popup/);
    assert.match(css, /\.leaflet-popup/);
    assert.match(css, /background: #fff !important/);
    assert.match(css, /\.map-popup-card\s*\{[\s\S]*background: #fff/);
    assert.match(css, /max-width: none !important/);
    assert.match(css, /\.location-map/);
    assert.match(picker, /updateInputs\(fallbackPosition\[0\], fallbackPosition\[1\]\)/);
    assert.match(picker, /nominatim\.openstreetmap\.org\/search/);
    assert.match(picker, /nominatim\.openstreetmap\.org\/reverse/);
    assert.match(picker, /location-picker-pin/);
    assert.match(create, /indirizzo:/);
    assert.match(create, /latitudineComune/);
    assert.match(createView, /categorie-list/);
    assert.match(createView, /materiali-list/);
    assert.match(createView, /regioni-list/);
    assert.match(createView, /province-list/);
    assert.match(createView, /comuni-list/);
    assert.match(createView, /annuncio-comune/);
    assert.match(createView, /annuncio-via/);
    assert.doesNotMatch(createView, /type="number"[^>]+name="latitudine"/);
  });

  it('il QR web mostra canvas, immagine QR di fallback e codice testuale', () => {
    const qrDisplay = readFileSync(join(root, 'js/qr-display.js'), 'utf8');
    const qrView = readFileSync(join(root, 'views/qr-display.html'), 'utf8');

    assert.match(qrDisplay, /qrCodeText/);
    assert.match(qrDisplay, /qrFallbackImg/);
    assert.match(qrDisplay, /api\.qrserver\.com/);
    assert.match(qrDisplay, /ensureQrLibrary/);
    assert.match(qrDisplay, /unpkg\.com\/qrcode/);
    assert.match(qrDisplay, /Libreria QR non caricata/);
    assert.match(qrView, /qr-fallback-img/);
    assert.match(qrView, /qr-code-text/);
  });
});
