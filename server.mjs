import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const root = path.dirname(fileURLToPath(import.meta.url));
const mcpPath = path.resolve(process.env.GOOGLE_AI_MODE_MCP || path.join(root, '../Google-AI-MCP/server/mcp.mjs'));
const tokenFile = process.env.GOOGLE_AI_MODE_TOKEN_FILE || path.join(root, '../Google-AI-MCP/.run/bridge-token');
const token = process.env.ST_GOOGLE_AI_MODE_TOKEN || process.env.GOOGLE_AI_MODE_API_TOKEN || fs.readFileSync(tokenFile, 'utf8').trim();
const host = process.env.ST_GOOGLE_AI_MODE_HOST || '127.0.0.1';
const port = Number(process.env.ST_GOOGLE_AI_MODE_PORT || 32152);
const timeout = Number(process.env.ST_GOOGLE_AI_MODE_TIMEOUT_MS || 900_000);
const corsOrigin = process.env.ST_GOOGLE_AI_MODE_CORS_ORIGIN || '*';

const client = new Client({ name: 'sillytavern-google-ai-mode', version: '1.0.0' }, { capabilities: {} });
await client.connect(new StdioClientTransport({
    command: process.execPath,
    args: [mcpPath],
    cwd: path.dirname(mcpPath),
    env: { ...process.env, GOOGLE_AI_MODE_MANAGE_SERVICE: '0' },
    stderr: 'inherit',
}));

function send(response, status, payload) {
    const body = payload === null ? '' : JSON.stringify(payload);
    response.writeHead(status, {
        'access-control-allow-origin': corsOrigin,
        'access-control-allow-headers': 'content-type, x-api-token',
        'access-control-allow-methods': 'GET, POST, OPTIONS',
        'access-control-max-age': '86400',
        'cache-control': 'no-store',
        ...(payload === null ? {} : { 'content-type': 'application/json; charset=utf-8' }),
    });
    response.end(body);
}

async function readJson(request) {
    const chunks = [];
    let size = 0;
    for await (const chunk of request) {
        size += chunk.length;
        if (size > 140 * 1024 * 1024) throw Object.assign(new Error('Request body exceeds 140 MiB'), { status: 413 });
        chunks.push(chunk);
    }
    try {
        return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
    } catch {
        throw Object.assign(new Error('Invalid JSON'), { status: 400 });
    }
}

const server = http.createServer(async (request, response) => {
    try {
        const pathname = new URL(request.url || '/', 'http://localhost').pathname;
        if (request.method === 'OPTIONS') return send(response, 204, null);
        if (request.method === 'GET' && pathname === '/health') {
            return send(response, 200, { ok: true, service: 'sillytavern-google-ai-mode-bridge' });
        }
        if (request.headers['x-api-token'] !== token) return send(response, 401, { error: 'Invalid API token' });
        if (request.method === 'GET' && pathname === '/tools') {
            return send(response, 200, await client.listTools());
        }
        if (request.method === 'POST' && pathname === '/call') {
            const input = await readJson(request);
            if (typeof input.name !== 'string' || !input.name || typeof input.arguments !== 'object' || input.arguments === null || Array.isArray(input.arguments)) {
                return send(response, 400, { error: 'Expected name and an arguments object' });
            }
            const result = await client.callTool({ name: input.name, arguments: input.arguments }, undefined, { timeout });
            return send(response, 200, result);
        }
        return send(response, 404, { error: 'Not found' });
    } catch (error) {
        if (!response.headersSent) send(response, error.status || 500, { error: error.message || String(error) });
        else response.destroy();
    }
});

// Argon can take ten minutes; Node's default five-minute request timeout is too short.
server.requestTimeout = 0;
server.timeout = 0;
server.listen(port, host, () => console.log(`SillyTavern MCP bridge: http://${host}:${server.address().port}`));

async function shutdown() {
    server.close();
    await client.close();
    process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
