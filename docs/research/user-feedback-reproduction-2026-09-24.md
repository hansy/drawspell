# User feedback reproduction audit — 2026-09-24

Source: the eight-item player report and `drawspell1.png` / `drawspell2.png` supplied in the task. This audit records observed behavior; it does not apply fixes.

## Environment and method

- Local web and server: `bun run dev:all`, `https://ds.localhost`.
- Browser: headless Google Chrome on macOS. The two-player checks used separate browser contexts and a player invite link.
- For battlefield setup, a local room imported `10 Plains`, drew four, and moved them to known normalized positions through the web client's store. Rendering, selection, and multiplayer sync then ran in the real app.
- A separate empty-board check ran against `https://drawspell.space`.

## Results

| # | Report | Status | Evidence and limits |
| --- | --- | --- | --- |
| 1 | Turn can pass to a player at 0 life and get stuck | **Reproduced** | In a server intent run with three players and player 2 at 0 life, ending player 1's turn made player 2 active. Player 3's attempt returned `not your turn`. The current turn handler cycles through all room players and only accepts the active player's end-turn intent. This is the exact lock described, assuming player 2 is absent. |
| 2 | Different viewport widths produce different overlap | **Reproduced in two live clients** | Four cards had the same shared positions, 0.04 normalized X apart. On the 2560 px viewport, rendered card width was 60.39 px and adjacent left-edge gap was 83.92 px, leaving no overlap. On the 1440 px viewport, card width was still 60.39 px but gap was 43.48 px, creating 16.91 px overlap per adjacent pair. This matches the direction shown in screenshot 1. |
| 3 | Tapped and zoomed cards use different apparent grid alignment | **Reproduced at placement calculation** | At a 1000×600 board and a 135×90 base card, the same pointer position snapped to `(360, 247.5)` untapped and `(337.5, 225)` tapped. At 0.8 zoom, the untapped snap was `(324, 234)`. A card placed at `(360, 247.5)` at 1.0 zoom would snap 13.5 px higher on the 0.8 grid. This establishes the reported drift when moving and changing orientation or zoom; it does not show that tapping alone moves a stored card. |
| 4 | Tapped top-seat 6/6 can read as 9/9 | **Reproduced by transform composition; visible in screenshot 1** | The top seat rotates the card 180°, tapping adds 90°, and the name/P/T labels add another 180° counter-rotation. The artwork ends at 270° while the labels end at 90°, so the numeral and artwork face opposite ways. The screenshot shows a 6/6 that was read as 9/9. |
| 5 | Apply counters or P/T changes to multiple selected cards | **Feature gap confirmed** | The current group menu builds reveal, move, and optional token-removal actions. It has no bulk counter or P/T action. Screenshot 1 shows the group menu with only “Move to...” for those selected creatures. |
| 6 | Additional keyboard shortcuts | **Feature gap confirmed** | The shortcut registry assigns `T` to token creation; Space has no binding; Shift+`+` and Shift+`-` zoom. No selected-card counter or P/T shortcut is registered. |
| 7 | Double-click empty battlefield breaks marquee selection | **Not reproduced yet** | In a local two-player Chrome room with four battlefield cards, marquee selected all four before and after double-clicking both an empty corner and the center name area. The selection rectangle also appeared before and after an empty-space double-click in a production one-player room. The production check had no cards, and neither check recreated the exact pointer path in screenshot 2 or covered Opera. The screenshot remains evidence of a failure; this result only narrows its trigger. |
| 8 | Board actions fail around reconnecting | **Exact player bug not reproduced; forced-disconnect probe explained** | The initial forced-provider-disconnect test dropped an action and reload recovered it. Later wire instrumentation showed the provider and intent transport had been torn down before that action; no intent frame was sent. A normal browser offline/online cycle restored both channels and the action persisted on both clients. The forced test does not establish the cause of the intermittent full-board freeze. |

## Repeatable reconnect probe

With both local dev processes running:

```bash
cd apps/web
bun scripts/repro-reconnect-action.ts
```

The script creates a local two-player Room, checks a baseline update, deliberately disconnects the host sync provider, checks an update, then reloads and retries. Exit code 1 means the post-disconnect action failed. Wire instrumentation identified that the deliberate disconnect leaves the local session resources torn down; `beforeAction` has no provider or open intent transport, and no intent frame is sent for the attempted update. With `REPRO_MODE=offline REPRO_SETTLE_MS=2000`, the script instead simulates a brief browser network outage; that run exited 0 and the update reached both clients. The script does not print invite tokens. Treat these as two different connection paths.

## Next reproduction work

1. For #7, capture the exact browser event sequence around the double-click and failed drag: `pointerdown`, `pointerup`, `pointercancel`, `dragstart`, `selectionchange`, and pointer capture state. Compare a failing recording with the working local sequence. The production empty-board check does not settle the card-filled case.
2. For #8, capture a real failing reconnect with socket state, intent send/ack, and pointer gestures. Keep the reported intermittent full-board freeze separate from the deliberate provider teardown.
3. Preserve the geometry cases above as regression checks when fixes are implemented for #2–#4. Check two viewers at different viewport sizes as well as tap, drag, untap, and zoom cycles.
