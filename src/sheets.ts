import { readFileSync } from 'node:fs';
import { createSign, createHash } from 'node:crypto';
import { ToolError } from './errors.js';
import type { Config } from './config.js';

export interface SheetStore {
  read(tab: 'Slots' | 'Bookings'): Promise<string[][]>;
  reserve(slotId: string, requestId: string, row: string[]): Promise<void>;
  savePayment(rowNumber: number, reference: string, url: string): Promise<void>;
}
export const markerId = (value: string) =>
  createHash('sha256').update(value).digest().readUInt32BE(0) & 0x7fffffff;

export class GoogleSheets implements SheetStore {
  private token?: { value: string; expires: number };
  constructor(private config: Config) {}
  private async accessToken() {
    if (this.token && this.token.expires > Date.now()) return this.token.value;
    const credentials = this.config.GOOGLE_SERVICE_ACCOUNT_JSON
      ? JSON.parse(this.config.GOOGLE_SERVICE_ACCOUNT_JSON)
      : JSON.parse(
          readFileSync(this.config.GOOGLE_APPLICATION_CREDENTIALS!, 'utf8'),
        );
    if (credentials.type !== 'service_account')
      throw new Error('Invalid credentials');
    const encode = (value: unknown) =>
      Buffer.from(JSON.stringify(value)).toString('base64url');
    const now = Math.floor(Date.now() / 1000);
    const body =
      encode({ alg: 'RS256', typ: 'JWT' }) +
      '.' +
      encode({
        iss: credentials.client_email,
        scope: 'https://www.googleapis.com/auth/spreadsheets',
        aud: 'https://oauth2.googleapis.com/token',
        iat: now,
        exp: now + 3600,
      });
    const assertion =
      body +
      '.' +
      createSign('RSA-SHA256')
        .update(body)
        .sign(credentials.private_key, 'base64url');
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
      }),
      signal: AbortSignal.timeout(15000),
    });
    const data = await response.json();
    if (!response.ok || !data.access_token)
      throw new Error('Authentication failed');
    this.token = { value: data.access_token, expires: Date.now() + 3300000 };
    return this.token.value;
  }
  private async request(path: string, body?: unknown) {
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${this.config.GOOGLE_SHEETS_SPREADSHEET_ID}${path}`,
      {
        method: body ? 'POST' : 'GET',
        headers: {
          Authorization: `Bearer ${await this.accessToken()}`,
          'Content-Type': 'application/json',
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(20000),
      },
    );
    const data = await response.json();
    if (!response.ok)
      throw new ToolError(
        'SHEETS_ERROR',
        'Google Sheets could not complete the operation. Retry with the same request_id.',
        true,
      );
    return data;
  }
  async read(tab: 'Slots' | 'Bookings'): Promise<string[][]> {
    // Full used columns: never silently omit existing reservations beyond a fixed row limit.
    return (
      (await this.request(`/values/${encodeURIComponent(`'${tab}'!A:K`)}`))
        .values ?? []
    );
  }
  async reserve(slotId: string, requestId: string, row: string[]) {
    const metadata = await this.request('?fields=sheets.properties');
    const sheetId = metadata.sheets.find(
      (s: { properties: { title: string } }) =>
        s.properties.title === 'Bookings',
    )?.properties.sheetId;
    if (sheetId === undefined) throw new Error('Missing Bookings tab');
    // Unique sheet IDs/titles are durable claims. All claims and the row succeed or fail together.
    // Hash collisions fail closed; never delete markers when editing booking rows.
    const claims = [`slot:${slotId}`, `request:${requestId}`].map((value) => ({
      addSheet: {
        properties: {
          sheetId: markerId(value),
          title: `_reservation_${createHash('sha256').update(value).digest('hex')}`,
          hidden: true,
          gridProperties: { rowCount: 1, columnCount: 1 },
        },
      },
    }));
    await this.request(':batchUpdate', {
      requests: [
        ...claims,
        {
          appendCells: {
            sheetId,
            rows: [
              {
                values: row.map((stringValue) => ({
                  userEnteredValue: { stringValue },
                })),
              },
            ],
            fields: 'userEnteredValue',
          },
        },
      ],
    });
  }
  async savePayment(rowNumber: number, reference: string, url: string) {
    await this.request('/values:batchUpdate', {
      valueInputOption: 'RAW',
      data: [
        {
          range: `'Bookings'!I${rowNumber}:J${rowNumber}`,
          values: [[reference, url]],
        },
      ],
    });
  }
}
