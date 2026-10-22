# WebHunt — verificeret 20. oktober 2026

## Aktuel datakontrol

Se [kontrolrapporten](docs/VERIFICATION_REPORT.md): 58 Node-tests, vedvarende job/607-posters CLI-test, kildebelagt lukning, uændret rådata, SSRF-/robots-beskyttelse og beskyttet administration. Faktiske Nykøbing-tal er ikke opgjort i Codex, fordi databasen kun findes i brugerens Codespace. Tidligere registreringsbaseret rød erstattes af en konservativ aktivitet-plus-hjemmesidekontrol. Nedenstående tidligere beskrivelser er historik.


## Seneste leverance: kun fase 1 og 2

Se [DEVELOPMENT_PROGRESS.md](DEVELOPMENT_PROGRESS.md) for den aktuelle status,
ændrede filer, databevarelse og testbeviser. 38 Node-tests, 16 almindelige Chromium-tests,
3 kontrollerede MapTiler-browsertests, HTTP-API mod 707 isolerede databaseposter og
Supabase-katalogmigration i isoleret PostgreSQL består. Produktionsbuild og typekontrol består.
Live MapTiler-stil og to rigtige fliser svarer HTTP 200 med eksisterende nøgle.
Direkte live kortfliser i Codex-Chromium er begrænset af miljøets certifikatfejl;
permanent CA-import blev afvist af automatisk godkendelseskontrol. Ingen TLS-kontrol er deaktiveret.
Brugerens Codespace har separat bekræftet import af 1.448 virksomheder. Ingen genimport er nødvendig.

De efterfølgende afsnit er **historiske testnoter** fra tidligere leverancer.
Oplysninger om tidligere tomme databaser, Overpass-reservekilder og mørke/grå kort
beskriver ikke den nuværende datavej: kort og søgning læser egen database uden Overpass.

## Resultater

- Node.js 24.19.0. Produktionsbuild og TypeScript-kontrol består.
- 16 domænetests består: data/scoring/CSV, Supabase-diagnostik, navnemigrering, diskcache efter genstart, geografisk afgrænsning, gamle data, sekventiel reservekilde, Retry-After/eksponentiel ventetid, tomme resultater og samling af samtidige forespørgsler.
- 9 Chromium/browser-/API-tests består: kortmarkør, virksomhedspanel, leads, noter, kontaktstatus, CSV, genindlæsning, statistik, mobilfiltre, analysefejl/-succes med kontrollerede fixtures, backendvalidering, requestgrænser, WebHunt-navn, forbindelsesvejledning og synligt daterede gamle data.
- Supabase-variablerne er til stede, og den offentlige anon-nøgletype er bekræftet uden at udskrive værdien. Rigtigt kald til `/auth/v1/settings`: HTTP 200, e-mail-login aktiveret.
- Rigtige læsekald til begge private tabel-endpoints: HTTP 404, `PGRST205`. API'en kan ikke finde `leads` og `business_statuses` i sit schema. `/api/health` gengiver dette uden at returnere nøgler, projekt-URL eller private data.
- Primær Overpass-instans meldte HTTP 502: alle query workers optaget og køen fuld. Den gamle Kumi-reservekilde svarede ikke. Den aktuelle Private Coffee-reservekilde er bekræftet i Overpass Turbos konfiguration, men blev afvist af cloudproxyen med CONNECT HTTP 403.
- `npm run data:refresh` blev faktisk kørt. Det fejlede korrekt uden at indsætte opdigtede virksomheder og gemte ventetider på disk. Denne første rigtige indlæsning er fortsat blokeret.
- Rigtig browserkontrol uden virksomhedsfixtures: WebHunt-titel og logo, 25 indlæste OSM-kortfliser, ingen JavaScript-fejl, synlig korrekt Supabase-diagnose, tilgængelig loginformular og intet vandret overflow på mobil. Der blev ikke forsøgt login med brugerens private oplysninger.
- WebHunt erstatter det tidligere produktnavn i UI, metadata, pakke, kildefilnavne, eksport og dokumentation. Kun kompatibilitetsmigreringen og dens regressionstests omtaler de gamle lagernøgler for at bevare brugerdata.

## Skal gennemføres af brugeren / med eksterne tjenester

1. Supabase → SQL Editor → New query → indsæt hele `supabase/schema.sql` → Run. Scriptet opretter tabeller, ejerbaseret RLS og beder PostgREST genindlæse sit schema. Test derefter forbindelsen under Indstillinger; API-diagnostikken caches højst 30 sekunder.
2. Gem/aktivér netværksændringen med `overpass.private.coffee`. Den er gemt i den nye miljøkladde, men gemt konfiguration er ikke bevis på ændret live netværk. Genprøv datakilden efter aktivering og den angivne ventetid. Brug egen/aftalt Overpass-tjeneste og persistent lager ved offentlig drift; offentlige kilder har ingen SLA. Testet cachelogik er ikke bevis for, at en ekstern kilde er tilgængelig.
3. Log ind med egen konto efter schemaopsætningen og kontrollér lagring/genindlæsning. Gentag med to separate konti for at verificere isolation. Oprettelse af rigtige brugere, e-mailbekræftelse, password recovery og vedvarende private leads er ikke testet med dine konti. Ingen adgangskoder eller admin-nøgler er anmodet om eller kopieret.
4. Koden er nu committet og pushet til GitHub på `main`; remote-SHA blev kontrolleret mod den lokale commit. Kildekoden og Codespaces-konfigurationen er tilgængelige uden manuel ZIP-upload.
5. Ingen offentlig websitehosting eller offentlig previewadresse er oprettet. Den tidligere cloudversion er publiceret af brugeren; nye ændringer er gemt som en ny kladde. Cloudpublicering er ikke GitHub-lagring eller webdeployment.

Browserprøver bruger testfixtures og blokerede kortfliser, så de må ikke udlægges som en live OSM- eller Supabase-RLS-integrationstest. PageSpeed-scoring med den aktuelt tilføjede nøgle er ikke live-testet i denne opgave.

## Browseradgang og Codespaces

Ved efterfølgende previewkontrol var ingen server startet. `npm start` blev kørt igen; `ss` viste LISTEN på `0.0.0.0:3000`, og et lokalt HTTP-kald returnerede 200 med titlen WebHunt. Denne session har ingen eksponeret Codex-preview-/portforwardingfunktion. Det lokale resultat er ikke en browseradresse til brugerens computer.

GitHub Codespaces-konfiguration er tilføjet med Node 24, installation, automatisk start og forwarding af port 3000. Den præcise Codespaces-host tilføjes dynamisk som tilladt udviklings-origin. Et faktisk nyt codespace kræver brugerens GitHub-session og er ikke oprettet eller erklæret testet her. README indeholder klikvejledningen.

Codespaces-opstartsscriptet blev faktisk kørt efter at have stoppet vores egen server: en ny udviklingsserver blev startet, og HTTP 200 samt LISTEN på `0.0.0.0:3000` blev verificeret. Containerimage-tagget `node:24-bookworm` findes (manifest kontrolleret). Konfigurationens port 3000 og præcise Codespaces-origin er kontrolleret; TypeScript består. Kildekoden er pushet til GitHub og remote-ref verificeret. Et faktisk Codespace er fortsat brugerens næste klik, ikke et allerede udført deployment.

## Rettelse af blokerede kortfliser

- Brugerens screenshot viste OpenStreetMaps policyblokering. Appen kaldte `tile.openstreetmap.org`; `osm.wiki/Blocked` var tekstens hjælpelink. Den præcise udløsende regel i brugerens Codespace er ikke fastslået, da vi ikke har dets netværksheaders. Kilden er fjernet helt fra kortkoden frem for at omgå blokeringen.
- Lokalt Natural Earth 1:10m public-domain landekort er bundlet med kildeangivelse. Danmark, Bornholm og nabolande vises uden nogen tredjeparts-fliseforespørgsler. Dette er en generaliseret oversigt, ikke et gadekort eller virksomhedsdata.
- MapTiler er tilføjet som valgfri, licenseret mørk flisekilde med `NEXT_PUBLIC_MAPTILER_KEY`. `dataviz-v4-dark` blev verificeret som aktuel stil i MapTilers officielle client-js-kilde; den ældre `dataviz-dark` er deprecated. En rigtig kundes API-nøgle er ikke tilgængelig, og live adgang til MapTiler er derfor ikke erklæret verificeret.
- Rigtig Chromium-kontrol uden virksomheds-/kortfixtures: fem geografiske country paths vist, nul eksterne browserforespørgsler til kortudbydere, nul 403-responser, nul JavaScript-fejl og intet vandret mobil-overflow. København-byspring, zoom og centrering på Danmark bestod. Screenshot: `/workspace/WebHunt-map-fixed.png` samt mobilvariant. De er ikke en offentlig previewadresse.
- To særskilte Chromium-kontroller med en eksplicit syntetisk testnøgle og alle MapTiler-requests opsnappet før netværk: HTTP 200 + gyldigt PNG gav indlæste fliser; HTTP 403 + gyldigt fejlbillede gav ingen viste fliser, tydelig advarsel, bevaret lokal geometri og nul nye forespørgsler efter zoom. Ingen testnøgle blev sendt til en rigtig udbyder. Der var nul standard-OSM-fliseforespørgsler i begge cases. Testnøglen blev fjernet ved genstart, og den efterfølgende rigtige browserkontrol brugte ingen MapTiler-nøgle.
- Virksomheds-API'et blev kaldt rigtigt og gav HTTP 503 med `retryAfter: 480`, fordi kilderne var utilgængelige og cachen ikke havde brugbare rigtige data. Brugerfladen viser nu en streg og Data ikke indlæst, ikke et misvisende nulresultat. Manuel genforsøg respekterer ventetiden; der er ingen falske virksomheder.
- 19 domænetests og 11 browser-/API-tests består. Produktionsbuild og TypeScript består. De to særskilte MapTiler-responskontroller er ekstra kontroller, ikke en live test af kundens MapTiler-konto.
- READMEs nye kortafsnit angiver præcis konto-/nøgleoprettelse, begrænsning til faktiske preview-origins, separat Codespaces-konfiguration og genstart/rebuild. Eksisterende Supabase-forhold er uændrede.

## Streets Light and light interface — 2026-10-20

- Switched MapTiler to Streets v4: requested `https://api.maptiler.com/maps/streets-v4/style.json`, followed by that style's raster tile endpoint. Existing `NEXT_PUBLIC_MAPTILER_KEY`, 512 px tiles, zoom offset −1, attribution, zoom, city navigation and colored Leaflet markers retained.
- White navigation/sidebar/panels, pale gray workspace, dark readable text and status labels, mint primary actions; local Natural Earth fallback and app icon updated too.
- `npm run build`, `npm run typecheck`: passed. `npm run test`: 19 passed. `npm run test:e2e`: 12 passed in Chromium, including new light-surface/action/status assertions and existing mobile, map-marker, search/filter, leads, notes, CSV and error flows.
- Isolated configured-key Chromium run: intercepted all MapTiler requests before navigation, supplied a controlled style and PNG fixtures, observed requested Streets v4 style and successful tile loading (19 requests), exercised zoom and city navigation with no page errors. Controlled HTTP 403 showed the explicit fallback and no denied tiles. Fixtures were never sent to MapTiler or included in application data.
- Live MapTiler content, street/building labels and account authorization were not revalidated here: the user's real MapTiler key exists in their Codespace, not this Codex environment. Confirm the real provider after pulling and restarting there. The Streets style supplies its normal labels and geometry; no dark CSS filter is applied.
- Considered a vector renderer, but removed its added dependencies after audit reported an unresolved sanitizer advisory. Final dependency manifests/lockfile remain unchanged; `npm audit --omit=dev`: 0 vulnerabilities.
- Pull with `git pull --ff-only`, restart `npm run dev`, refresh preview. Existing ignored `.env.local` is preserved. No new API key required.

## Persistent Overture catalog — implementation checkpoint, 2026-10-20

- The business API now reads a persistent spatial SQLite catalog or the optional Supabase catalog adapter. It never invokes Overpass or a source cooldown. Imports run separately and atomically; last successful data remains readable without an expiry cutoff. UI starts at Nykøbing Falster and keeps the existing Streets Light map/design.
- Official Overture Places guide, source attribution and Python-client documentation were read from OvertureMaps/docs on GitHub. Current taxonomy changes and per-provider licenses are handled. Unknown sources and Foursquare (until complete upstream NOTICE review) are excluded. Exact accepted license texts accompany responses and CSV exports.
- `npm run data:setup` succeeded with official overturemaps 1.0.2 and Shapely 2.1.2. The actual `npm run data:refresh -- --publish-seed` remains blocked at the official STAC catalog by the running environment's network proxy. No real Nykøbing Falster snapshot has been obtained, and no synthetic business data is included in application data.
- `npm run test`: 25 passed; `npm run typecheck`: passed; `npm run build`: passed; `npm run test:e2e`: 12 Chromium tests passed. One earlier map-overview assertion failed after changing the initial city; it now explicitly selects the Denmark overview before checking country geometry.
- An isolated SQLite file outside application data was exercised through a production server on port 3001 and real HTTP API requests (41 ms observed for one query). Chromium rendered its explicitly labeled test record as a clickable marker and opened the source-aware drawer, with no page errors or Overpass browser requests. This proves the integration, not actual Overture source access. The controlled server was stopped afterward.
- Supabase SQL migration, import, geographic query, anonymous read, denial of anonymous import, and failed-import rollback passed in isolated PGlite/PostgreSQL. The user's actual Supabase catalog is not migrated or live-tested; public credentials do not authorize administrative migrations.
- `npm audit --omit=dev`: 0 vulnerabilities. Actual CVR/Datafordeler terms pages are blocked; no CVR scraping or unverified CVR import is implemented.
- Network requirements, import environment setup and current startup instructions are saved in the Codex environment draft. Saving does not activate or publish them. Live source import and browser validation of actual Nykøbing Falster businesses remain outstanding until the network change is applied.

## Connection diagnosis and delivery correction — 2026-10-20

- Tested every existing Overture destination: STAC, standard/regional S3, Azure and docs. All are denied with CONNECT 403 by the current Codex egress proxy before upstream TLS. Nominatim control returns 200. Both Python and Node fail; proxy variable case precedence and shell network permission were checked and do not explain it.
- Saving the exact unchanged network list succeeds through the backend, with `requires_publish: true`; read-back has the same list/base version. No new domains were added. No tool exposes publication state or the user's UI save error logs, so actual publication is not claimed or assumed.
- Actual `data:refresh -- --publish-seed` still stops at STAC and preserves the empty/previous database. No actual Overture records or fabricated seed were included.
- Fixed latent importer TLS trust propagation, per-stage safe diagnoses, HTTP/process timeouts; offline Python tests cover proxy versus upstream/TLS errors and secret redaction. Added a bounded network doctor and a single pilot-import helper for the user's existing Codespace.
- Discovered `main` had not yet received the catalog feature. The verified catalog and new helpers are being delivered together so pulling main can actually run the persistent importer.

- Final checks for the diagnostic delivery: production build and typecheck passed; 25 Node tests, 6 Python diagnostic tests and 12 Chromium tests passed. The full pilot helper was exercised and correctly stopped at the known CONNECT 403 without changing data. Its successful live-source path remains unverified until run from a machine with working Overture access.
- Reviewed official Node/buildpack-deps Dockerfiles: Python venv/ensurepip was not guaranteed in the previous Codespaces image. Added an explicit Dockerfile for future containers and a root/noninteractive-sudo Debian-package check in the helper for existing Codespaces. This installation branch is syntax-reviewed, not claimed as tested in the user's Codespace. No container rebuild is required just to try the helper.


## Official source identifiers and cached reimport — 2026-10-20

- User's Codespace log confirms successful real STAC/S3 access to Overture 2026-09-23.1 and 1,745 downloaded places, followed by zero normalized records. The underlying raw GeoJSON remains in their Codespace, not accessible to this Codex process.
- Found a concrete allowlist defect against the official OvertureMaps/schema examples (commit b53004401617a0709cd2ee3b872bb3672819078e): provider display names were accepted, but the documented IDs `metaPlaces` and `msftPlaces` were rejected. Added exact aliases to existing CDLA-permissive providers, without allowing unknown/restricted sources. Original source identifiers and entries are retained.
- Failed empty imports now report reason counts and unknown dataset identifiers. Successful snapshots retain rejection counts; failed imports still preserve existing data. Python no longer prints an unhelpful CalledProcessError traceback after a normalization failure.
- Added network-free cached pilot reimport and end-to-end isolated regression test: cached source-ID records → CLI → spatial database → verified count. Unknown-provider input fails and preserves the previous DB and raw file.
- 28 Node tests passed. Production build/typecheck passed. Actual corrected import count and real map markers in the user's Codespace remain to be confirmed by running the cached reimport there. No downloaded real records or fake production records have been inserted in this Codex instance.


## Publisher provenance correction — 2026-10-20

- The user's actual retry reports 1,745 inputs, with rejections unknown_license=1,488, non_business=158, closed=76, missing_category=23. The previous diagnostic counted publisher dataset `Overture` on all 1,745 records as unknown, and Foursquare on 51. This is a provenance-resolution error, not a network failure.
- Source policy now considers the full record. Overture processing entries retain licenses of documented recognized contributors, or an explicit supported publisher license. An unlicensed publisher label alone remains rejected. Unknown/restricted contributors (including Foursquare pending NOTICE review) and conflicting license declarations still reject the complete record. Raw dataset/provider identifiers and original provenance are preserved.
- Added coverage of publisher+Meta/Microsoft, publisher+CC0 source, explicit source licensing, modern provider fields, and combinations with restricted/unknown contributors. Cached CLI integration now includes the publisher entry and proves import, source preservation and rollback on a bad newer file. 31 Node tests and typecheck passed.
- The corrected result for the actual 1,745-row file cannot be observed in this Codex environment; the raw file is in the user's Codespace. A cached reimport there remains the next required verification. No real-company count is fabricated.
# Batchkontrol af identitet — 20. oktober 2026

64 Node-tests og TypeScript-kontrol bestået. Nyt indeks afprøvet med 20.000 syntetiske identiteter; separat CLI afprøvet mod isoleret database med preview, batch/genoptagelse, kilde-/katalogskift, bevaret historik og hjemmesidekontrol. Ingen live masseimport eller browserændring er påstået. Den rigtige virksomhedsdatabase ligger i brugerens Codespace. Officielle CVR-/Datafordeler-indgange og de undersøgte leverandørsider var utilgængelige før upstream via proxyens CONNECT 403. Det beviser ikke udbydernes faktiske tilgængelighed eller tilladelser. Ingen proxy-/TLS-omgåelse eller netværksændring udført.
# Datafordeler-probe — 22. oktober 2026

68 Node-tests og TypeScript-kontrol bestået. ZIP-signatur/range, afbrudt filstrøm, HTTP-fejl, nøglebeskyttelse og manglende nøgle testes med kontrolleret transport. Ingen faktisk nøgle findes i dette miljø; API-værten er blokeret før upstream af HTTPS-proxyens CONNECT 403. Brugers Codespace skal levere det faktiske svar før schema/import kan valideres. Ingen browserkode eller eksisterende data ændret.
