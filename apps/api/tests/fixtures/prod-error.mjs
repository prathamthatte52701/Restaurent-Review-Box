// Spawned with NODE_ENV=production: a throwing route must not leak a stack.
import supertest from 'supertest';
const { createApp } = await import('../../src/app.js');
const app = createApp((a) => a.get('/boom', () => { throw new Error('secret internal detail'); }));
const res = await supertest(app).get('/boom');
console.log(JSON.stringify({ status: res.status, body: res.body }));
process.exit(0);
