# Services and scheduling

All services, fees, and schedules below are fictional demo configuration.

| Service ID | Name | Duration | Fee | Amount in kobo |
| --- | --- | --- | --- | --- |
| intro_consultation | Introductory consultation | 20 minutes | NGN 5,000 | 500000 |
| individual_session | Individual counselling session | 50 minutes | NGN 20,000 | 2000000 |

## Introductory consultation

A conversation to ask questions about the practice, discuss what the prospective client is looking for, and explore suitability directly with the therapist. It does not commit the client to further sessions. The assistant cannot decide clinical suitability.

## Individual counselling session

A scheduled individual appointment with the therapist. Clients discuss their needs directly during the session. No particular outcome is promised.

## Appointment schedule

All appointments are online and shown in Africa/Lagos (WAT, UTC+1).

| Appointment days | Service | Start times |
| --- | --- | --- |
| Tuesday, Wednesday, Thursday | intro_consultation | 09:00, 09:30 |
| Tuesday, Wednesday, Thursday | individual_session | 10:00, 11:00, 13:00, 14:00 |

- Book at least 24 hours in advance and no more than 14 days ahead.
- No weekend appointments are configured.
- The schedule is a template for dated slots, not a live availability result.
- Always call `check_availability` before offering a specific appointment.
- Server configuration must enforce service IDs, fees, durations, and booking windows. The assistant must not override these values.
- If server results conflict with these references, seek clarification before booking or generating payment.
