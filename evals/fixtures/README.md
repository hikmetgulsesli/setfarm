# Product Contract Replay Fixtures

This directory contains minimal, redacted historical evidence used by the
offline Product Compiler replay suite.

Fixtures are regression evidence, not generated-project templates. Every case
must declare source provenance, copied-file hashes, a redaction statement, and
stable expected compiler outcomes. Fixture evaluation must not require network
access, a live Setfarm service, the operational PostgreSQL database, GitHub, or
OpenClaw.

Credentials, `.env` files, private transcripts, mutable worktrees, and personal
user data must never be copied here. Product-specific identifiers may appear in
fixtures, but generic runtime code must not branch on them.
