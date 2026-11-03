import { createHash } from 'node:crypto';
import { ToolError } from './errors.js';
import type { SheetStore } from './sheets.js';

const paymentError = () =>
  new ToolError(
    'PAYMENT_UNCONFIRMED',
    'Payment link could not be confirmed. Retry with the same booking_id. If this persists, ask the owner to reconcile this booking in Paystack; do not create another booking or reference.',
    true,
  );

export class PaymentService {
  constructor(
    private store: SheetStore,
    private secret: string,
    private request: typeof fetch = fetch,
  ) {}

  private async booking(id: string) {
    const rows = await this.store.read('Bookings');
    const expected = [
      'Booking ID',
      'Request ID',
      'Slot ID',
      'Client Name',
      'Client Email',
      'Booking Status',
      'Amount',
      'Currency',
      'Payment Reference',
      'Payment URL',
      'Created At',
    ];
    if (!expected.every((value, i) => rows[0]?.[i] === value))
      throw new ToolError(
        'INVALID_SHEET',
        'Check the Bookings column headers.',
      );
    const matches = rows
      .map((row, index) => ({ row, rowNumber: index + 1 }))
      .slice(1)
      .filter(({ row }) => row[0] === id);
    if (!matches.length)
      throw new ToolError(
        'BOOKING_NOT_FOUND',
        'No booking exists with this booking_id.',
      );
    if (matches.length !== 1)
      throw new ToolError(
        'INVALID_SHEET',
        'Duplicate booking IDs require owner review.',
      );
    return matches[0]!;
  }

  async create(input: { booking_id: string }) {
    const { row, rowNumber } = await this.booking(input.booking_id);
    if (row[5] !== 'pending_payment')
      throw new ToolError(
        'BOOKING_NOT_PAYABLE',
        'This booking is not pending payment. Ask the owner for assistance.',
      );
    const amount = Number(row[6]);
    if (
      ![500000, 2000000].includes(amount) ||
      row[7] !== 'NGN' ||
      !row[4] ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row[4])
    ) {
      throw new ToolError(
        'INVALID_SHEET',
        'The booking fee, currency or email requires owner review.',
      );
    }
    const reference =
      'therapydesk-' +
      createHash('sha256').update(input.booking_id).digest('hex');
    const validUrl = (value: unknown): value is string => {
      if (typeof value !== 'string') return false;
      try {
        const url = new URL(value);
        return (
          url.origin === 'https://checkout.paystack.com' &&
          !url.username &&
          !url.password &&
          url.pathname.length > 1
        );
      } catch {
        return false;
      }
    };
    const result = (url: string) => ({
      booking_id: input.booking_id,
      payment_reference: reference,
      payment_url: url,
      amount,
      currency: 'NGN',
      booking_status: 'pending_payment',
      test_mode: true,
    });
    if (row[8] || row[9]) {
      if (row[8] !== reference || !validUrl(row[9]))
        throw new ToolError(
          'PAYMENT_REVIEW_REQUIRED',
          'Stored payment details require owner review. No new transaction was created.',
        );
      return result(row[9]);
    }
    try {
      const response = await this.request(
        'https://api.paystack.co/transaction/initialize',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.secret}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: row[4],
            amount: String(amount),
            currency: 'NGN',
            reference,
          }),
          signal: AbortSignal.timeout(15000),
        },
      );
      const payload = await response.json();
      if (
        !response.ok ||
        payload.status !== true ||
        payload.data?.reference !== reference ||
        !validUrl(payload.data?.authorization_url)
      )
        throw paymentError();
      await this.store.savePayment(
        rowNumber,
        reference,
        payload.data.authorization_url,
      );
      return result(payload.data.authorization_url);
    } catch {
      // Reconcile a lost Sheets response or a concurrent request before reporting failure.
      try {
        const current = (await this.booking(input.booking_id)).row;
        if (current[8] === reference && validUrl(current[9]))
          return result(current[9]);
      } catch {
        /* Do not expose provider errors or credentials. */
      }
      throw paymentError();
    }
  }
}
