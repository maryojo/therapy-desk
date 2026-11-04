<p align="center">
  <img src="assets/td_logo.png" alt="TherapyDesk logo" width="400" />
</p>

# TherapyDesk

A therapy practice’s administrative WhatsApp
assistant on Chord. It uses The Listening Room, a fictional counselling practice
in Lagos, as its demo business.

The agent answers service and fee enquiries, checks Google Sheets availability,
creates bookings, and generates Paystack test payment links. The MCP server and
skill are implemented; deployment and Chord/WhatsApp connections remain pending.

## Run locally

Requires Node.js 22 or later.

```sh
npm ci
cp .env.example .env
openssl rand -hex 32
```

Set `MCP_BEARER_TOKEN` in `.env` to the generated value. Replace the Google Sheets
and Paystack placeholders with your test configuration, or leave those values
empty to run without integrations.

```sh
npm run dev
```

The server runs at `http://127.0.0.1:3000`. Check `GET /health` for liveness.
Connect an MCP client to `POST /mcp` with
`Authorization: Bearer <MCP_BEARER_TOKEN>` and support for JSON/SSE responses.

## Configure integrations

- **Google Sheets:** enable the Sheets API, share the spreadsheet with your
  service account as Editor, and set `GOOGLE_SHEETS_SPREADSHEET_ID` plus
  `GOOGLE_APPLICATION_CREDENTIALS` (local JSON key path) or
  `GOOGLE_SERVICE_ACCOUNT_JSON` (JSON credentials).
- **Paystack:** set `PAYSTACK_SECRET_KEY` to a test key beginning with `sk_test_`.
  Payment links also require Sheets. Payment verification is manual.
- **Chord:** upload `skills/therapy-booking` with `SKILL.md` at its root and
  `references/` alongside it, then publish and connect the MCP server.

## Checks and production build

```sh
npm run typecheck
npm test
npm run build
npm start
```

`npm start` reads `.env`. For hosting that injects environment variables, run
`node dist/server.js`. Public deployments require HTTPS and an approved hostname
in `ALLOWED_HOSTS`.

## Scope and limitations

Use fictional client data and test keys only. The agent provides no clinical
advice or diagnosis. There is no owner admin interface for business setup or
availability: slots must be added manually in Google Sheets. The owner reviews
bookings, verifies payments, and sends meeting links. Automatic reminders,
cancellations, rescheduling, refunds, and staff alerts are outside this version.

## AI usage

I used Codex to help plan the project, draft the booking skill and practice
reference files, assist with debugging issues, and refine the documentation.
I directed the work and remain responsible for reviewing the output, validating
the configuration, and recording test results accurately.
