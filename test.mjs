import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import test from 'node:test';

async function startBridge() {
    const child = spawn(process.execPath, ['server.mjs'], {
        cwd: new URL('.', import.meta.url),
        env: { ...process.env, ST_GOOGLE_AI_MODE_PORT: '0', ST_GOOGLE_AI_MODE_TOKEN: 'test-token' },
        stdio: ['ignore', 'pipe', 'inherit'],
    });
    let output = '';
    child.stdout.on('data', chunk => { output += chunk; });
    const deadline = Date.now() + 15_000;
    while (!output.includes('http://127.0.0.1:')) {
        if (Date.now() > deadline) throw new Error(`Bridge did not start: ${output}`);
        await new Promise(resolve => setTimeout(resolve, 50));
    }
    return { child, base: output.match(/http:\/\/127\.0\.0\.1:\d+/)[0] };
}

test('discovers and calls real MCP tools with auth and CORS', { timeout: 30_000 }, async () => {
    const { child, base } = await startBridge();
    try {
        const preflight = await fetch(`${base}/tools`, {
            method: 'OPTIONS',
            headers: { origin: 'https://sillytavern.example', 'access-control-request-headers': 'x-api-token,content-type' },
        });
        assert.equal(preflight.status, 204);
        assert.equal(preflight.headers.get('access-control-allow-origin'), '*');
        assert.equal((await fetch(`${base}/tools`)).status, 401);

        const headers = { 'x-api-token': 'test-token', 'content-type': 'application/json' };
        const { tools } = await fetch(`${base}/tools`, { headers }).then(response => response.json());
        assert.equal(tools.length, 11);
        assert.ok(tools.every(tool => tool.name && tool.inputSchema));

        const result = await fetch(`${base}/call`, {
            method: 'POST', headers, body: JSON.stringify({ name: 'google_ai_mode_status', arguments: {} }),
        }).then(response => response.json());
        assert.notEqual(result.isError, true, JSON.stringify(result));
        assert.equal(result.structuredContent.backend.running, true);
    } finally {
        child.kill('SIGTERM');
        await once(child, 'exit');
    }
});
