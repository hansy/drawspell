# Drawspell internationalization

Date: November 1, 2026. Status: partial implementation on `main`; Paraglide runtime installation, UI migration, and language switching remain blocked/pending.

## Decision

Use **Paraglide JS**, with version-controlled JSON messages, for the TanStack Start web app. Use BCP 47 language tags in URLs, HTML, and formatting. English remains the default and has no URL prefix. Every accessible page, including authenticated pages and the room UI, follows the same convention.

Paraglide runtime compatibility has **not** been verified. Both Bun and npm fail to resolve `registry.npmjs.org` in this environment, including a fresh installation attempt on November 1, 2026. No Paraglide dependency, generated-code substitute, runtime import, router rewrite, or Worker-entry change has been added. The current app still renders English at its original URLs.

## Implemented and locally validated

- `src/i18n/locales.ts` defines all 11 target BCP 47 locales and their Scryfall codes. No locale is advertised as a completed UI translation.
- `src/i18n/urls.ts` provides pure URL-contract helpers and tests for all existing page routes, unchanged English URLs, locale replacement, query/hash preservation, encoded room IDs, canonical URLs without credentials, and protocol/static exclusions. **These helpers are not yet wired into the router or server.** Localized API alias rejection still needs middleware integration.
- `project.inlang/settings.json` and `messages/{locale}.json` contain **15 starter messages in each of the 11 languages**, with pinned upstream format/matcher URLs. They are preparation data, not complete app catalogs. They are not consumed by the UI yet; compiler compatibility and translation review remain pending.
- `scripts/i18n/catalog-check.ts` runs in the existing build/typecheck gate. It rejects missing/empty locale files and messages, extra keys, duplicate JSON keys, malformed or mismatched placeholders, and whole-catalog English copies. It currently accepts flat messages only. Add the real compiler and `inlang check` before adopting plural/select/markup syntax; this local coverage checker does not replace them or determine translation quality.
- `src/services/scryfall/localizedCards.ts` resolves a visible canonical card to a same-printing translation, then to the same Oracle identity in another printing, then to the original card. It validates identity, language, layout and face order, deduplicates requests, bounds/expires positive and negative caches, and uses a separate short cooldown for transient failures. Successful translations enter the ordinary cache under their **actual** printing IDs. The resolver does not change game state.
- `localizedPresentation.ts` reads printed name/type/text and translated images with per-face fallback while retaining English Oracle text. `useLocalizedScryfallCard` requires an explicit locale and visibility decision, hides stale responses, and avoids fetching identities whose visibility is false. **Board/preview/zone renderers still need to call these interfaces after Paraglide is available.** The caller remains responsible for deriving permission from the app's existing reveal rules.
- `scryfallRequest.ts` now spaces request starts globally for the app's default cache, import, token, URI, and translation callers. A 429 delays queued requests using numeric or HTTP-date `Retry-After`; rejected/aborted requests do not poison the queue. Token search accepts an explicit app locale, requests multilingual results, and falls back to the original search only on 404. The UI does not pass an active locale yet.

The existing hardcoded-copy baseline remains **808 occurrences in 101 files** and was not expanded. That migration is still outstanding. Resolver/request/hook behavior has fixture tests; live Scryfall API behavior and localized browser/SSR rendering have **not** been exercised. The web typecheck, full test suite, and Vite/Cloudflare build validate the independent changes; they are not evidence that Paraglide runtime integration is complete.

## Library assessment

| Candidate | Suitability for this app | Tradeoff |
| --- | --- | --- |
| **Paraglide JS** | First choice. TanStack maintains a Start example; typed message functions, URL rewriting and request-scoped SSR compose with the existing router. JSON source files can stay in Git without a hosted service. | Adds message generation. Default output includes all configured languages for retained messages, so measure the room bundle before enabling all 11. |
| **i18next + react-i18next** | Strong alternative when broad framework compatibility and the React ecosystem take precedence. JSON resources, React bindings and SSR are documented. | Need to compose locale URLs and per-request i18next initialization ourselves. |
| **Lingui** | Strong alternative for ICU/gettext workflows and rich React content; upstream has a TanStack Start example. | Requires its extraction/compilation setup and React integration in addition to locale routing; PO is its default catalog format. |

The recommendation favors the existing app's routing and SSR requirements over an unsupported claim that any library is universally best. The upstream TanStack example currently declares the **same Router and Start versions** as this app (`1.170.41` and `1.168.60`), which is useful evidence of fit. It uses a newer Vite setup, so this app's Vite 7 and Cloudflare integration still require a real build and browser check. No framework upgrade is part of the proposed migration.

Sources:

- [Paraglide's TanStack Start integration](https://paraglidejs.com/tanstack-start)
- [TanStack's example package manifest](https://github.com/TanStack/router/blob/main/examples/react/start-i18n-paraglide/package.json)
- [i18next framework support](https://www.i18next.com/overview/supported-frameworks), [react-i18next SSR](https://react.i18next.com/latest/ssr)
- [Lingui introduction](https://lingui.dev/introduction), [upstream examples](https://lingui.dev/examples)

## Languages

Target the following 11 languages, aligning with Scryfall's main language options. This table defines the proposed app locale registry; it is **not** a list of translations ready to publish. Scryfall also lists Hebrew, Latin, Ancient Greek, Arabic, Sanskrit and Phyrexian. Their existence as card languages does not require adding those app locales in the initial release.

| Language | App locale / URL prefix | Native selector label | Scryfall code |
| --- | --- | --- | --- |
| English | `en` / none | English | `en` |
| Spanish | `es` / `/es` | Español | `es` |
| French | `fr` / `/fr` | Français | `fr` |
| German | `de` / `/de` | Deutsch | `de` |
| Italian | `it` / `/it` | Italiano | `it` |
| Portuguese | `pt` / `/pt` | Português | `pt` |
| Japanese | `ja` / `/ja` | 日本語 | `ja` |
| Korean | `ko` / `/ko` | 한국어 | `ko` |
| Russian | `ru` / `/ru` | Русский | `ru` |
| Simplified Chinese | `zh-Hans` / `/zh-Hans` | 简体中文 | `zhs` |
| Traditional Chinese | `zh-Hant` / `/zh-Hant` | 繁體中文 | `zht` |

Use one typed registry to drive project settings, the selector, URL tests and the Scryfall mapping. Keep a separate list of enabled locales so drafts can exist without exposing incomplete language choices. Translation reviewers should resolve Portuguese regional terminology before its release; the initial generic `pt` tag avoids promising a regional variant we have not prepared.

Do not send `zh-Hans` to Scryfall or put `zhs` in HTML/Intl APIs. Browser language aliases such as `zh-CN` and `zh-TW` can resolve to the script-based app locales when suggesting a language, but a suggestion must not override the language explicitly specified by a URL.

Source: [Scryfall's official language-code definitions](https://github.com/scryfall/api-types/blob/main/src/objects/Card/values/LanguageCode.ts).

## URL and rendering contract

| English | Spanish | Simplified Chinese |
| --- | --- | --- |
| `/` | `/es` | `/zh-Hans` |
| `/rooms/abc` | `/es/rooms/abc` | `/zh-Hans/rooms/abc` |
| `/docs` | `/es/docs` | `/zh-Hans/docs` |
| `/privacy` | `/es/privacy` | `/zh-Hans/privacy` |
| `/tos` | `/es/tos` | `/zh-Hans/tos` |
| `/auth/login` | `/es/auth/login` | `/zh-Hans/auth/login` |
| `/developers` | `/es/developers` | `/zh-Hans/developers` |

- The URL is the source of truth (`strategy: ["url", "baseLocale"]`). Unprefixed URLs always render English, independent of cookies, `Accept-Language`, or previous visits. `/en/...` canonicalizes to the unprefixed URL. Canonicalize supported prefix casing and trailing slash behavior without redirect loops.
- Keep the typed route tree and existing route identifiers. Compose TanStack's `rewrite.input` with `deLocalizeUrl` and `rewrite.output` with `localizeUrl`, following the upstream Start example. Prefixes do not require duplicating every route file.
- Wrap the Start request handler with `paraglideMiddleware` for request-local locale isolation. Preserve the original localized request for TanStack's own rewrite as shown in the Start-specific example. Do not mix that with a second, conflicting request rewrite from a generic server example.
- Configure the actual Worker entry: `apps/web/wrangler.jsonc` currently points directly at `@tanstack/react-start/server-entry`. A new wrapper must be selected by the Start/Cloudflare build and the deployed Worker, not just added as an unused file. Keep AsyncLocalStorage enabled with the existing `nodejs_compat` flag.
- Set `<html lang>` from the request locale and ensure hydration sees the same locale. Use localized canonical and `hreflang` links plus an English `x-default` on indexable public pages. Metadata descriptions, titles and Open Graph URLs follow the language. Authenticated and room pages retain their private/no-index behavior.
- Every internal link, legacy redirect and authentication redirect preserves the active language. Update raw `<a href>`, `window.location.replace`, login callback URLs and share/invite links, not just TanStack `<Link>`. The `/developer` and `/developer/login` aliases preserve locale when redirecting; `/discord/install` remains an external OAuth redirect.
- Keep API, auth protocol, Start server-function transport, WebSocket, static assets and card image URLs outside locale rewriting. Test both middleware and router rewriting: excluding an API from middleware alone does not automatically exclude it from every URL helper. Return 404 for accidental localized API aliases instead of silently accepting duplicate endpoints.
- Switching language preserves the path, query and fragment, including `gt`, `st` and `invite`, without changing encoding, leaking tokens into canonical tags, or creating a different room. Use a document navigation initially, matching Paraglide's documented default. Offer it in both the site header and room controls. Verify room membership resumes successfully before releasing it; if reloading removes a player or loses a hand, implement a locale-aware client switch with explicit rerender/cache invalidation before enabling it in rooms.
- Unsupported locale prefixes return a normal localized/default 404; they do not get silently stripped into an existing page. Language choices have native names and an accessible translated label.

Sources: [Paraglide routing](https://paraglidejs.com/i18n-routing), [Start integration](https://paraglidejs.com/tanstack-start), [middleware isolation](https://paraglidejs.com/middleware).

## Message source and maintenance

Target files (settings, starter catalogs, and registry now exist; generated runtime does not):

```text
apps/web/
  project.inlang/settings.json   # locales, baseLocale and pinned format plugins
  messages/en.json              # English source of truth
  messages/es.json              # same IDs, Spanish translations
  messages/zh-Hans.json          # same IDs, simplified Chinese translations
  messages/...                  # other target languages
  src/i18n/locales.ts            # registry and Scryfall mapping
  src/paraglide/                 # generated; never hand-edit
```

Use descriptive stable identifiers such as `room_leave_confirm_title`, complete sentences, named parameters and locale-aware plural variants. Keep paragraphs with inline links/emphasis as whole messages so translators can reorder them. The inlang message format supports variables and variants, and Paraglide offers a React markup adapter. Render app-defined markup through React components; avoid `dangerouslySetInnerHTML`. Pin compiler and format-plugin versions after testing them together; do not depend on mutable CDN major tags during reproducible builds.

Example source:

```json
{
  "room_leave_confirm_title": "Leave this Room?",
  "room_leave_confirm_message": "Your player and cards will be removed from the Room.",
  "room_leave_confirm_action": "Leave Room",
  "welcome_player": "Welcome, {name}"
}
```

Example call after generation:

```tsx
import { m } from "@/paraglide/messages";

<h1>{m.room_leave_confirm_title()}</h1>
```

Build messages before typechecking and before development/build entrypoints that import generated files. Keep generation deterministic and out of the translator workflow. Changes to English messages invalidate translation review status even if the message ID remains unchanged. Never fill missing translations with copies of the English file and report them as complete.

Translate at render time. Existing module-level objects such as `landingContent`, `DESTRUCTIVE_ACTION_CONFIRMATIONS`, footer links, menu definitions and shortcut descriptions must become message references or factories, rather than evaluating `m.*()` once during module import. Otherwise requests or later switches can retain the wrong language.

Use `Intl.NumberFormat`, `Intl.DateTimeFormat`, `Intl.RelativeTimeFormat` and plural rules with the active locale. This includes legal update dates, API key dates, log timestamps and counts. Protocol numbers, API examples, decklist syntax, card IDs, user-entered names and room IDs retain their machine-readable representation. Keep original dates as ISO values and format for display with an explicit timezone where SSR and browser output must agree.

Sources: [Paraglide markup and React adapter](https://paraglidejs.com/markup), [formatting](https://paraglidejs.com/formatting).

## Existing copy and validation

The initial syntactic audit found **808 literal occurrences in 101 files**. These are occurrences in known display contexts, not 808 unique finished translation messages. Some are brands, code samples or partial sentences requiring a human decision. The baseline records file, context, text and occurrence count; it deliberately ignores line movement.

| Source area | Occurrences |
| --- | ---: |
| Components | 380 |
| Routes | 120 |
| Models, including context menus and shortcuts | 164 |
| Logging | 67 |
| Hooks | 40 |
| Content | 12 |
| Data | 9 |
| Store | 9 |
| Server | 6 |
| Services | 1 |

Run from the repository root:

```sh
bun run i18n:check   # reject new literal copy in covered contexts
bun run i18n:audit   # JSON inventory, including source line numbers
bun run i18n:prune   # remove migrated baseline entries; refuses any additions
```

All three web build variants and web typechecking run `i18n:check`. The existing baseline makes this an incremental migration guard, not a zero-hardcoded-copy claim. New and duplicated occurrences are rejected. Removing copy requires pruning the baseline, so removed allowances cannot silently return. Do not regenerate or increase the baseline to make a check pass; replace existing occurrences with catalog calls and let it shrink to zero.

The copy guard uses the installed TypeScript parser and covers JSX text and expression alternatives, literal accessibility/text props, known text properties (including log text and metadata), toast messages and common error/message setters. It intentionally excludes tests and generated files, class names, URL attributes and arbitrary protocol literals. It cannot trace arbitrary variables or identify every string returned from a helper. A zero baseline therefore still needs a source review and runtime validation. Examples outside its current reach include `getPlayerLabel`, `getTransformVerb`, relative-time helpers and custom toast aliases. Use the inventory to begin migration, and extend the guard when a new presentation pattern is introduced.

After installation, add `@inlang/cli` **3.4.0 or newer** and run `inlang check` in the same build/typecheck gate alongside the copy audit. The old `inlang lint` command is a deprecated no-op and cannot be used as validation. With a compatible message-function matcher, the current checker validates missing/empty translations, variable and markup mismatches, plural/select variants and unused messages. Generated typed calls catch missing IDs and parameter mismatches. Test fixtures must prove those commands fail for deliberately missing translations and broken variables, not just prove that today's files pass.

Every **enabled** locale must have all required messages, parameters and plural forms. Draft locales remain disabled until complete and reviewed. Fallback English is useful for absent Scryfall printings or unexpected runtime failures; it must not disguise incomplete UI catalogs at build time. An approved same-language brand such as Drawspell remains a catalog value or a documented narrowly scoped exception, not a whole-file lint exemption.

Source: [Paraglide translation checking](https://paraglidejs.com/checking-translations).

## Scryfall localization

A Scryfall ID identifies a particular printing, including its language. Adding `?lang=fr` to the existing `/cards/{id}` call is not a language-switch implementation. Keep gameplay identity, imported deck data and synchronized Yjs state independent of each viewer's display locale.

Proposed resolver, for each card the viewer is permitted to identify:

1. Read the existing canonical card by ID through the current cache. Resolve the requested Scryfall language from the app registry; return the card immediately if it already has that language.
2. Request the same set and collector number in that language using Scryfall's `GET /cards/{set}/{collector_number}/{lang}` endpoint. Encode each path segment.
3. If that printing is absent (404), search for another printing of the same `oracle_id` in the desired language, with an exact validated language filter, multilingual results and a deterministic printing preference. Only use the same oracle identity. Do not guess a match from a translated name. A different printing/artwork is acceptable only as an explicit documented display fallback; never change the deck's selected printing.
4. If no translation exists, display the original card and its available English Oracle text. A network error, 429 or 5xx is a transient failure, not proof that the language is unavailable. Keep the original display usable and allow a later retry without a request storm.
5. Cache the `(sourcePrintingId, language)` resolution separately from the existing printing-ID cache; the translated result has its own Scryfall ID. Deduplicate in-flight lookups, bound the memory cache and expire positive/negative resolution entries. Do not cache a transient outage as a permanent missing translation. Store successful Scryfall card objects in the existing card cache under their actual IDs.
6. Serialize all Scryfall request starts through a shared limiter, including cache ID/collection requests, imports, tokens and translation requests. Respect Scryfall's request spacing and stop/retry appropriately on 429. Existing collection code delays chunks, but single-card requests and separate callers do not currently share one global limiter. Switching a board with 100 visible cards must not create 100 simultaneous requests.
7. Expose a presentation hook/service keyed by original ID and locale. On locale change, cancel/ignore stale results and fetch visible cards progressively. Apply localized names, printed type/text and translated images to board cards, previews and zone viewers. Update preloading keys and subscribers too. Do not mutate `Card.name`, `scryfallId`, stats, face index or shared cards to change one viewer's language.
8. Extend both full and lite face types for `printed_name`, `printed_type_line`, `printed_text` as needed. Current shared types only expose top-level `printed_name`, and the display helpers prefer embedded lite data over cache results. Updating `useScryfallCard` alone will not localize the actual card display.
9. Match multi-face layouts carefully. Preserve the original face index and use the corresponding localized face when available; fall back face-by-face without changing game stats. Keep English Oracle rules accessible, since printed translations are printing-specific text rather than replacements for current rules.
10. Fetch only identities the current permission/redaction rules allow the viewer to see. A language switch must not fetch or disclose an opponent's hidden hand/library, or put those identities in the public log. Do not translate user-entered card names through a machine translation service.

Use localized search for token labels/results where available, with English fallback; tokens may lack a translated printing. Keep import parsing and canonical deck validation stable. Locale changes affect each viewer independently, including spectators and two players in the same room using different languages.

Primary sources: [Scryfall language definitions](https://github.com/scryfall/api-types/blob/main/src/objects/Card/values/LanguageCode.ts), [card and localized field definitions](https://github.com/scryfall/api-types/blob/main/src/objects/Card/CardFields.ts), [collector endpoint](https://scryfall.com/docs/api/cards/collector), [API traffic requirements](https://scryfall.com/docs/faqs/i-m-having-trouble-accessing-the-scryfall-api-or-i-m-blocked-17). The Scryfall documentation pages returned HTTP 403 during this research; the official types confirm language codes and localized fields. Verify the collector/search endpoint behavior with live fixtures before implementation and do not claim it was exercised here.

## Migration and release checks

1. Install and pin compiler, format plugins, React markup adapter if needed, and checker. Prove one translated public page and the Worker entry under Vite 7/React 19/Cloudflare, including concurrent SSR requests in two languages and hydration. Add route tests for every current page, malformed prefixes, English canonicalization and preserved query/hash values.
2. Migrate all English source copy into catalogs, then implement the selector and locale-preserving navigation. Cover `/`, `/rooms/$sessionId`, `/docs`, `/privacy`, `/tos`, `/auth/login`, `/developers`, aliases and the root 404/error/loading states. Include menus, keyboard help, permissions/reconnect messages, deck import failures, tooltips, aria labels and log rendering. Replace user-visible server messages with stable error codes mapped to translated UI messages where appropriate.
3. Translate the 10 additional locales with a shared Magic terminology glossary. Review long German/Russian labels, CJK typography, Spanish/French punctuation and Portuguese vocabulary. Keep user content, card identity, protocol enums and code examples intact. Legal text requires language review before release; do not silently change its meaning while extracting copy.
4. Implement and test the Scryfall resolver and shared limiter. Fixtures cover same-print translations, oracle fallback, absent translations, untranslated tokens, mixed-language faces, cache separation, duplicate lookups, stale responses, 429 and recovery. Two clients must render different languages while sharing unchanged game state. Test hidden-card permissions explicitly.
5. Add browser checks for direct localized entry, internal navigation, reloads, back/forward, auth magic-link return, token-bearing invites and room language switching. Verify the entire room is operable on small screens and longer labels remain readable. An automated traversal can catch missing keys/fallback markers, but it cannot by itself prove that no English prose remains; review the migrated inventory and use pseudolocalization/screenshot checks.
6. Enable only locales with complete catalogs and passing checks. Add localized sitemap entries and reciprocal alternate links for indexable pages. Public Markdown/agent-discovery documents are currently generated from English sources; translate them through the same catalog pipeline or identify their links explicitly as English, rather than advertising nonexistent localized artifacts. Do not add private rooms or developer pages to a sitemap. Measure language bundle cost before all locales are enabled.

Adding a language after migration means adding its registry entry, catalog and reviewed translation, then passing the same gates. Removing one disables its selector/alternate/sitemap entries and provides a deliberate redirect for old localized page URLs. Removing messages updates all enabled catalogs and generated functions; unused-message checks detect leftovers.
