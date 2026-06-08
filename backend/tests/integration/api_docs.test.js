const request = require('supertest');
const app = require('../../app');

describe('Swagger UI documentation', () => {
  test('serves Swagger UI at the course-compatible /api-docs route', async () => {
    const res = await request(app).get('/api-docs/');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.text).toContain('Swagger UI');
  });

  test('serves Swagger UI at the versioned documentation alias', async () => {
    const res = await request(app).get('/api/v1/docs/');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.text).toContain('Swagger UI');
  });
});
