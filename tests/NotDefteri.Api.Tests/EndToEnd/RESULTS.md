# T14 backend acceptance verification

Status: NOT RUN. Acceptance remains Unknown pending Factory execution.
No restore, build or test commands were executed during implementation.

The existing xUnit v3 executable project includes AcceptanceTests automatically.
The EndToEnd suite reuses the established HTTP/database and real Kestrel probes:

- Anonymous create/list/get/update/delete, including direct database confirmation
  that the deleted row is absent.
- HTTP 409 on duplicate creation and rename, preserving stored content.
- Actual configured loopback endpoints and health requests in Production and
  Development, plus refused connections on active non-loopback interfaces.

The existing loopback probe explicitly skips when IPv6 or an external interface
is unavailable, or interface probing is denied. Skips must be reported separately
from passes; they do not establish external-interface refusal.

Factory should run the test executable directly and retain case outcomes,
skip reasons and exit status in its run artifacts. These tests use the existing
SQLite test factory; PostgreSQL-specific behavior remains covered by the
repository's separately configured PostgreSQL tests.
