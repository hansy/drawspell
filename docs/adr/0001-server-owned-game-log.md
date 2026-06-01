# Server-Owned Game Log

Drawspell will keep the Game Log as bounded, structured, server-authored Game Log Events owned by the Room server, not as part of the Yjs Document. The Room server will order events with a Room-local sequence, replay retained events to reconnecting clients by cursor, fall back to the retained Game Log snapshot when a client cursor is too old, and persist the bounded log to Durable Object storage for Room-lifetime recovery. The first version will retain the last 200 Game Log Events. Durable persistence will be batched rather than written once per event, because players need immediate live broadcast and warm reconnect recovery, while cold recovery can tolerate a small window where the newest events may only exist in memory.

This deliberately avoids using the Yjs Document for high-churn replay history, keeps hidden-card redaction centralized on the server, preserves structured client rendering, and limits storage cost by retaining only a fixed number of Game Log Events.

The Game Log is cleared when a Room's lifetime ends, not by gameplay actions inside the Room. Deck reset and deck unload remain Game Log Events rather than log-clearing actions.

When the server sends a retained Game Log snapshot, clients replace their local Game Log with that snapshot. Incremental replay and live Game Log Events are appended with sequence-based deduplication.

Browser persistence is out of scope for the first version. Clients keep an in-memory rendered Game Log and use server replay as the source of truth after reconnect.

New protocol messages should use the `gameLog*` prefix, such as `gameLogEvent`, `gameLogReplay`, and `gameLogSnapshot`, so the synced gameplay log stays distinct from diagnostics and connection logging.

Game Log protocol messages travel on the intent WebSocket rather than the Yjs sync connection, because the Game Log is server-authored room messaging and not shared document state.

Clients request replay explicitly with a `gameLogRequest` message that may include `lastLogSeq`. The server responds with incremental replay when possible or the retained Game Log snapshot when the cursor is missing or too old.
