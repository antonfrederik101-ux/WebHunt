# Virksomhedsvalidering og hjemmesidekontrol — 20. oktober 2026

## Hvad der faktisk er konstateret

Den tidligere røde farve blev afledt af et tomt hjemmesidefelt eller en social profil alene.
Den bekræftede hverken aktivitet eller en gennemført søgning efter en hjemmeside. Grå poster
blev ikke automatisk undersøgt: PageSpeed blev kun kaldt fra den enkelte virksomheds knap,
og resultater lå i browseren/private statusser og en midlertidig servercache. Der var ingen
separat aktivitetsmodel, vedvarende kontrolkø eller lukningsfilter.

Brugeren har set cirka 600 poster, heraf cirka 205 røde. Det er observationsoplysninger,
**ikke resultater af denne nye kontrol**. Den tidligere importlog oplyser 1.448 gemte poster;
600 er kortets sidegrænse. Workeren bruger hele den importerede pilotregion, ikke kun første side.

**De faktiske virksomheder og råfilen findes i brugerens Codespace og er ikke tilgængelige i
Codex-instansen. Antal reelt bekræftede aktive/lukkede og røde/orange/grønne er derfor endnu
ikke opgjort her. Der oplyses ikke opdigtede nuller eller testtal som virksomhedsresultater.**

## Hvad opdateringen gør

- Separate statusser: `active`, `closed`, `uncertain`, `missing_data` med kilde, begrundelse og kontroldato.
- Ubekræftet aktivitet giver grå, også hvis hjemmesidefeltet er tomt eller der er en gammel personlig farve.
- Rød kræver en stadig gyldig aktivitetsbekræftelse og gennemgang af registrerede hjemmesidefelter i de anførte kilder. Sociale profiler er separate. Ingen registrering er fortsat ikke bevis for, at en hjemmeside ikke findes.
- Orange/grøn kræver dokumenterede, aktuelle tekniske målinger af den aktuelle webadresse. En personlig dropdown eller HTTP 200 alene er utilstrækkelig. Tidligere personlige valg og analyser slettes ikke.
- En enkelt 404/410 giver ikke orange. Vedvarende 404/410 kan begrunde orange efter mindst to uafhængige observationer med mindst 24 timers mellemrum; der opfindes ingen score. Timeout gør aldrig virksomheden lukket.
- Lukkede virksomheder og sikre dubletkopier fjernes fra det almindelige kortresultat i både API og visning. Kildeposter og kontrolhistorik bevares. Ved import arkiveres udgåede poster frem for at blive slettet.
- Jobs og leases gemmes i SQLite. Afbrydelser kan genoptages, gennemførte kontroller gentages ikke straks, og udbydernes Retry-After respekteres. Seneste fund gemmes pr. virksomhed.
- `/admin` er en separat kontroloversigt med privat nøgle, søgning, statusfilter, jobfremskridt, rapportdownload, kildecheck og historik. Uautoriseret læsning/skrivning afvises. Nøglen gemmes ikke i browseren.
- Gamle kilderesultater kan undersøges; en midlertidig kildenedetid genåbner ikke en tidligere dokumenteret lukning. Aktivitetsbekræftelse udløber efter 30 dage, tekniske farvegrundlag efter 7 dage.

## Kilder og løsning uden CVR-login

Brugeren har valgt **ingen eksisterende CVR-adgang**. Standardforløbet kræver derfor ikke CVR-login:

1. Den allerede hentede, licensgodkendte Overture-råfil genbruges lokalt. Samme-ID, eksplicit `permanently_closed` fra en højst 90 dage gammel udgivelse kan registreres med præcis kilde. `open`, et punkt på kortet, confidence eller en fungerende hjemmeside bliver aldrig alene bevis for aktivitet.
2. En administrator kan uden API-login slå den offentlige kilde op og registrere et **manuelt kildecheck** med kildelink, konkret begrundelse og bekræftet identitetsmatch. Aktivitets- og hjemmesidekontrol er separate felter. Det fremstilles ikke som en automatisk CVR-kontrol.
3. Manglende, modstridende eller utilstrækkelige kilder giver usikker/manglende data. Fravær i et opslag betyder ikke lukket. Kildebelagt navn-/adresseændring kræver afklaring af den gamle placering; koordinater og rå identitet omskrives ikke automatisk.
4. OSM-kilder kan bruges som dokumentation ved et konkret kildecheck. Ingen ny landsdækkende Overpass-scraping, ukontrolleret gratis CVR-tjeneste, beskyttet Virk-endpoint, udbyderrotation eller blokering omgås.

En supplerende officiel CVR-adapter findes kun til ejere med lovlig distributionsadgang
(`CVR_USERNAME`/`CVR_PASSWORD`, server-only). Den har konservativt CVR/navn/adresse-match,
behandler ikke `NORMAL` som automatisk aktiv og afviser flertydige kandidater. Kun nødvendige
virksomhedsfelter efterspørges; deltagere/ejere/personkontakter gemmes ikke. Adapterens **live
adgang og den konkrete upstream-kontrakt er ikke verificeret** med en rigtig konto.
Den er ikke et krav til brugerens valgte forløb og må ikke omtales som gennemført CVR-validering.

Et lovligt CVR-udtræk kan indlæses med `--cvr-file` og en udtrykkelig, højst 30 dage gammel
`exportedAt`/`--cvr-observed-at`. Det mærkes som administratorleveret udtræk, ikke live API.
Det skal være et udtræk, ejeren må behandle. Ukendt JSON-format accepteres ikke som aktivitet.

Officielle referenceadresser:

- https://erhvervsstyrelsen.dk/adgang-til-cvr-data
- https://distribution.virk.dk/cvr-permanent/virksomhed/_search
- https://datacvr.virk.dk/
- https://docs.overturemaps.org/guides/places/
- https://www.openstreetmap.org/copyright

Forsøg fra denne Codex-instans på Erhvervsstyrelsen, CVR-distribution, Datafordeler og
Overture-dokumentation blev afvist i netværkslaget; curl bekræftede CONNECT HTTP 403.
Det er ikke en 403 fra en virksomheds hjemmeside eller dokumentation for en lukning.
Der er ikke ændret domænelister eller påstået, at noget er publiceret i miljøindstillingerne.

## Reel hjemmesidekontrol og score

DNS A/AAAA kontrolleres med tidsgrænse. Private/reserverede adresser, IP-litteraler, credentials,
interne værtsnavne og ukontrollerede porte afvises. Det validerede IP bindes til den faktiske
TCP-forbindelse; hvert redirect valideres igen. Ingen TLS-kontrol deaktiveres.

Robots.txt og adgangsfejl kontrolleres før crawl og før PageSpeed. Betingelser kan ikke
udledes af robots alene; et særskilt crawlforbud skal stadig respekteres af ejeren.
Der bruges en identificerbar WebHunt-agent, højst én forespørgsel pr. origin pr. sekund,
robots crawl-delay, Retry-After, højst fire redirects, maksimale svarstørrelser og korte
HTTP-tidsgrænser. Manglende robots-adgang, DNS, SSL, proxy eller kvote giver en gemt fejl,
ikke en opdigtet analyse. En serverproxy, hvor sikker DNS-binding ikke kan garanteres,
bruges ikke som skjult omvej; kontrollen stoppes og mærkes mislykket.

Google PageSpeed/Lighthouse anvender mobilstrategi og fire kategorier. Alle nødvendige
målinger samt HTTP-audit og viewport skal være til stede før en samlet score:

| Måling                       | Vægt |
| ---------------------------- | ---: |
| Performance                  | 35 % |
| Tilgængelighed               | 25 % |
| SEO                          | 15 % |
| Tekniske best practices      | 15 % |
| Mobil viewport-konfiguration | 10 % |

Grøn kræver score mindst 80, performance mindst 80, tilgængelighed mindst 90, SEO mindst 80,
best practices mindst 90, godkendt viewport og HTTPS. Væsentlige dokumenterede fejl giver
orange, også ved en ellers høj score. Op til tre interne links kontrolleres som en stikprøve.
Både scoremodel, fund og tidspunkt gemmes.

**Dette er en teknisk score, ikke en komplet visuel design- eller brugervenlighedsvurdering.**
Interaktive menuer, formularer og alle navigationstrin bliver ikke browserautomatiseret på
fremmede hjemmesider. Der opfindes ingen designpoint eller AI-vurderinger. Det er en kendt
begrænsning i forhold til hele ønskelisten og skal fremgå før offentlig produktmarkedsføring.

## Kørsel i brugerens eksisterende Codespace

Åbn en **ny terminal med +**, så en kørende udviklingsserver ikke opsluger kommandoen.
Ingen reimport, nulstilling eller genopbygning af containeren er nødvendig.

```bash
npm run verify:pilot -- --limit 20
```

Det starter/genoptager de første 20 ventende kontroller og gemmer rapporten i
`.data/reports/pilot-verification.json`. Gentag for næste batch eller kør uden `--limit`
for resten. `--report-only` læser status uden nye eksterne kontroller. `--force` opretter
et nyt job efter afslutning og tilsidesætter den normale genkontrolfrist, men bevarer de
lovlige kilde-/websitecaches. Ved `deferred` skal kildefristen udløbe, før opgaven kan genoptages.
Et afbrudt `running`-job kan overtages efter sin lease på 10 minutter; det er ikke en
ventetid på Overpass og stopper ikke kortet.

Administratornøglen oprettes separat med `npm run verify:admin`; den gemmes i den ignorerede
`.data/admin-token` med mode 0600, eller ejeren bruger sin servervariabel
`WEBHUNT_ADMIN_TOKEN` (mindst 32 tegn). Åbn `/admin` på den eksisterende previewadresse.
Del ikke nøglen eller et terminalbillede med nøglen i chatten. Intet admin-login udstedes
via offentlige HTTP-kald. Anvend HTTPS og privat Codespace-port til administration.

Den eksisterende `scripts/verify-pilot.ts` til importens læsekontrol er bevaret;
den nye worker ligger i `scripts/validate-pilot.ts`.

## Testbeviser og konkrete begrænsninger

- 58 Node-tests, herunder de otte efterspurgte situationer: aktiv uden site, aktiv med dårligt/godt site, lukket, usikker, midlertidig fejl, dublet, ændret navn/adresse.
- CLI-test mod **607 isolerede testposter**: stop efter fem, genoptag resten, korrekt kildebaseret rapport, alle 607 behandlet frem for første 600, originalt kilde-JSON uændret. Tallene er udelukkende testfixtures, ikke Nykøbing-resultater.
- Transaktions- og genstartstest: lukket post skjules, findes stadig på disk med begge kontrolhistorikker; udgåede importposter arkiveres; gamle personlige vurderinger slettes ikke.
- Browser/API-test dækker beskyttet administration, afvist fremmed kildedomæne, kildebelagt lukning, bevaret kildepost og historik, korrekt kortfiltrering og rapportdownload samt bevaret personlig rød med faktisk grå/usikker kortvisning.
- Produktionsbuild og TypeScript-kontrol består. 19 Chromium-tests består på produktionsbuild, inklusive den rigtige admin/API-/databasevej, markører, klynger, mobil, søgning, leads, CSV og genindlæsning. Tre yderligere MapTiler-transporttests består mod nøglekonfigureret produktionsbuild (Streets v4, zoom/attribution, afviste fliser/stil). De er ikke live analyse af fremmede virksomhedssider. Streets Light og tileintegrationen er bevaret.
- Rigtig kontrol af testdomænet example.com i dette miljø kunne ikke afslutte DNS (`EAI_AGAIN`); ingen score blev beregnet. Det er ikke en bestået live analyse af de faktiske virksomhedssider.
- Den faktiske pilotdatabase findes ikke her. `npm run verify:pilot -- --report-only` stopper tydeligt uden at oprette en tom erstatning eller finde på virksomhedsantal.
- SQLite-kataloget er implementeret. Et særskilt Supabase-katalog kræver en tilsvarende worker-/historikintegration; administration af den opsætning afvises med 501 frem for at skrive til en forkert lokal database. Gamle Supabase-poster uden beviser vises grå med en forklaring.
- Datamodellen har vedvarende jobkø og indekser, men 300.000–500.000 faktiske virksomheder, distribueret drift, en planlagt daemon og automatisk national aktivitetsbekræftelse er **ikke valideret eller leveret**. Ingen nye byer importeres i denne opgave.

Der aktiveres ingen betalt API eller AI-bygger. MapTilers eksisterende abonnement/kvoter
fortsætter. PageSpeed kræver fungerende udgående netværk og tilgængelig kvote; valgfri
`PAGESPEED_API_KEY` skal fortsat være server-only. En nøgle sikrer ikke alene kvote eller
beståede analyser. Hosting og backup af den vedvarende SQLite-disk er ejerens driftsopgave.
