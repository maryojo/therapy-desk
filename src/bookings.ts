import { randomUUID } from 'node:crypto';
import { ToolError } from './errors.js';
import type { SheetStore } from './sheets.js';

const headers = {
  Slots: ['Slot ID', 'Service ID', 'Start Time', 'End Time', 'Timezone'],
  Bookings: [
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
  ],
};
const services = {
  intro_consultation: {
    minutes: 20,
    amount: 500000,
    times: ['09:00', '09:30'],
  },
  individual_session: {
    minutes: 50,
    amount: 2000000,
    times: ['10:00', '11:00', '13:00', '14:00'],
  },
};
type BookingInput = {
  slot_id: string;
  request_id: string;
  client_name: string;
  client_email: string;
  adult_confirmed: true;
};
export class BookingService {
  constructor(
    private store: SheetStore,
    private clock = () => Date.now(),
  ) {}
  private async rows(tab: keyof typeof headers) {
    const rows = await this.store.read(tab);
    if (!headers[tab].every((h, i) => rows[0]?.[i] === h))
      throw new ToolError('INVALID_SHEET', `Check the ${tab} column headers.`);
    return rows.slice(1).filter((r) => r.some(Boolean));
  }
  private validSlot(row: string[], now: number) {
    const [id, service, start, end, timezone] = row;
    const spec = services[service as keyof typeof services];
    if (
      !id ||
      !/^[a-zA-Z0-9_-]{1,100}$/.test(id) ||
      !spec ||
      timezone !== 'Africa/Lagos'
    )
      return false;
    const timestamp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00(?:Z|[+-]\d{2}:\d{2})$/;
    if (!start || !end || !timestamp.test(start) || !timestamp.test(end))
      return false;
    const t = Date.parse(start),
      finish = Date.parse(end);
    if (!Number.isFinite(t) || finish - t !== spec.minutes * 60000)
      return false;
    const local = new Date(t + 3600000);
    return (
      [2, 3, 4].includes(local.getUTCDay()) &&
      spec.times.includes(local.toISOString().slice(11, 16)) &&
      t >= now + 86400000 &&
      t <= now + 14 * 86400000
    );
  }
  private result(row: string[]) {
    return {
      booking_id: row[0],
      slot_id: row[2],
      booking_status: row[5],
      amount: Number(row[6]),
      currency: row[7],
      created_at: row[10],
    };
  }
  private existing(rows: string[][], input: BookingInput) {
    const matches = rows.filter((r) => r[1] === input.request_id);
    if (matches.length > 1)
      throw new ToolError(
        'INVALID_SHEET',
        'Duplicate request IDs require owner review.',
      );
    const row = matches[0];
    if (!row) return;
    if (
      row[2] !== input.slot_id ||
      row[3] !== input.client_name ||
      row[4] !== input.client_email
    )
      throw new ToolError(
        'REQUEST_CONFLICT',
        'This request_id was already used with different booking details.',
      );
    return this.result(row);
  }
  async availability(input: { service_id: string; date: string }) {
    const [slots, bookings] = await Promise.all([
      this.rows('Slots'),
      this.rows('Bookings'),
    ]);
    const ids = new Set<string>();
    const starts = new Set<number>();
    for (const row of slots) {
      if (ids.has(row[0]!))
        throw new ToolError('INVALID_SHEET', 'Slot IDs must be unique.');
      ids.add(row[0]!);
      const start = Date.parse(row[2] ?? '');
      if (Number.isFinite(start)) {
        if (starts.has(start))
          throw new ToolError(
            'INVALID_SHEET',
            'Appointment start times must be unique.',
          );
        starts.add(start);
      }
    }
    const now = this.clock();
    return {
      service_id: input.service_id,
      date: input.date,
      timezone: 'Africa/Lagos',
      slots: slots
        .filter(
          (r) =>
            r[1] === input.service_id &&
            this.validSlot(r, now) &&
            new Date(Date.parse(r[2]!) + 3600000).toISOString().slice(0, 10) ===
              input.date &&
            !bookings.some((b) => b[2] === r[0]),
        )
        .map((r) => ({ slot_id: r[0], start_time: r[2], end_time: r[3] }))
        .sort((a, b) => Date.parse(a.start_time!) - Date.parse(b.start_time!)),
    };
  }
  async book(input: BookingInput) {
    const bookings = await this.rows('Bookings');
    const prior = this.existing(bookings, input);
    if (prior) return prior;
    const allSlots = await this.rows('Slots');
    const slots = allSlots.filter((r) => r[0] === input.slot_id);
    if (
      slots.length === 1 &&
      allSlots.some(
        (r) =>
          r[0] !== input.slot_id &&
          Date.parse(r[2] ?? '') === Date.parse(slots[0]![2]!),
      )
    ) {
      throw new ToolError(
        'INVALID_SHEET',
        'Appointment start times must be unique.',
      );
    }
    if (
      slots.length !== 1 ||
      !this.validSlot(slots[0]!, this.clock()) ||
      bookings.some((r) => r[2] === input.slot_id)
    )
      throw new ToolError(
        'SLOT_UNAVAILABLE',
        'This slot is unavailable. Check availability again.',
      );
    const spec = services[slots[0]![1] as keyof typeof services];
    const row = [
      'booking_' + randomUUID(),
      input.request_id,
      input.slot_id,
      input.client_name,
      input.client_email,
      'pending_payment',
      String(spec.amount),
      'NGN',
      '',
      '',
      new Date(this.clock()).toISOString(),
    ];
    try {
      await this.store.reserve(input.slot_id, input.request_id, row);
    } catch {
      // A lost response may follow a committed write. Always reconcile before reporting failure.
      const current = await this.rows('Bookings');
      const recovered = this.existing(current, input);
      if (recovered) return recovered;
      if (current.some((r) => r[2] === input.slot_id))
        throw new ToolError(
          'SLOT_UNAVAILABLE',
          'This slot has already been booked.',
        );
      throw new ToolError(
        'BOOKING_UNCONFIRMED',
        'Booking could not be confirmed. Retry with the same request_id; do not start another booking request.',
        true,
      );
    }
    return this.result(row);
  }
}
