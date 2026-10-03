import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Writable } from 'node:stream';
import { finished } from 'node:stream/promises';
import { createRequestHandler, createLocalServer } from '../scripts/server.mjs';

// Direct handler verification: no TCP socket or real browser is involved.
const fixture = await mkdtemp(path.join(tmpdir(), 'python-fieldnotes-server-'));
const root = path.join(fixture, 'app');
for (const name of ['src', 'public', '.git', 'docs', 'node_modules/pyodide']) await mkdir(path.join(root, name), { recursive: true });
const files = {
  'index.html': '<!doctype html><title>Practice</title>',
  'src/app.js': 'export const app = true;',
  'src/style.css': 'body { color: black; }',
  'public/checker.py': 'result = 1',
  'public/python-worker.js': 'self.onmessage = () => {};',
  'package.json': '{"private":true}',
  '.git/config': 'private git metadata',
  'docs/private.json': '{"private":true}',
  'node_modules/pyodide/pyodide.mjs': 'export const loadPyodide = true;',
  'node_modules/pyodide/pyodide.asm.mjs': 'export default {};',
  'node_modules/pyodide/pyodide.asm.wasm': 'wasm fixture',
  'node_modules/pyodide/python_stdlib.zip': 'stdlib fixture',
  'node_modules/pyodide/pyodide-lock.json': '{}',
  'node_modules/pyodide/package.json': '{"private":true}',
};
for (const [filename, body] of Object.entries(files)) await writeFile(path.join(root, filename), body);
await writeFile(path.join(fixture, 'outside.js'), 'private outside file');
await symlink(path.join(fixture, 'outside.js'), path.join(root, 'public/escape.js'));
after(() => rm(fixture, { recursive: true, force: true }));

class Response extends Writable {
  constructor() { super(); this.chunks = []; }
  writeHead(status, headers) { this.status = status; this.headers = headers; return this; }
  _write(chunk, encoding, callback) { this.chunks.push(Buffer.from(chunk)); callback(); }
  get body() { return Buffer.concat(this.chunks).toString('utf8'); }
}

async function request(url, { method = 'GET', host = 'localhost:4173', handler = createRequestHandler({ root }) } = {}) {
  const response = new Response();
  const completion = finished(response);
  await handler({ url, method, headers: { host } }, response);
  await completion;
  return response;
}

test('server import and factory construction never bind a port', () => {
  const server = createLocalServer({ root });
  assert.equal(server.listening, false);
  assert.equal(server.address(), null);
  assert.throws(() => createLocalServer({ root, port: 0 }), /PORT/);
  assert.throws(() => createLocalServer({ root, port: 65536 }), /PORT/);
});

test('GET and HEAD serve only public app assets with appropriate MIME types', async () => {
  for (const [url, filename, type] of [
    ['/', 'index.html', 'text/html'],
    ['/index.html', 'index.html', 'text/html'],
    ['/src/app.js?v=1', 'src/app.js', 'text/javascript'],
    ['/src/style.css', 'src/style.css', 'text/css'],
    ['/public/checker.py', 'public/checker.py', 'text/plain'],
    ['/public/python-worker.js', 'public/python-worker.js', 'text/javascript'],
  ]) {
    const get = await request(url);
    assert.equal(get.status, 200, url);
    assert.equal(get.body, files[filename]);
    assert.equal(get.headers['Content-Type'].startsWith(type), true);
    const head = await request(url, { method: 'HEAD' });
    assert.equal(head.status, 200, url);
    assert.equal(head.body, '');
  }
});

test('only the five required runtime filenames are exposed', async () => {
  for (const filename of ['pyodide.mjs', 'pyodide.asm.mjs', 'pyodide.asm.wasm', 'python_stdlib.zip', 'pyodide-lock.json']) {
    const response = await request(`/runtime/${filename}`);
    assert.equal(response.status, 200, filename);
    assert.equal(response.body, files[`node_modules/pyodide/${filename}`]);
  }
  assert.equal((await request('/runtime/pyodide.asm.wasm')).headers['Content-Type'], 'application/wasm');
  for (const url of ['/runtime/package.json', '/runtime/', '/node_modules/pyodide/pyodide.mjs']) assert.equal((await request(url)).status, 404, url);
});

test('unrelated project files, metadata, machine paths and directory listings are refused', async () => {
  for (const url of ['/package.json', '/.git/config', '/docs/private.json', '/etc/passwd', '/home/cpans/.aws/credentials', '/src/', '/public/']) {
    const response = await request(url);
    assert.equal(response.status, 404, url);
    assert.doesNotMatch(response.body, /private git|private outside|credentials/);
  }
});

test('raw and encoded traversal, backslashes, nul bytes and symlink escapes are refused', async () => {
  for (const url of [
    '/public/../package.json', '/public/%2e%2e/package.json', '/public/%2e%2e%2fpackage.json',
    '/public/%252e%252e/package.json', '/public/%5c..%5cpackage.json', '/public/checker.py%00',
    '/public/.hidden.js', '/public/escape.js',
  ]) assert.equal((await request(url)).status, 404, url);
  assert.equal((await request('/public/%zz')).status, 400);
});

test('unexpected hosts and write methods are refused', async () => {
  for (const host of ['example.com:4173', 'localhost:9999', 'localhost.evil.example:4173', '127.0.0.1:4173@evil.example']) {
    assert.equal((await request('/', { host })).status, 403, host);
  }
  assert.equal((await request('/', { host: '127.0.0.1:4173' })).status, 200);
  for (const method of ['POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']) {
    const response = await request('/', { method });
    assert.equal(response.status, 405, method);
    assert.equal(response.headers.Allow, 'GET, HEAD');
  }
});

test('CSP permits local WebAssembly and blocks external connections on all responses', async () => {
  for (const url of ['/', '/public/python-worker.js', '/missing']) {
    const response = await request(url);
    const directives = Object.fromEntries(response.headers['Content-Security-Policy'].split(';').map(text => {
      const [name, ...values] = text.trim().split(/\s+/);
      return [name, values];
    }));
    assert.deepEqual(directives['connect-src'], ["'self'"]);
    assert.deepEqual(directives['script-src'], ["'self'", "'wasm-unsafe-eval'"]);
    assert.deepEqual(directives['worker-src'], ["'self'"]);
    assert.deepEqual(directives['frame-ancestors'], ["'none'"]);
    assert.equal(response.headers['X-Content-Type-Options'], 'nosniff');
    assert.equal(response.headers['Cross-Origin-Resource-Policy'], 'same-origin');
  }
});

test('missing runtime returns an actionable 404 without disclosing machine paths', async () => {
  const missingRoot = path.join(fixture, 'no-runtime-installed');
  await mkdir(missingRoot);
  const handler = createRequestHandler({ root: missingRoot });
  const response = await request('/runtime/pyodide.mjs', { handler });
  assert.equal(response.status, 404);
  assert.match(response.body, /npm install/);
  assert.doesNotMatch(response.body, /ENOENT|\/tmp\/|\/home\//);
  const head = await request('/runtime/pyodide.mjs', { handler, method: 'HEAD' });
  assert.equal(head.status, 404);
  assert.equal(head.body, '');
});
