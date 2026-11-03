# TherapyDesk

A TSG Labs assessment project for an administrative WhatsApp assistant on Chord.
The current skill configures The Listening Room Counselling Practice using
fictional business and client data.

## Current implementation

The `therapy-booking` skill package is written. It covers business enquiries,
appointment booking instructions, payment-link handling, failures, and human
assistance boundaries.

The TypeScript MCP server foundation is implemented: stateless Streamable HTTP,
bearer authentication, environment validation, input schemas, and safe error
responses. Google Sheets availability and booking tools are implemented. They
activate when the spreadsheet ID and service account credentials are configured.
Paystack test checkout links are implemented and activate when a test secret key
and Sheets are configured. Payment verification remains manual. Deployment and
Chord/WhatsApp connections remain pending.

## Run locally

Use Node.js 22 or later.

```sh
npm ci
cp .env.example .env
openssl rand -hex 32
```

Set `MCP_BEARER_TOKEN` in `.env` to the generated token. The example placeholder
is rejected at startup. Never commit or share this secret in chat or logs.

```sh
npm run dev
```

The default listener is `127.0.0.1:3000`. `GET /health` is public and reports
server liveness, not integration readiness. `POST /mcp` requires
`Authorization: Bearer <MCP_BEARER_TOKEN>` and the MCP client's JSON and SSE
Accept headers. GET and DELETE on `/mcp` return 405 because this transport is
stateless and has no standalone SSE stream or sessions.

```sh
npm run typecheck
npm test
npm run build
npm start
```

The tests use a real MCP SDK client against an ephemeral local HTTP port to
verify initialization, discovery, tool input validation, and explicit
integration failures. They also cover authentication, malformed JSON, request
size limits, host/origin restrictions, and credential-safe errors.

## Environment and deployment

| Variable         | Purpose                                                                                                      |
| ---------------- | ------------------------------------------------------------------------------------------------------------ |
| NODE_ENV         | development, test, or production                                                                             |
| HOST             | Listener address; defaults to 127.0.0.1; use 0.0.0.0 where required by hosting                               |
| PORT             | Port from 1 through 65535; defaults to 3000                                                                  |
| MCP_BEARER_TOKEN | Required non-placeholder secret of at least 32 characters; generate randomly                                 |
| ALLOWED_HOSTS    | Comma-separated hostnames without scheme or port; add the public deployment hostname                         |
| ALLOWED_ORIGINS  | Optional exact browser origins without trailing slash; absent Origin headers are accepted for server clients |

The server rejects unapproved Host and Origin headers, authenticates before
parsing MCP request bodies, and limits JSON bodies to 32 KB. Browser CORS
integration is not configured; Chord connects server to server. Public
deployments must terminate HTTPS at the hosting layer or reverse proxy. Do not
expose the listener directly over public plain HTTP. Set runtime environment
variables through the host's secret configuration; the current start script also
reads a local `.env` file, so provide one or launch `node dist/server.js` when
the host injects variables directly.

The MCP token protects Chord-to-server calls. Future Google and Paystack
credentials belong on this server, not in the skill. A Chord management API key,
if needed for registration, is a separate credential.

## Tool contracts

| Tool                | Inputs                                                                    | Current result                                         |
| ------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------ |
| check_availability  | service_id and valid YYYY-MM-DD date                                      | Available dated slots from Sheets                      |
| create_booking      | slot_id, client_name, client_email, adult_confirmed=true, UUID request_id | Durable pending-payment booking                        |
| create_payment_link | booking_id                                                                | Saved or newly initialized Paystack test checkout link |

Accepted service IDs are `intro_consultation` and `individual_session`. IDs are
bounded alphanumeric strings with underscores or hyphens. Request IDs must be
reused for retries of the same booking attempt. The server enforces configured
service fees, durations, weekday/time rules, and the 24-hour to 14-day advance
booking window. Unknown input fields are rejected; payment amounts cannot be
supplied by callers.

## Skill package

```text
skills/therapy-booking/
├── SKILL.md
└── references/
    ├── practice.md
    ├── services.md
    ├── faq.md
    └── policies.md
```

The skill name describes the reusable capability. Practice-specific identity,
services, and policies live in references. When configuring another practice,
update all references and the corresponding server configuration together.

When Chord access is available, upload `skills/therapy-booking` as a folder or
ZIP with `SKILL.md` at the package root and `references/` alongside it. Review
the instruction file, publish the skill, activate the teammate, and test an FAQ
response. File creation alone does not publish anything to Chord.

## Next implementation steps

1. Add dated test slots and verify the Google Sheets booking workflow.
2. Configure a Paystack test key and verify checkout links with fictional
   bookings.
3. Deploy to public HTTPS and connect to Chord.
4. Test the WhatsApp simulator and owner workflow.
5. Complete field notes, go-live note, and a three-minute recording.

## Google Sheets configuration

Enable the Google Sheets API and share the spreadsheet with the service account
as Editor. Set `GOOGLE_SHEETS_SPREADSHEET_ID` and either
`GOOGLE_APPLICATION_CREDENTIALS` (local absolute JSON file path) or
`GOOGLE_SERVICE_ACCOUNT_JSON` (full JSON string in Vercel's environment
settings). Never commit the key. The local path is not available on Vercel.

Required headers, in order:

- Slots: Slot ID, Service ID, Start Time, End Time, Timezone
- Bookings: Booking ID, Request ID, Slot ID, Client Name, Client Email, Booking
  Status, Amount, Currency, Payment Reference, Payment URL, Created At

Enter slot timestamps as plain ISO 8601 text with timezone, for example
`2026-11-04T09:00:00+01:00` through `2026-11-04T09:20:00+01:00`, timezone
`Africa/Lagos`, service `intro_consultation`. Use unique immutable slot IDs and
unique appointment start times. Slots must follow the schedule in the skill. The
server does not generate slots. Empty tabs return no availability.

Bookings store amounts in kobo and start as `pending_payment`. Any existing
booking row blocks its slot, regardless of status; cancellation/reopening is not
implemented. A repeated request ID with identical client/slot details returns
the original booking, even after the booking window passes. Changed details
return `REQUEST_CONFLICT`.

Each booking atomically creates two hidden `_reservation_*` sheets (one slot
claim and one request claim) and appends a literal-text booking row using Sheets
`batchUpdate`. Unique sheet IDs and titles reject competing claims; hash
collisions fail closed. This avoids a process-local lock on Vercel. Do not
delete these marker sheets or reuse/change booked slot IDs or times. Manual
edits bypass the server's protections. Hidden sheets consume spreadsheet
capacity, so this scheme is intended for the small assessment/demo workload. For
a larger deployment use a transactional datastore or a dedicated serialized
booking service. Ambiguous write failures are reconciled against Bookings; retry
with the same request ID rather than issuing a new one.

Health reports configuration presence, not Google credential validity or payment
readiness. Authentication and Sheets API failures are returned without exposing
Google's raw error details or credentials.

## Paystack test checkout links

Set `PAYSTACK_SECRET_KEY=sk_test_...` in `.env` (or hosting secrets), then
restart the server. Only test secret keys are accepted; live keys fail startup
validation. Sheets must also be configured. Do not share or commit the key.

After `create_booking`, call `create_payment_link` with its `booking_id` in MCP
Inspector. The server initializes a Paystack transaction with the stored email,
NGN fee in kobo, and a deterministic reference derived from the booking ID. It
writes Payment Reference and Payment URL to columns I and J, then returns
`payment_url`, `payment_reference`, `amount`, `currency`, and `test_mode: true`.
Repeated calls return the saved link. The booking remains `pending_payment`; a
checkout URL or redirect is not proof of payment. Verification/webhooks are not
implemented.

Missing bookings, duplicate booking IDs, non-pending statuses, invalid fees, and
conflicting saved payment fields fail without initializing a transaction. If
Paystack or Sheets fails, retry with the same booking ID. An ambiguous
initialization may have created a transaction without saving its URL. The tool
reuses the same reference and reports `PAYMENT_UNCONFIRMED` rather than creating
a different transaction. If retries cannot recover, the owner must reconcile
that reference in Paystack. Do not create a replacement booking to work around
it. A lost Sheets write response is reconciled by rereading the saved payment
fields.

Keep Bookings append-only during server operations: do not sort, insert, delete,
or move its rows while writes are in progress. Use filter views to inspect data.
Payment fields are updated by the row position read from Sheets.

Tests mock Paystack; a real test checkout still requires your own test key. API
contract: [Paystack Transactions](https://paystack.com/docs/api/transaction/).

## Owner workflow

The owner approves practice information, maintains dated slots, reviews bookings
in Sheets, verifies payment manually, updates statuses, and sends meeting links.
Automatic owner alerts, cancellation, rescheduling, refunds, and payment
reconciliation are outside the initial scope.

## Assessment limits

Use made-up data and test keys only. The practice identity and contact email are
fictional. No clinical service, working human handoff, emergency notification,
or live payment processing is configured. Use a real business problem as the
basis of the final submission without connecting real customer records.

## Sources

- [Chord teammate setup](https://api.chordhq.xyz/docs/build-a-teammate/)
- [Chord MCP connections](https://api.chordhq.xyz/docs/mcp-servers/)

## AI usage

Codex assisted with planning and drafting the initial skill and reference files.
The project owner must review the configuration and record subsequent
implementation and testing accurately in the final submission.
