# WebHunt — verificeret 20. oktober 2026

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
