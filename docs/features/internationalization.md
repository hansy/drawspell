# Drawspell internationalization

Updated November 2, 2026.

Drawspell uses **Paraglide JS 2.29.3** with version-controlled inlang JSON catalogs. The compiler, checker and format/matcher plugins are pinned in `apps/web/package.json` and installed locally; generation does not download plugins from a CDN. The implementation supports every app page, including rooms, developer authentication, legal pages, errors, menus and accessibility labels.

The ten non-English catalogs are **draft translations**, initially generated offline, with corrections for core labels, Magic terminology, numbers and count messages. They are structurally complete, but have not received fluent-speaker or legal review. Passing validation does not certify translation quality. Review the longer instructions, game terminology, legal text and Portuguese regional vocabulary before treating these as professionally localized content.

## Languages

`apps/web/src/i18n/locales.ts` is the locale and Scryfall registry. App URLs, HTML and Intl use BCP 47 tags; Scryfall uses its own API identifiers.

| Language | App locale / prefix | Selector | Scryfall |
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

Scryfall also has historical, promotional and fictional card languages; these do not have full app catalogs.

## URLs and request handling

English URLs remain unchanged: `/`, `/docs`, `/privacy`, `/tos`, `/auth/login`, `/developers`, `/rooms/abc`. Other languages add their prefix, for example `/fr/docs` and `/zh-Hans/rooms/abc`. The URL is authoritative: unprefixed requests render English regardless of cookies or browser language. `/en/docs` redirects to `/docs`; supported prefix casing is canonicalized.

The site header and room menu offer native-name language selectors. Switching performs a document navigation while preserving the path, query and fragment. Room identity and credentials live in the existing room storage, independent of locale. Navigation, invitation links, aliases and authentication callback URLs preserve the selected language.

`paraglide.config.ts` supplies both standalone compilation and the Vite plugin. Router input/output rewrites use the generated URL helpers without duplicating route files. `src/server.ts` is the actual Wrangler Worker entry and wraps Start with Paraglide's request-scoped AsyncLocalStorage middleware. It preserves the original localized request for the router and isolates concurrent SSR locales. `src/start.ts` adds a validated locale header to unprefixed server-function requests and retains Start's CSRF middleware.

APIs, auth protocol endpoints, server functions, WebSockets and assets keep their original URLs. Locale-prefixed protocol aliases return 404. A locale header affects only server-function presentation, not API authentication or room authorization.

HTML uses the active language. Indexable public pages have localized canonical URLs, reciprocal `hreflang`, English `x-default` and localized sitemap entries. Canonical URLs omit all invitation credentials and query parameters. Rooms, authentication, unknown pages and nonproduction environments are noindex. Public Markdown/agent documents remain English; their links explicitly identify that language.

## Copy and formatting

```text
apps/web/messages/en.json               English source of truth
apps/web/messages/{locale}.json         matching translated message IDs
apps/web/project.inlang/settings.json   locale list and pinned local plugins
apps/web/i18n/translation-revisions.json English revisions used by each translation
apps/web/src/paraglide/                 generated and gitignored; never edit
apps/web/src/i18n/                      locale, URL, metadata and formatting helpers
apps/web/scripts/i18n/                  catalog, semantic and literal-copy checks
```

Use stable snake_case IDs and whole sentences with named parameters:

```tsx
import { m } from "@/paraglide/messages.js";

<h1>{m.not_found_title()}</h1>
```

Count messages use inlang declarations, selectors and locale-specific plural categories. Numeric placeholders use number formatting; dates and relative times use Intl with the active locale. ISO legal dates use UTC for consistent SSR/browser output. Protocol numbers, deck syntax, code samples, card IDs and user content retain their machine-readable or original values.

Inline links and code use named `messageSlot` markers rendered through `richText` into React components, so translators can reorder the paragraph without injecting HTML. Preserve the named placeholders. Module-level presentation objects use lazy getters so messages resolve for each request rather than freezing a locale at import time.

## Translation maintenance and validation

Run from the repository root:

```sh
bun run i18n:check
bun run i18n:audit
bun run --cwd apps/web test
bun run --cwd apps/web typecheck
bun run --cwd apps/web build:production
```

Development, tests, builds and typechecking generate the real Paraglide runtime. The standalone generator seeds Paraglide’s incremental compiler with the current output hashes, so unchanged checks do not remove runtime files from under a running dev server. Builds and typechecking also run the full translation gate:

1. Catalog coverage rejects missing/empty locales, keys, duplicate JSON properties, extra keys, malformed/mismatched parameters, missing locale plural categories whole-catalog English copies, and changes to fixed API syntax or keyboard bindings.
2. Source-revision validation flags each translation when an existing English message changes, even if its ID is unchanged.
3. Paraglide compilation checks message syntax; generated declarations typecheck IDs and inputs.
4. `inlang check` checks missing/empty translations, variables, markup, variants and selectors. Fixtures run the actual CLI against deliberately broken catalogs and require failure.
5. The TypeScript AST copy audit rejects new hardcoded copy in covered display contexts. Its baseline is **zero**. Do not increase the baseline to admit new copy.

The copy audit covers JSX, accessibility/text props, known presentation properties/defaults, label maps, notifications, common errors and presentation-helper returns. It is a heuristic, not whole-program dataflow analysis. Tests, generated code, technical URLs and protocol literals are excluded. Review new presentation patterns and expand the audit when needed. The inlang unused-message analyzer cannot resolve all app imports and global accesses; unused-message analysis is not presented as a complete gate.

When changing English:

1. Update the same message in every target catalog, preserving parameters and required plural forms.
2. Record the English revision each updated translation was written against:

   ```sh
   bun run --cwd apps/web i18n:record --locale es --message message_id
   # Omit --message after updating the entire Spanish catalog.
   # Use --all only after updating every target catalog.
   ```

3. Run the checks. Recording revisions does not mark a translation as linguistically approved and must not substitute for translating it.

Add a language by updating the registry, inlang locale list and catalog, then recording its source revisions. These drive selector choices, sitemap and alternate URLs. Remove a language from all those places and the revision file; choose a redirect policy for previously published URLs. Remove unused message IDs from all catalogs and revision records together.

## Scryfall presentation

Changing language never rewrites a shared card's ID, name, printing, stats, face index or Yjs state. Each viewer resolves presentation independently:

1. Reuse canonical card data from the existing cache.
2. Request `/cards/{set}/{collector_number}/{scryfallLanguage}` for the same printing.
3. On 404, search by exact Oracle ID and target language for another printing. Validate Oracle identity, language, layout and face order before using it.
4. Fall back to the original card when no translation exists. Keep current English Oracle rules accessible in the locked preview; translated printed text can differ from current rules.

A separate bounded `(sourcePrintingId, language)` cache deduplicates requests and expires successes, absent translations and transient failures on different schedules. Translated cards enter the ordinary cache under their actual translated IDs. A shared request queue spaces Scryfall calls and respects `Retry-After` on 429 across imports, token search and translation lookups.

Board/preview images and names, grouped zone names/search and preview preloading use localized presentation. Token search requests multilingual results in the selected language, falling back on 404. Quick-token labels are translated while their search queries remain canonical. Visibility gates prevent translation requests for hidden identities; a specifically revealed library top does not grant access to other library cards. Stale language/permission responses do not render.

## Verification

Unit/component suites cover locale URL contracts, concurrent request isolation, real generated routing, catalogs, copy detection, CLI failures, Scryfall identity/fallback/cache behavior, request spacing, stale responses and hidden-card permissions. Browser smoke tests are retained for repeatable checks:

```sh
# Build production, start the preview, then test in another terminal:
bun run --cwd apps/web build:production
bun run --cwd apps/web serve --host 127.0.0.1 --port 4173
bun run --cwd apps/web test:e2e:i18n

# Local room persistence and translated artwork (requires both dev Workers):
bun run dev
bun run dev:server
bun apps/web/test/e2e/i18n-room.ts
```

Verified on November 2, 2026: 1,122 web tests, 335 room-server tests and 14 auth tests pass; web/server/auth typechecks and the production Cloudflare build pass. The all-locale production browser smoke test and the local room identity/card/artwork smoke test pass. The dependency gate reports no high-severity vulnerabilities. With all eleven languages, the production initial client chunk is 601.93 kB (196.32 kB gzip) and the board chunk is 592.38 kB (178.02 kB gzip); these totals include the app and framework, not just translations.

Set `CHROME_PATH` when Chrome is installed elsewhere. Public smoke tests exercise all eleven locales, direct entry, hydration, canonical metadata, login and 404 pages, switching with invitation query/fragment values, browser back, protocol exclusions, mobile layout and pre-join room switching. The local room check exercises an actual player and card through a room-menu locale change. These checks do not constitute fluent-speaker translation review.

## Upstream references

- [Paraglide's TanStack Start integration](https://paraglidejs.com/tanstack-start)
- [Compiler options](https://paraglidejs.com/compiler-options), [variants](https://paraglidejs.com/variants), [formatting](https://paraglidejs.com/formatting)
- [Translation checking](https://paraglidejs.com/checking-translations)
- [Scryfall language definitions](https://github.com/scryfall/api-types/blob/main/src/objects/Card/values/LanguageCode.ts)
- [Scryfall collector endpoint](https://scryfall.com/docs/api/cards/collector)
