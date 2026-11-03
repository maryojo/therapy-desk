import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import type { Server } from 'node:http';
import { request } from 'node:http';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { toolFailure } from '../src/errors.js';

const token = 'a'.repeat(64);
let http: Server;
let base: string;
before(async () => {
  http = createApp(
    loadConfig({ MCP_BEARER_TOKEN: token, NODE_ENV: 'test' }),
  ).listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => http.once('listening', resolve));
  const address = http.address();
  assert.ok(address && typeof address !== 'string');
  base = `http://127.0.0.1:${address.port}`;
});
after(async () => {
  http.closeAllConnections();
  await new Promise<void>((resolve, reject) =>
    http.close((error) => (error ? reject(error) : resolve())),
  );
});

const headers = {
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
  Accept: 'application/json, text/event-stream',
};

test('configuration rejects missing, placeholder and invalid values without leaking secrets', () => {
  for (const env of [
    {},
    { MCP_BEARER_TOKEN: 'replace-with-at-least-32-random-characters' },
    { MCP_BEARER_TOKEN: token, PORT: 'invalid' },
  ]) {
    assert.throws(() => loadConfig(env), /Invalid environment configuration/);
  }
  const secret = 'secret '.repeat(8);
  try {
    loadConfig({ MCP_BEARER_TOKEN: secret });
    assert.fail();
  } catch (error) {
    assert.ok(error instanceof Error);
    assert.ok(!error.message.includes(secret));
  }
});

test('health is public but explicitly reports unconfigured integrations', async () => {
  const response = await fetch(`${base}/health`);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).integrations, 'not_configured');
});

test('MCP requires correct bearer auth before parsing the request body', async () => {
  for (const authorization of [
    '',
    'Basic abc',
    `Bearer ${'b'.repeat(64)}`,
    `Bearer ${token} extra`,
  ]) {
    const response = await fetch(`${base}/mcp`, {
      method: 'POST',
      headers: {
        Authorization: authorization,
        'Content-Type': 'application/json',
      },
      body: '{',
    });
    assert.equal(response.status, 401);
    assert.match(response.headers.get('www-authenticate') ?? '', /Bearer/);
  }
});

test('rejects unapproved hosts and browser origins', async () => {
  assert.equal(
    (
      await fetch(`${base}/mcp`, {
        method: 'POST',
        headers: { ...headers, Origin: 'https://attacker.example' },
        body: '{}',
      })
    ).status,
    403,
  );
  const status = await new Promise<number | undefined>((resolve, reject) => {
    const req = request(
      `${base}/health`,
      { headers: { Host: 'attacker.example' } },
      (res) => {
        res.resume();
        resolve(res.statusCode);
      },
    );
    req.on('error', reject);
    req.end();
  });
  assert.equal(status, 403);
});

test('handles malformed JSON, body limits and unsupported methods', async () => {
  assert.equal(
    (await fetch(`${base}/mcp`, { method: 'POST', headers, body: '{' })).status,
    400,
  );
  assert.equal(
    (
      await fetch(`${base}/mcp`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ text: 'x'.repeat(40_000) }),
      })
    ).status,
    413,
  );
  for (const method of ['GET', 'DELETE']) {
    const response = await fetch(`${base}/mcp`, { method, headers });
    assert.equal(response.status, 405);
    assert.equal(response.headers.get('allow'), 'POST');
  }
});

test('real MCP client initializes, discovers tools and receives honest tool failures', async () => {
  const client = new Client({ name: 'test-client', version: '1.0.0' });
  try {
    await client.connect(
      new StreamableHTTPClientTransport(new URL(`${base}/mcp`), {
        requestInit: { headers: { Authorization: `Bearer ${token}` } },
      }),
    );
    const { tools } = await client.listTools();
    assert.deepEqual(tools.map((tool) => tool.name).sort(), [
      'check_availability',
      'create_booking',
      'create_payment_link',
    ]);
    for (const [name, args] of [
      [
        'check_availability',
        { service_id: 'intro_consultation', date: '2026-11-03' },
      ],
      [
        'create_booking',
        {
          slot_id: 'slot_1',
          client_name: 'Demo Client',
          client_email: 'demo@example.com',
          adult_confirmed: true,
          request_id: 'b26b9c2b-e1c1-4382-b030-e94c1e5833ea',
        },
      ],
      ['create_payment_link', { booking_id: 'booking_1' }],
    ] as const) {
      const result = await client.callTool({ name, arguments: args });
      assert.equal(result.isError, true);
      assert.match(
        JSON.stringify(result.content),
        /INTEGRATION_NOT_CONFIGURED/,
      );
    }
    for (const args of [
      { service_id: 'unknown', date: '2026-11-03' },
      { service_id: 'intro_consultation', date: '2026-02-30' },
      { service_id: 'intro_consultation', date: 'tomorrow' },
    ]) {
      const result = await client.callTool({
        name: 'check_availability',
        arguments: args,
      });
      assert.equal(result.isError, true);
      assert.doesNotMatch(
        JSON.stringify(result.content),
        /INTEGRATION_NOT_CONFIGURED/,
      );
    }
    const invalidBooking = await client.callTool({
      name: 'create_booking',
      arguments: {
        slot_id: 'slot_1',
        client_name: 'Demo',
        client_email: 'invalid',
        adult_confirmed: false,
        request_id: 'not-a-uuid',
      },
    });
    assert.equal(invalidBooking.isError, true);
    assert.doesNotMatch(
      JSON.stringify(invalidBooking.content),
      /INTEGRATION_NOT_CONFIGURED/,
    );
  } finally {
    await client.close();
  }
});

test('unexpected tool errors hide internal messages', () => {
  assert.doesNotMatch(
    JSON.stringify(toolFailure(new Error('private credential details'))),
    /private credential/,
  );
});
