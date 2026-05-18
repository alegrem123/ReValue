const request = require('supertest');

const app = require('../../app');

describe('Scambi legacy routes', () => {
  test('GET /api/v1/scambi/:prenotazioneId/qr risponde 410 con header Deprecation', async () => {
    const response = await request(app).get('/api/v1/scambi/64f000000000000000000001/qr');

    expect(response.statusCode).toBe(410);
    expect(response.headers.deprecation).toBe('true');
    expect(response.body).toEqual(
      expect.objectContaining({
        error: 'Endpoint legacy deprecato. Usa /api/v1/qr.',
      })
    );
  });

  test('POST /api/v1/scambi/:prenotazioneId/valida risponde 410 con header Deprecation', async () => {
    const response = await request(app)
      .post('/api/v1/scambi/64f000000000000000000001/valida')
      .send({ codice: 'legacy-code' });

    expect(response.statusCode).toBe(410);
    expect(response.headers.deprecation).toBe('true');
    expect(response.body).toEqual(
      expect.objectContaining({
        error: 'Endpoint legacy deprecato. Usa /api/v1/qr.',
      })
    );
  });
});
