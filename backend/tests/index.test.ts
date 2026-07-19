// backend/tests/index.test.ts
import request from 'supertest';

// Mock the entire firebaseAdmin module to prevent side-effects
// (reading serviceAccountKey.json, process.exit) from running in CI
jest.mock('../src/firebaseAdmin', () => ({
  db: {
    collection: jest.fn(),
  },
}));

// Mock firebase-admin/auth to avoid ESM (jose) issues
jest.mock('firebase-admin/auth', () => ({
  getAuth: jest.fn(() => ({
    verifyIdToken: jest.fn(),
  })),
}));

import { app } from '../src/index';

describe('Server', () => {
  it('should respond to health check', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});
