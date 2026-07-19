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
const verifyIdToken = jest.fn();
jest.mock('firebase-admin/auth', () => ({
  getAuth: jest.fn(() => ({
    verifyIdToken,
  })),
}));

import { app } from '../src/index';
import { db } from '../src/firebaseAdmin';

describe('Server', () => {
  it('should respond to health check', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});

describe('GET /api/documents', () => {
  it('returns ISO date strings and strips content/versions from the list', async () => {
    verifyIdToken.mockResolvedValue({ uid: 'user-1' });

    const firestoreTimestamp = {
      toDate: () => new Date('2026-07-18T12:00:00.000Z'),
      toMillis: () => Date.parse('2026-07-18T12:00:00.000Z'),
    };
    const snapshot = {
      docs: [
        {
          id: 'doc-1',
          data: () => ({
            title: 'My Doc',
            ownerId: 'user-1',
            updatedAt: firestoreTimestamp,
            content: 'bm90LXZhbGlkLXlqcw==',
            versions: [{ timestamp: '2026-07-18T12:00:00.000Z', data: '<p>big html</p>' }],
          }),
        },
      ],
    };
    (db.collection as jest.Mock).mockReturnValue({
      where: jest.fn().mockReturnValue({ get: jest.fn().mockResolvedValue(snapshot) }),
      get: jest.fn().mockResolvedValue(snapshot),
    });

    const res = await request(app)
      .get('/api/documents')
      .set('Authorization', 'Bearer fake-token');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    const doc = res.body[0];
    expect(doc._id).toBe('doc-1');
    expect(doc.title).toBe('My Doc');
    // Firestore Timestamp must be serialized to an ISO string the client can parse
    expect(doc.updatedAt).toBe('2026-07-18T12:00:00.000Z');
    // Heavy fields must not leak into the list payload
    expect(doc).not.toHaveProperty('content');
    expect(doc).not.toHaveProperty('versions');
  });
});
