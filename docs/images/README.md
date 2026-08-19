# Images

- `banner.svg` — README hero banner. Generated, in place.

## Pending (add when available)

The main [README](../../README.md) references these paths but the files don't exist yet — no
screenshot-taking tool was available while writing the docs, so nothing fake was generated in
their place. Add real screenshots here with these exact filenames and the README picks them up
automatically:

| File               | What to capture                                                                                                                                  |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `booking.png`      | The public booking flow (`index.html`) — specialty → professional → date → reservation form                                                      |
| `checkout.png`     | The Stripe Checkout page after clicking "Reservar e pagar"                                                                                       |
| `admin.png`        | An authenticated admin view (e.g. the response of `POST /admin/profissionais` or a future admin UI)                                              |
| `architecture.png` | A rendered export of the Mermaid diagram in [docs/architecture.md](../architecture.md), if you want a static image instead of the inline Mermaid |

There's no `dashboard.png` target today — this project doesn't ship an admin dashboard UI (the
admin routes are API-only; see [Roadmap](../../README.md#future-improvements)). Rename/repurpose
this row if that changes.
