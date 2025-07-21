const request = require('supertest');
const app = require('../server');

describe('Database Service Tests', () => {
  test('Health check should return healthy status', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('healthy');
    expect(response.body).toHaveProperty('postgres');
  });

  test('Should create a new user', async () => {
    const userData = {
      name: 'Test User',
      email: `test${Date.now()}@example.com`
    };

    const response = await request(app)
      .post('/users')
      .send(userData);

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('id');
    expect(response.body.name).toBe(userData.name);
    expect(response.body.email).toBe(userData.email);
  });

  test('Should get all users', async () => {
    const response = await request(app).get('/users');
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
  });
});
