# TherapyDesk

A TSG Labs assessment project for an administrative WhatsApp assistant on Chord. The current skill configures The Listening Room Counselling Practice using fictional business and client data.

## Current implementation

The `therapy-booking` skill package is written. It covers business enquiries, appointment booking instructions, payment-link handling, failures, and human assistance boundaries.

The MCP server, Google Sheets integration, Paystack integration, deployment, and Chord/WhatsApp connections are not implemented yet. Tool names in the skill are planned interfaces, not working integrations.

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

The skill name describes the reusable capability. Practice-specific identity, services, and policies live in references. When configuring another practice, update all references and the corresponding server configuration together.

When Chord access is available, upload `skills/therapy-booking` as a folder or ZIP with `SKILL.md` at the package root and `references/` alongside it. Review the instruction file, publish the skill, activate the teammate, and test an FAQ response. File creation alone does not publish anything to Chord.

## Next implementation steps

1. Build the authenticated TypeScript MCP server with Streamable HTTP.
2. Implement `check_availability`, `create_booking`, and `create_payment_link`.
3. Connect a test Google Sheet and Paystack test mode.
4. Verify validation, retries, partial failures, and external actions.
5. Deploy to public HTTPS and connect to Chord.
6. Test the WhatsApp simulator and owner workflow.
7. Complete field notes, go-live note, and a three-minute recording.

## Owner workflow

The owner approves practice information, maintains dated slots, reviews bookings in Sheets, verifies payment manually, updates statuses, and sends meeting links. Automatic owner alerts, cancellation, rescheduling, refunds, and payment reconciliation are outside the initial scope.

## Assessment limits

Use made-up data and test keys only. The practice identity and contact email are fictional. No clinical service, working human handoff, emergency notification, or live payment processing is configured. Use a real business problem as the basis of the final submission without connecting real customer records.

## Sources

- [Chord teammate setup](https://api.chordhq.xyz/docs/build-a-teammate/)
- [Chord MCP connections](https://api.chordhq.xyz/docs/mcp-servers/)

## AI usage

Codex assisted with planning and drafting the initial skill and reference files. The project owner must review the configuration and record subsequent implementation and testing accurately in the final submission.
