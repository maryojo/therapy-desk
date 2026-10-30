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
responses. All three registered tools currently return
`INTEGRATION_NOT_CONFIGURED`; they do not create bookings, payment links, or
external writes. Google Sheets, Paystack, deployment, and Chord/WhatsApp
connections remain pending.

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

| Tool                | Inputs                                                                    | Current result                            |
| ------------------- | ------------------------------------------------------------------------- | ----------------------------------------- |
| check_availability  | service_id and valid YYYY-MM-DD date                                      | Explicit integration-not-configured error |
| create_booking      | slot_id, client_name, client_email, adult_confirmed=true, UUID request_id | Explicit integration-not-configured error |
| create_payment_link | booking_id                                                                | Explicit integration-not-configured error |

Accepted service IDs are `intro_consultation` and `individual_session`. IDs are
bounded alphanumeric strings with underscores or hyphens. Request IDs must be
reused for retries of the same booking attempt. Inputs are validated, but live
scheduling checks and durable idempotency require the next integration stage.
Unknown input fields are rejected; payment amounts cannot be supplied by
callers.

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

1. Implement business logic behind `check_availability`, `create_booking`, and
   `create_payment_link`.
2. Connect a test Google Sheet and Paystack test mode.
3. Add server-side scheduling, durable retry handling, and integration error
   mapping.
4. Verify validation, retries, partial failures, and external actions.
5. Deploy to public HTTPS and connect to Chord.
6. Test the WhatsApp simulator and owner workflow.
7. Complete field notes, go-live note, and a three-minute recording.

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
