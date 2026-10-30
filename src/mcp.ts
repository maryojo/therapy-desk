import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ToolError, toolFailure } from './errors.js';
import {
  availabilitySchema,
  bookingSchema,
  paymentSchema,
} from './tools/schemas.js';

// Scaffold only: never return fabricated availability, bookings, or payment links.
async function unavailable() {
  return toolFailure(
    new ToolError(
      'INTEGRATION_NOT_CONFIGURED',
      'This integration is not implemented yet. No external action was performed.',
    ),
  );
}

export function createMcpServer() {
  const server = new McpServer({ name: 'therapydesk', version: '0.1.0' });
  server.registerTool(
    'check_availability',
    {
      description:
        'Check dated appointment slots in Africa/Lagos. Currently unavailable: Google Sheets integration is not implemented.',
      inputSchema: availabilitySchema,
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    unavailable,
  );
  server.registerTool(
    'create_booking',
    {
      description:
        'Reserve a selected slot after client confirmation. Use fictional client data only. Reuse request_id on retries. Currently unavailable: booking integration is not implemented.',
      inputSchema: bookingSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: true,
      },
    },
    unavailable,
  );
  server.registerTool(
    'create_payment_link',
    {
      description:
        'Create a Paystack test payment link for an existing booking using its configured fee. Does not verify payment. Currently unavailable: Paystack integration is not implemented.',
      inputSchema: paymentSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: true,
      },
    },
    unavailable,
  );
  return server;
}
