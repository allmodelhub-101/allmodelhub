# Generation Center: live Chat activity

## Cause

The deployed Generation Center polled `generation_jobs` for media work. Chat streams use `/api/chat` and do not create those media-job records, so polling could never make a live Chat request appear. Historical media failures were real past records, not the state of the current Chat request.

## Fix boundary

- `ChatClient` adds one observer hook over existing state. Its submission, stream parsing, cancellation, conversation persistence, voice, uploads, authorization refresh and settlement handlers are unchanged.
- A client-only, in-memory external store publishes processing/completed/failed/cancelled state immediately to the topbar and open drawer. Media snapshots refresh independently and cannot overwrite the live Chat entry.
- Chat entries are labeled **Current chat session**. They are bounded to twelve entries, removed when their Chat component unmounts, and never written to local/session storage, a database, a broadcast channel or a server. They are not a replacement for durable Library history or a cross-tab background job service.
- Private request titles are always generic, with no conversation link. Turning private mode off later cannot reveal a previous private prompt.
- A charge is shown only when the existing Chat controller provides one; unknown charges link to usage, and pending settlement is not represented as a zero charge. Chat output completion and financial settlement are distinct.
- Chat links return to `/chat` or its actual conversation, not `/text`. Media retries/cancellation notices are not offered for local Chat activity.

No API, provider, schema, auth, wallet, billing calculation or stylesheet changes are included. This release builds on the deployed Chat visual restoration, which remains unchanged.

## Verification

- Existing billing/security/UI tests plus activity-store tests; immutable execution-handler contracts remain intact.
- Actual ChatClient and WorkspaceTopbar mounted together with local HTTP/SSE responses: immediate closed-drawer badge, open drawer, completion, failed request, user Stop, private-mode transitions, pending settlement, refresh retention and unmount cleanup at phone/laptop widths in Chromium and WebKit.
- Existing media Generation Center polling/error/history/zero-charge/focus-deduplication checks retained.
- Production webpack build, TypeScript, full lint and security scanner.

The browser tests mock external responses; they create no real account, provider request, paid generation or financial mutation. Existing saved chats are in Library. To see the new live indicator, load this release and start a new Chat request; a completed request is correctly not counted as active.
