import { BookingService } from './bookings.js';
import type { PaymentService } from './payments.js';
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

export function createMcpServer(
  bookings?: BookingService,
  payments?: PaymentService,
) {
  const run = async (operation: () => Promise<unknown>) => {
    try {
      return {
        content: [
          { type: 'text' as const, text: JSON.stringify(await operation()) },
        ],
      };
    } catch (error) {
      return toolFailure(error);
    }
  };
  const server = new McpServer({ name: 'therapydesk', version: '0.1.0' });
  server.registerTool(
    'check_availability',
    {
      description: 'Check dated appointment slots in Africa/Lagos.',
      inputSchema: availabilitySchema,
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    bookings ? (input) => run(() => bookings.availability(input)) : unavailable,
  );
  server.registerTool(
    'create_booking',
    {
      description:
        'Reserve a selected slot after client confirmation. Use fictional client data only. Reuse request_id on retries.',
      inputSchema: bookingSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: true,
      },
    },
    bookings ? (input) => run(() => bookings.book(input)) : unavailable,
  );
  server.registerTool(
    'create_payment_link',
    {
      description:
        'Create or reuse a Paystack test checkout link for a pending booking using its stored fee. Retry with the same booking_id. A link does not confirm payment.',
      inputSchema: paymentSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: true,
      },
    },
    payments ? (input) => run(() => payments.create(input)) : unavailable,
  );
  return server;
}
