# WebHunt — udviklingsstatus, 20. oktober 2026

## Aktuel opgave: troværdige virksomheds- og hjemmesidestatusser

Den [nye brugeropgave](docs/VERIFICATION_REQUEST.md) udvider det tidligere fase 1–2-omfang med validering, hjemmesidekontrol, vedvarende kø og administration. Se [den aktuelle kontrolrapport](docs/VERIFICATION_REPORT.md) for ændringer, tests og begrænsninger. Brugerens beslutning: **ingen eksisterende CVR-login**. Systemet må ikke fremstille ubekræftet aktivitet som aktiv.

Implementeret: separate aktivitetsstatusser, kilde-/kontrolhistorik, arkivering frem for sletning, luknings-/dubletfilter, konservativ kildevurdering, kildebelagt manuelt check uden CVR-login, DNS-/SSRF-/robots-beskyttet kontrol, komplet teknisk score, vedvarende caches, genoptagelige jobs, privat `/admin` og faktiske rapporttal. Import- og læsekontrolscripts er bevaret.

Brugerens Codespace har nu rapporteret 20 forsøg af 1.448 poster: 16 jobopgaver færdigbehandlet, 4 udsat, ingen dengang bekræftet aktive/lukkede. En redirect-fejl i robots.txt er rettet; brugerens efterfølgende kontrol og browserbillede bekræfter en gemt Lighthouse-score på 83 for Cc Clothing. Brugerens CVR-skærmbillede viser CC-Clothing, CVR 41941553, aktiv, Randersvej 10, 4800 Nykøbing F samt aktiv P-enhed 1026584775. Denne aktivitetsbekræftelse er endnu ikke gemt i brugerens database. Databasen og PageSpeed-nøglen findes kun i brugerens Codespace. Automatisk national aktivitet, fuld visuel UX-vurdering og produktionsdrift i stor skala er ikke verificeret. Ingen nye byer eller AI-bygger aktiveres.

Nedenstående fasebeskrivelse og tidligere testresultater er historisk baggrund fra forrige levering. Nye regler i kontrolrapporten har forrang, herunder at personlige farver ikke erstatter aktivitetsbevis.

Omfang: **kun fase 1 og fase 2**. [Brugerens fulde masterplan](docs/PROJECT_ROADMAP.md)
er gemt uændret som langsigtet plan. Fase 3–7 er ikke påbegyndt i denne leverance.

## Udgangspunkt og databevarelse

- Next.js 16.4.2, React 19, TypeScript, Tailwind/CSS, Leaflet/markercluster og MapTiler Streets v4 Light.
- Virksomheder ligger i vedvarende SQLite med WAL og R-tree. Supabase-katalogadapteren bevares. Private leads/statusser bruger fortsat browserlagring eller de eksisterende Supabase-tabeller med RLS.
- Brugerens Codespace-log bekræfter **1.448 rigtige importerede virksomheder**, Overture `2026-09-23.1`, efter 297 afvisninger af 1.745 hentede poster. Databasen og råfilen findes i brugerens Codespace, ikke i denne Codex-instans. Dette antal er brugerens bekræftede importresultat, ikke en ny måling herfra.
- Eksisterende data kræver **ingen genimport**. Ingen miljøfil, eksisterende seed, brugervurdering eller lead er overskrevet. Testvirksomheder findes kun i eksplicitte browserfixtures og isolerede midlertidige databaser uden for projektets datalager.
- Opstartsdata må nu kun initialisere et manglende område, aldrig automatisk erstatte brugerens eksisterende import. Opdatering af ét importområde rydder kun tidligere medlemmer af netop dette område, ikke uvedkommende rækker.

## Fase 1 — implementeret og testet

**Ændringer:** Gennemgået import, licenspolitik, spatial database, HTTP-API, indlæsning, previewstart og privat lagring. Rettet fejl ved uventede JSON-felttyper, valg af den første af flere hjemmesideadresser og adskillelse af sociale profiler. Ukendte/restriktive licenser afvises fortsat. Udgivelse `.10` sammenlignes numerisk efter `.2`, både i SQLite og Supabase-SQL.

Søgning og branchefilter udføres nu på hele det importerede kortudsnit i databasen med stabile sider på højst 600 poster, faktiske totaler og revisionskontrol. Browseren afbryder forældede forespørgsler. En mislykket analyse sletter ikke længere en tidligere personlig vurdering. Kortets forsinkede callbacks stopper ved navigation væk fra kortet; virksomhedslisten kan indlæses, før kortet starter.

Previewstart kontrollerer appidentitet på `/api/ready` og præcis port 3000, genbruger en kørende server, forebygger dobbeltstart og logger til `.data/logs/preview.log`. Den flytter ikke automatisk til en anden port og stopper ikke ukendte processer.

**Primære filer:** `scripts/import-places.ts`, `lib/overture.ts`, `lib/websites.ts`, `lib/releases.ts`, `lib/business-catalog.ts`, `lib/catalog-query.ts`, `lib/catalog-service.ts`, `app/api/businesses/route.ts`, `app/api/ready/route.ts`, `scripts/start-preview.sh`, `supabase/business-catalog.sql`.

**Beviser:** 38 Node-tests består, inkl. malformed JSON, cached CLI-import, transaktionsrollback, udgivelsesrækkefølge, søgning efter første side, uændret kilde-JSON, bevaring af andre områders data og seed, der ikke erstatter eksisterende brugerdata. Supabase-SQL er kørt i isoleret PostgreSQL/PGlite: 707 poster, sider på 600 + 107, branche-/navnesøgning, numeriske udgivelser, anon-læsning, afvist anon-skrivning/import og bevaring af uvedkommende poster. Ingen migration er kørt i brugerens Supabase.

## Fase 2 — implementeret og funktionstestet

**Ændringer:** Danmark er standardudsnit. Den eksisterende hvide sidebar, lysegrå baggrund, mørke tekst, mintknapper og MapTiler Streets v4 Light er bevaret. Zoom, panorering, bygenveje, stedssøgning og detaljer fra den eksisterende kortudbyder bevares.

- **Rød:** ingen registreret selvstændig hjemmeside, inklusive sociale profiler alene. Panelet forklarer, at det ikke er bevis for, at en hjemmeside mangler.
- **Orange/grøn:** eksisterende teknisk eller personlig vurdering. Ingen ny crawler eller automatisk vurderingsmotor er bygget.
- **Grå:** registreret hjemmeside uden gennemført vurdering eller personligt valgt usikkerhed. Alle tidligere personlige valg bevares, også grå.
- Klynger viser en ring med de repræsenterede statusfarvers fordeling, antal og læsbar beskrivelse. Farver afhænger af de faktiske viste opslag.
- Panelet viser begrundelse, datagrundlag, kendt kontroldato, kontaktoplysninger, sociale profiler, eventuelt CVR, kilde og licens. Manglende oplysninger opfindes ikke.
- Søgning understøtter navn, adresse, by, postnummer, branche og CVR, når feltet er til stede. Lokale byforslag kræver ingen ekstern geokodning. Flere resultater hentes med en tydelig knap, uden dublerede ID'er.
- Databasens samlede antal, antallet i søgningen og indlæste/viste poster adskilles. Statusfarvefiltre og farvetællinger gælder udtrykkeligt de indlæste poster, så personlige vurderinger også medregnes.

**Primære filer:** `components/HuntApp.tsx`, `components/DenmarkMap.tsx`, `app/globals.css`, `lib/business-status.ts`, `lib/types.ts`, `lib/businesses.ts`.

**Beviser:** 16 Chromium-tests består på produktionsbuild uden kortnøgle: klikbar markør, blandede klynger, alle statusfarver, filtre, sociale profiler, begrundelser, byforslag, søgning, flere resultater, mobil, hurtig navigation, leads, noter, CSV og genindlæsning. 3 yderligere Chromium-tests består mod nøglekonfigureret preview med kontrollerede MapTiler-svar: Streets-v4-tileindlæsning og gadezoom, attribution, HTTP 403 på stil og HTTP 403 på fliser stopper nye forsøg og viser lokal reservegeometri. Disse tre tests beviser browseradfærd med kontrolleret transport, ikke live udbydertilgængelighed.

## Samlet validering og grænser

- `npm test`: **38 bestået**. `npm run typecheck` og produktionsbuild består.
- Produktionsbrowserkontrol: `env -u NEXT_PUBLIC_MAPTILER_KEY npm run build`, derefter `env -u NEXT_PUBLIC_MAPTILER_KEY npm run test:e2e` (16 almindelige tests; særskilte MapTiler-tests kræver flag).
- Konfigureret preview: `WEBHUNT_TEST_MAPTILER=1 npm run test:e2e -- tests/browser/maptiler.spec.ts` (3 bestået). Brug en eksisterende udviklingsserver med den rigtige miljøkonfiguration.
- Rigtig HTTP-API mod separat 707-posters SQLite: sider 600 + 107, sidste post fundet med dansk navn og branchefilter, SQL-injektionsstreng matcher ingen poster, kilde-JSON uændret efter læsning.
- Starthelperen er faktisk kørt: WebHunt bliver klar på port 3000; anden kørsel genbruger serveren; `/api/ready` returnerer den korrekte appidentitet.
- Live MapTiler med eksisterende nøgle og normal TLS: Streets-v4 `style.json` **HTTP 200**, gyldigt v8-stilformat; rigtige PNG-fliser ved lands- og gadezoom **HTTP 200**, henholdsvis 78.963 og 26.506 bytes. Ingen 403 i disse live kald.
- **Begrænsning:** Direkte Chromium-kald til live MapTiler får `ERR_CERT_AUTHORITY_INVALID` i dette Codex-miljø. Automatisk godkendelseskontrol afviste permanent import af miljøets CA i browserens certifikatlager. Ingen TLS-kontrol er slået fra, og ingen udbyderblokering er omgået. Live flisevisning i Chromium herfra er derfor ikke verificeret; den eksisterende kortintegration, som allerede virker i brugerens Codespace, er bevaret.
- Brugerens faktiske database på 1.448 poster er ikke tilgængelig her. Bevarings- og funktionstest er udført med isolerede data; en ny kontrol i brugerens Codespace er ikke foregivet.
- Ingen påstand om landsdækkende virksomhedsdata eller dokumenteret kapacitet ved 500.000 opslag. Det hører til senere faser. Databasefilen kræver fortsat vedvarende disk og egen backup ved hosting.

## Eksterne tjenester og omkostninger

Ingen nye API-nøgler, abonnementer eller betalte funktioner kræves af denne opdatering. Eksisterende `NEXT_PUBLIC_MAPTILER_KEY` og Supabase-konfiguration bevares. MapTilers eksisterende plan/kvoter og eventuel hosting/Supabase-plan gælder fortsat. Kortforespørgsler har den eksisterende attribution og normale browseridentitet; ingen providerrotation eller skjult proxy er tilføjet.

Standardopsætningen med SQLite kræver ingen SQL-handling. Hvis kataloget særskilt er sat til `WEBHUNT_CATALOG_BACKEND=supabase`, kan den additive opdatering i `supabase/business-catalog.sql` køres af ejeren for at aktivere fuld katalogsøgning. Før opdateringen bevares læsning via den gamle RPC med en synlig begrænsning til de tidligere 600 poster. Private RLS-tabeller ændres ikke.

## Senere faser — ikke implementeret

3. Nye datakilder, gradvis landsimport og yderligere infrastruktur til store datamængder.
4. Ny crawler, gentagne HTTP-/DNS-kontroller og udvidet kvalitetsscore.
5. Hjemmesidegenerator, AI/manuel redigering og versionshistorik.
6. Nye projekt-/kunde-/demodelingsfunktioner.
7. Produktionsoptimering og validering med 300.000–500.000 faktiske opslag.

Eksisterende login, analyser, private leads, noter, statusser og CSV er bevaret. Ingen funktionsløse knapper til de senere faser er tilføjet.
# Fortsættelse: batchidentitet før udvidelse til 20.000 virksomheder

Separat, kildebaseret `verify:identities`-worker er implementeret og afkoblet fra PageSpeed. Skrivebeskyttet preview, indekserede match, SHA-256-proveniens, genoptagelse og bevarelse af tidligere hjemmesidekontroller. Et nyt udtræk kan ikke blive skjult af cachen fra et ældre/live CVR-opslag. Se [batchvejledningen](docs/BULK_IDENTITY.md).

64 Node-tests samt TypeScript-kontrol. 20.000 testidentiteter er syntetiske; der er ikke hentet 20.000 rigtige virksomheder. Faktisk masseadgang og vilkår kunne ikke verificeres, fordi miljøproxyen afviste de testede officielle datakilder med CONNECT 403. Næste afhængighed er dokumenteret kildeadgang og et faktisk datasample. Ingen abonnementer, scheduler eller ny ekstern udbyder er aktiveret. Eksisterende Codespace-database og brugerens miljøvariabler er ikke tilgængelige eller ændret her.
