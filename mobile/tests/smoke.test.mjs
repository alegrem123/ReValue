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
      'src/screens/ChatListScreen.js',
      'src/screens/ChatScreen.js',
      'src/screens/CreateAnnuncioScreen.js',
      'src/screens/MyAnnunciScreen.js',
      'src/screens/NotificheScreen.js',
      'src/screens/PremiScreen.js',
      'src/screens/ProfileScreen.js',
      'src/screens/SwapSuccessScreen.js',
      'src/services/pushRegistration.js',
    ].forEach((file) => {
      assert.equal(existsSync(join(root, file)), true, file);
    });
  });

  it('App.js registra tab e modali principali', () => {
    const source = readFileSync(join(root, 'App.js'), 'utf8');
    [
      'AuthScreen',
      'CatalogScreen',
      'AnnuncioDetailScreen',
      'CreateAnnuncioScreen',
      'MyAnnunciScreen',
      'MyBookingsScreen',
      'QRDisplayScreen',
      'QRScanScreen',
      'SwapSuccessScreen',
      'ChatListScreen',
      'ChatScreen',
      'NotificheScreen',
      'PremiScreen',
      'ProfileScreen',
    ].forEach((screen) => assert.match(source, new RegExp(screen), screen));

    ['catalog', 'create', 'bookings', 'chat', 'profile'].forEach((tab) => {
      assert.match(source, new RegExp(`key: '${tab}'`), tab);
    });
    ['mine', 'premi'].forEach((removedTab) => {
      assert.doesNotMatch(source, new RegExp(`key: '${removedTab}'`), removedTab);
    });

    ['annuncioDetail', 'qrDisplay', 'qrScan', 'swapSuccess', 'notifiche', 'myAnnunci', 'premi', 'chat'].forEach((modal) => {
      assert.match(source, new RegExp(`modal\\?\\.name === '${modal}'`), modal);
    });
  });

  it('il client mobile normalizza le risposte API standard', () => {
    const source = readFileSync(join(root, 'src/api/client.js'), 'utf8');
    assert.match(source, /process\.env\.EXPO_PUBLIC_API_BASE_URL/);
    assert.match(source, /API_PREFIX = '\/api\/v1'/);
    assert.match(source, /function normalizeEndpoint\(endpoint\)/);
    assert.match(source, /endpoint\.startsWith\('\/api\/'\)/);
    assert.match(source, /Object\.prototype\.hasOwnProperty\.call\(data, 'ok'\)/);
    assert.match(source, /normalized\?\.message/);
  });

  it('registra il push token Expo dopo login o registrazione senza bloccare auth', () => {
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
    assert.match(pkg.dependencies['expo-notifications'], /^~0\.32\./);

    const service = readFileSync(join(root, 'src/services/pushRegistration.js'), 'utf8');
    assert.match(service, /expo-notifications/);
    assert.match(service, /requestPermissionsAsync/);
    assert.match(service, /getExpoPushTokenAsync/);
    assert.match(service, /api\.patch\('\/api\/v1\/users\/me\/push-token', \{ expoPushToken \}\)/);
    assert.match(service, /catch\s*\{/);

    const auth = readFileSync(join(root, 'src/screens/AuthScreen.js'), 'utf8');
    assert.match(auth, /registerForPushNotificationsAsync/);
    assert.match(auth, /await setToken\(response\.data\.token\);[\s\S]*await setStoredUser\(response\.data\.user\);[\s\S]*void registerForPushNotificationsAsync\(\);[\s\S]*onAuthenticated\(response\.data\.user\);/);
  });

  it('la schermata QR mobile mostra anche il codice testuale', () => {
    const qrDisplay = readFileSync(join(root, 'src/screens/QRDisplayScreen.js'), 'utf8');

    assert.match(qrDisplay, /react-native-qrcode-svg/);
    assert.match(qrDisplay, /payload\?\.codice/);
    assert.match(qrDisplay, /Codice QR/);
    assert.match(qrDisplay, /selectable/);
  });

  it('il QR mobile mostra i crediti acquirente quando il backend restituisce donatore e acquirente', () => {
    const qrScan = readFileSync(join(root, 'src/screens/QRScanScreen.js'), 'utf8');
    const success = readFileSync(join(root, 'src/screens/SwapSuccessScreen.js'), 'utf8');

    assert.match(qrScan, /function normalizeCreditiAccreditati\(value\)/);
    assert.match(qrScan, /value\.acquirente/);
    assert.match(success, /function formatCreditiAccreditati\(value\)/);
    assert.match(success, /value\.acquirente/);
  });

  it('la creazione annuncio mobile usa menu a tendina e indirizzo geocodificato', () => {
    const create = readFileSync(join(root, 'src/screens/CreateAnnuncioScreen.js'), 'utf8');

    assert.match(create, /CATEGORIE/);
    assert.match(create, /MATERIALI/);
    assert.match(create, /DIMENSIONI/);
    assert.match(create, /PAESI/);
    assert.match(create, /REGIONI/);
    assert.match(create, /PROVINCE/);
    assert.match(create, /COMUNI/);
    assert.match(create, /DropdownField/);
    assert.match(create, /DateTimePicker/);
    assert.match(create, /DateField/);
    assert.match(create, /Seleziona categoria/);
    assert.match(create, /Seleziona materiale/);
    assert.match(create, /Seleziona scadenza/);
    assert.match(create, /reverseGeocodeAsync/);
    assert.match(create, /geocodeAsync/);
    assert.match(create, /indirizzo:/);
    assert.match(create, /paese/);
    assert.match(create, /regione/);
    assert.match(create, /provincia/);
    assert.match(create, /comune/);
    assert.match(create, /via/);
    assert.doesNotMatch(create, /label="Latitudine"/);
    assert.doesNotMatch(create, /label="Longitudine"/);
  });

  it('il catalogo mobile espone filtri rapidi coerenti con il web', () => {
    const catalog = readFileSync(join(root, 'src/screens/CatalogScreen.js'), 'utf8');

    assert.match(catalog, /CATEGORIE/);
    assert.match(catalog, /Cerca categoria/);
    assert.match(catalog, /Pulisci/);
    assert.match(catalog, /loadAnnunci\(item\)/);
  });

  it('il catalogo mobile include la vista mappa annunci', () => {
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
    const catalog = readFileSync(join(root, 'src/screens/CatalogScreen.js'), 'utf8');
    const card = readFileSync(join(root, 'src/components/AnnuncioCard.js'), 'utf8');

    assert.match(pkg.dependencies['react-native-maps'], /\d/);
    assert.match(catalog, /MapView/);
    assert.match(catalog, /Marker/);
    assert.match(catalog, /Callout/);
    assert.match(catalog, /viewMode/);
    assert.match(catalog, /Le posizioni sono approssimate/);
    assert.match(catalog, /calculateEstimatedCredits/);
    assert.match(card, /export function calculateEstimatedCredits/);
    assert.match(card, /MAX_CREDIT_WINDOW_MS/);
    assert.match(card, /creditsPill/);
  });

  it('il dettaglio annuncio mobile non mostra coordinate pubbliche esatte', () => {
    const detail = readFileSync(join(root, 'src/screens/AnnuncioDetailScreen.js'), 'utf8');

    assert.match(detail, /formatPublicLocation/);
    assert.match(detail, /Indirizzo esatto visibile dopo la prenotazione/);
    assert.doesNotMatch(detail, /toFixed\(4\)/);
  });
});
