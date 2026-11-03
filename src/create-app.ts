import { BookingService } from './bookings.js';
import { GoogleSheets } from './sheets.js';
import { PaymentService } from './payments.js';
import express from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { bearerAuth } from './auth.js';
import type { Config } from './config.js';
import { httpErrorHandler } from './errors.js';
import { createMcpServer } from './mcp.js';

export function createApp(config: Config, app = express()) {
  const store =
    config.GOOGLE_SHEETS_SPREADSHEET_ID &&
    (config.GOOGLE_APPLICATION_CREDENTIALS ||
      config.GOOGLE_SERVICE_ACCOUNT_JSON)
      ? new GoogleSheets(config)
      : undefined;
  const bookings = store ? new BookingService(store) : undefined;
  const payments =
    store && config.PAYSTACK_SECRET_KEY
      ? new PaymentService(store, config.PAYSTACK_SECRET_KEY)
      : undefined;
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    if (!config.ALLOWED_HOSTS.includes(req.hostname)) {
      res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'Host is not allowed.' },
      });
      return;
    }
    const origin = req.headers.origin;
    if (origin && !config.ALLOWED_ORIGINS.includes(origin)) {
      res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'Origin is not allowed.' },
      });
      return;
    }
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'therapydesk',
      integrations: payments
        ? 'sheets_and_paystack_configured'
        : bookings
          ? 'sheets_configured_paystack_pending'
          : 'not_configured',
    });
  });
  app.use('/mcp', bearerAuth(config.MCP_BEARER_TOKEN));
  app.post('/mcp', express.json({ limit: '32kb' }), async (req, res, next) => {
    const server = createMcpServer(bookings, payments);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    res.on('close', () => {
      void server.close().catch(() => {});
    });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      next(error);
    }
  });
  app.all('/mcp', (_req, res) => {
    res.setHeader('Allow', 'POST');
    res.status(405).json({
      jsonrpc: '2.0',
      id: null,
      error: {
        code: -32000,
        message: 'Method not allowed. This stateless endpoint supports POST.',
      },
    });
  });
  app.use((_req, res) => {
    res
      .status(404)
      .json({ error: { code: 'NOT_FOUND', message: 'Route not found.' } });
  });
  app.use(httpErrorHandler);
  return app;
}
