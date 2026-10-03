import http from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { realpath, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.py': 'text/plain; charset=utf-8', '.json': 'application/json', '.wasm': 'application/wasm', '.zip': 'application/zip', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };
const runtimeFiles = new Set(['pyodide.mjs', 'pyodide.asm.mjs', 'pyodide.asm.wasm', 'python_stdlib.zip', 'pyodide-lock.json']);
const headers = {
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self'; connect-src 'self'; worker-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

async function safeFile(root, relative) {
  const filename = path.resolve(root, relative);
  if (!filename.startsWith(`${root}${path.sep}`)) return null;
  // Do not serve symlink targets or siblings through a path that merely looks safe.
  const actual = await realpath(filename);
  if (actual !== filename) return null;
  return (await stat(actual)).isFile() ? actual : null;
}

export function createRequestHandler({ root = projectRoot, port = 4173 } = {}) {
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be a number from 1 to 65535.');
  root = path.resolve(root);
  return async function handleRequest(request, response) {
    const reply = (status, body) => {
      response.writeHead(status, { ...headers, 'Content-Type': 'text/plain; charset=utf-8', ...(status === 405 ? { Allow: 'GET, HEAD' } : {}) });
      response.end(request.method === 'HEAD' ? undefined : body);
    };
    if (!['GET', 'HEAD'].includes(request.method)) return reply(405, 'This local app serves files only.');
    if (![ `127.0.0.1:${port}`, `localhost:${port}` ].includes(request.headers.host)) return reply(403, 'Use the local address printed by npm start.');
    try {
      const rawPath = (request.url || '/').split('?')[0];
      const pathname = decodeURIComponent(rawPath);
      if (pathname.includes('\\') || pathname.includes('\0') || pathname.split('/').some(part => part === '..' || part.startsWith('.'))) return reply(404, 'Not found.');
      let relative;
      if (pathname === '/' || pathname === '/index.html') relative = 'index.html';
      else if (pathname.startsWith('/runtime/') && runtimeFiles.has(pathname.slice(9))) relative = `node_modules/pyodide/${pathname.slice(9)}`;
      else if (/^\/(src|public)\/[a-zA-Z0-9_./-]+$/.test(pathname) && types[path.extname(pathname)]) relative = pathname.slice(1);
      else return reply(404, 'Not found.');
      const filename = await safeFile(root, relative);
      if (!filename) return reply(404, 'Not found.');
      response.writeHead(200, {
        ...headers,
        'Content-Type': types[path.extname(filename)] || 'application/octet-stream',
        'Cache-Control': pathname.startsWith('/runtime/') ? 'public, max-age=3600' : 'no-cache',
      });
      if (request.method === 'HEAD') return response.end();
      const stream = createReadStream(filename);
      stream.on('error', () => response.destroy());
      stream.pipe(response);
    } catch (error) {
      reply(error instanceof URIError ? 400 : 404, 'File not available. Run npm install if runtime files are missing.');
    }
  };
}

export function createLocalServer(options) {
  return http.createServer(createRequestHandler(options));
}

// Importing the handler for verification never binds a socket or adds signals.
// Resolve argv so both `node scripts/server.mjs` and absolute paths work.
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const port = Number(process.env.PORT || 4173);
  const server = createLocalServer({ port });
  server.on('error', error => {
    console.error(error.code === 'EADDRINUSE' ? `Port ${port} is already in use. Stop the other app or use PORT=4174 npm start.` : error.message);
    process.exitCode = 1;
  });
  server.listen(port, '127.0.0.1', () => console.log(`Python Fieldnotes is ready at http://localhost:${port}\nKeep this terminal open. Stop with Ctrl+C.`));
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
}
