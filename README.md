# WebHunt

Dansk virksomhedskort til webdesignere. Next.js 16, React 19, TypeScript, Tailwind CSS 4, Leaflet/markercluster, Lucide og Supabase. Lyst tema med hvid sidebar, lysegrå baggrund, mørk tekst og mintgrønne knapper. MapTiler Streets v4 viser det detaljerede gadekort.

## Aktuel leverance: virksomhedsvalidering og hjemmesidekontrol

Se [kontrolrapporten](docs/VERIFICATION_REPORT.md) for ny datamodel, kilder, score, tests og kendte begrænsninger.

Kontrol af større, daterede CVR-udtræk kan køres separat fra hjemmesideanalysen med `verify:identities`. Se [batchvejledningen](docs/BULK_IDENTITY.md). Kommandoen kræver et faktisk, lovligt indhentet JSON-udtræk og vælger ikke automatisk en dataleverandør.

Datafordeler-filadgang testes separat med `npm run data:cvr:check` og servervariablen `DATAFORDELER_API_KEY`. Testen ændrer ingen virksomhedsdata og downloader ikke et helt udtræk. Se [forbindelsestesten og dens begrænsninger](docs/DATAFORDELER.md).
Lukkede poster skjules og bevares i databasen. Ubekræftede virksomheder er grå; en personlig farve eller et tomt hjemmesidefelt er ikke aktivitetsbevis.
`npm run verify:pilot -- --limit 20` starter/genoptager en batch i det eksisterende Codespace.
Den faktiske Nykøbing-rapport kan først opgøres, når workeren er kørt på databasen dér.
CVR-login er ikke påkrævet: kildebelagt manuelt opslag understøttes i `/admin`; manglende automatisk dokumentation bliver usikker.
Ingen nye byer eller AI-hjemmesidebygger er startet.

## Tidligere leverance: fase 1 og 2

Se [udviklingsstatus og testbeviser](DEVELOPMENT_PROGRESS.md). Resten af
[masterplanen](docs/PROJECT_ROADMAP.md) er gemt som senere arbejde.
Eksisterende virksomhedsdata, leads, vurderinger og miljøfiler bevares.
Denne opdatering kræver ingen genimport og ingen nye nøgler eller abonnementer.

I et eksisterende Codespace: kør `git pull --ff-only && bash scripts/start-preview.sh`.
Startscriptet kontrollerer WebHunt på præcis port 3000, genbruger en kørende server
og skriver fejl i `.data/logs/preview.log`. Åbn derefter port 3000 under **Ports**.
En genopbygning af containeren er ikke nødvendig.

## Start lokalt

Kræver Node.js 24.5+ (testet med 24.19.0, fastlagt i `.nvmrc`) og npm.

```bash
cd /workspace/WebHunt
npm ci
cp .env.example .env.local # kun hvis filen ikke findes i forvejen
npm run dev
```

Åbn appen på port 3000 i din lokale browser. Produktionskørsel: `npm run build` og derefter `npm start`. Hemmelige værdier skal ligge i miljøvariabler eller den ignorerede `.env.local`, aldrig i Git.

Startkommandoerne aktiverer Nodes officielle `--use-env-proxy`, så eksisterende HTTPS_PROXY/HTTP_PROXY/NO_PROXY benyttes i cloudmiljøet uden at ændre TLS-kontrollen. Uden proxyvariabler bruges normal direkte forbindelse.

Det lokale geografiske oversigtskort og søgning i egen virksomhedsdatabase kræver ingen API-nøgle. Gade-/detaljekortet kræver den eksisterende `NEXT_PUBLIC_MAPTILER_KEY`. Uden Supabase kan du bruge lokale leads, noter og vurderinger i browserens localStorage. Det er udtrykkeligt mærket som lokal tilstand; det er ikke permanent databaselagring, og slettede browserdata kan ikke genskabes. Ingen opdigtede virksomheder bruges som fallback. Uden adgang til datakilden vises en fejl og en genforsøgsknap.

## Funktioner

- Danmarkskort inkl. Bornholm, øer, zoom, panorering, clustering og klikbare virksomhedsmarkører.
- Virksomheder læses fra egen vedvarende database. Første importområde er Nykøbing Falster; flere områder kan tilføjes via importjobbet. Det er ikke et komplet CVR-register.
- Overture Places importeres separat fra kortet. Zoom og søgning kontakter kun egen database, aldrig Overpass. Sider på højst 600 virksomheder; “Indlæs flere virksomheder” henter næste side. Dækning, faktiske antal og dato vises tydeligt.
- Navn, adresse, by, postnummer, branche og eventuelt CVR søges i hele det importerede kortudsnit i databasen, også efter de første 600 poster. Byforslag navigerer uden geokodning; “Søg som sted” og ukendte postnumre bruger Nominatim.
- Branche- og statusfiltre. Rød kræver bekræftet aktivitet og kildegennemgang uden registreret selvstændig hjemmeside. Orange/grøn kræver aktuelle, dokumenterede målinger. Usikker aktivitet eller utilstrækkelig hjemmesidekontrol er grå. Gamle personlige valg bevares separat og giver ikke aktivitetsbevis. Farvetællinger og filtre gælder de indlæste poster; blandede klynger viser alle repræsenterede farver. Importerede råstatusser og gemte vurderinger omskrives ikke.
- Virksomhedspanel med kildelink, kontaktkopiering, telefon-/hjemmesidelink, manuel status, analyse og gem som lead.
- Leads med noter, kontaktstatus, dato, sletning og CSV-eksport (inkl. beskyttelse mod simple regnearksformler).
- Statistik over det faktisk indlæste datasæt og brugerens egne leads. Ingen simulerede tal.
- E-mail/password-login, kontooprettelse, e-mailbekræftelse og password recovery via Supabase. Privat database med Row Level Security.

## Supabase: aktiver login og database

1. Opret et Supabase-projekt på https://supabase.com. Vælg en passende EU-region og gennemgå databehandleraftale og dine GDPR-forpligtelser.
2. Kør hele `supabase/schema.sql` i projektets **SQL Editor**. Scriptet kan køres igen uden at slette leads. Det opretter `leads` og `business_statuses`, aktiverer RLS og begrænser både læsning og ændringer til `auth.uid() = user_id`. Anonyme roller har ingen adgang til tabellerne.
3. Under projektets API-indstillinger kopieres projektets URL og offentlige **anon/publishable key** til:

   ```dotenv
   NEXT_PUBLIC_SUPABASE_URL=https://DIT-PROJEKT.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=DIN-OFFENTLIGE-NØGLE
   ```

   Anvend aldrig en service-role-/secret-nøgle her. `NEXT_PUBLIC_`-værdier er synlige i browseren; sikkerheden ligger i Auth og RLS.

4. I **Authentication → URL Configuration** sættes Site URL til appens faktiske adresse. Tilføj den præcise `/auth/callback`-adresse til Redirect URLs, også callback med `?recovery=1` for nulstilling. Under lokal udvikling bruges appens lokale origin; ved hosting skal produktionsdomænet tilføjes. Standardtemplates med `{{ .ConfirmationURL }}` understøttes.
5. Behold e-mailbekræftelse slået til. Konfigurer SMTP hos Supabase til stabil e-maillevering i produktion, og gennemgå Auth-rate limits/password-policy.
6. Genstart udviklingsserveren. `NEXT_PUBLIC_`-værdier indlejres ved build: kør et nyt `npm run build`, før produktionsserveren genstartes.
7. Opret konto og bekræft din e-mail. Lokale gæsteleads importeres ikke automatisk; de forbliver separat i browseren og kan eksporteres før login.

**Verifikation af isolation før offentlig drift:** Opret to separate testkonti A og B. Gem et lead og en vurdering som A. Kontrollér i B, at A's data hverken kan læses, opdateres eller slettes — også ved direkte Supabase-forespørgsler med A's `user_id`. Udloggede forespørgsler må ikke returnere private rækker. SQL-politikkerne håndhæver dette; en rigtig integrationstest kræver et konfigureret projekt og kan ikke erstattes af en UI-test.

## PageSpeed Insights

Analysen kaldes fra `POST /api/analyze`. Google henter den angivne offentlige hjemmeside; appserveren henter ikke vilkårlige hjemmesider direkte. URL'er med lokale IP-adresser, credentials, særlige porte og ikke-HTTP-protokoller afvises.

Uden nøgle afprøves Googles anonyme kvote, som ofte er begrænset. For stabil adgang:

1. Opret et Google Cloud-projekt og aktivér **PageSpeed Insights API**.
2. Opret en API-nøgle, begræns den til PageSpeed Insights API og til serverens IP, hvis din hosting giver en stabil udgående IP.
3. Sæt `PAGESPEED_API_KEY` som servermiljøvariabel. Den må aldrig have `NEXT_PUBLIC_`-præfiks. Genstart serveren.

Kontrollen gemmes vedvarende, validerer DNS/adresser og redirects mod SSRF, respekterer robots og Retry-After og kræver alle nødvendige Lighthouse-målinger før en score. Modellen er performance 35 %, accessibility 25 %, SEO 15 %, best practices 15 % og viewport 10 %. Det er en teknisk score; visuelt design og komplette brugerflows er ikke verificeret. En enkelt timeout eller 404/410 giver ikke orange eller lukket virksomhed. Se [præcis model, sikkerhedsgrænser og kørsel](docs/VERIFICATION_REPORT.md).

## Virksomhedsdata, database og licens

Pilotimport i det eksisterende Codespace efter opdatering af koden:

```bash
bash scripts/import-pilot.sh
```

Kommandoen kontrollerer først den faktiske netværksadgang og importerer kun
Nykøbing Falster. Den skal gennemføre med et reelt antal virksomheder, før
visning af rigtige Overture-virksomheder kan bekræftes.

Læs [database- og kildebeslutningen](docs/business-data.md) for Overture Places,
undersøgelsen af danske registre, importkommandoer, licenser, vedvarende SQLite og
Supabase som fælles database. Den nye API bruger ikke længere Overpass.

Kortet starter ved Nykøbing Falster. **Uden en verificeret import vises en tydelig
besked; der indsættes ingen testvirksomheder.** Overpass-ventetider blokerer ikke
kortet. Eksisterende private leads og historiske OSM-kilder bevares med deres egne
kildeangivelser.

Webserveren behøver fortsat adgang til `api.maptiler.com`, `nominatim.openstreetmap.org`,
`www.googleapis.com` og dit Supabase-projekt. Importjobbet behøver separat adgang til
`stac.overturemaps.org`, `overturemaps-us-west-2.s3.amazonaws.com` og
`overturemaps-us-west-2.s3.us-west-2.amazonaws.com`. Installation benytter npm/PyPI.

## Test

```bash
npm run test          # data, bounds, URL-validering, scoring og CSV
npm run typecheck
npm run build
npm run test:e2e      # starter produktionsserveren på port 3000
```

Browserprøverne bruger Chromium på `/usr/bin/chromium` i dette cloudmiljø. På andre maskiner: sæt `CHROMIUM_PATH` til en lokal Chrome/Chromium-installation. Browserprøverne bruger eksplicitte testfixtures og blokerer kortfliser; de beviser UI-funktioner, ikke live Overture/Google-adgang eller Supabase-isolation. Fixtures bruges aldrig i den kørende app. `npm run format` formaterer kildekoden med Prettier.

## Projektstruktur

- `app/`: Next App Router, layout og API-ruter for geografisk data, geokodning og analyse.
- `components/DenmarkMap.tsx`: klientindlæst Leaflet med clustering; ingen Leaflet i SSR.
- `components/HuntApp.tsx`: kort, virksomhedsvisning, leads, statistik, indstillinger og Auth.
- `lib/`: fælles typer, datanormalisering, sikker URL-/CSV-behandling, analyse og Supabase-klient.
- `supabase/schema.sql`: database og ejerbaserede adgangspolitikker.
- `tests/`: domænetests og browserforløb.

Ingen credentials, opdigtede virksomhedsdata, tracking eller tredjepartsfonte er indbygget.

## Åbn hjemmesiden og gem på GitHub

Et publiceret **Codex-cloudmiljø er et udviklingssnapshot**, ikke en offentlig webhosting. Der oprettes ikke automatisk en hjemmesideadresse. Denne session har ingen funktion til at oprette en offentlig browser-previewadresse. Den lokale browseradresse virker på den computer, hvor udviklingsserveren kører.

### Gem de aktuelle projektfiler på GitHub

Kildekoden er nu committet og pushet til `main` i GitHub-repositoryet. Du kan gå direkte til Codespaces-vejledningen nedenfor. Følgende viser, hvordan kildekode gemmes fra en terminal med adgang til projektfilerne:

```bash
cd /workspace/WebHunt
git status --short
git add .
git diff --cached --stat
git commit -m "Build WebHunt with resilient OSM cache and Supabase integration"
git branch -M main
git push -u origin main
```

Kontrollér listen før commit: `.env.local`, andre `.env`-filer, `.data/`, `.next/` og `node_modules/` skal være udeladt; `.env.example` skal med. Hvis Git mangler din identitet, brug `git config user.name "Dit navn"` og `git config user.email "Din GitHub-e-mail"` og gentag commit. Hvis push afvises, undersøg årsagen; brug ikke force-push. Repositoryets origin er allerede GitHub-projektet `antonfrederik101-ux/WebHunt`. Koden er ikke automatisk gemt på GitHub, blot fordi cloudmiljøet er publiceret.

Hvis du ikke har en terminal med projektfilerne: hent det klargjorte `WebHunt-source.zip`, pak det ud, og upload filerne via GitHub → dit WebHunt-repository → **uploading an existing file** (tomt repository) eller **Add file → Upload files**. Upload de udpakkede filer og mapper, ikke selve ZIP-filen. Husk de skjulte `.gitignore`, `.nvmrc` og `.env.example`. Arkivet indeholder ikke nøgler, miljøværdier, cache, afhængigheder eller Git-metadata. GitHub-arkivet er en alternativ måde at overføre kildekoden på; det er ikke et deployment.

### Åbn derefter på din egen computer

Installer Node.js 24.5+ og Git, og kør efter GitHub-lagringen:

```bash
git clone https://github.com/antonfrederik101-ux/WebHunt.git
cd WebHunt
npm ci
cp .env.example .env.local
```

Opret kun `.env.local`, hvis den ikke allerede findes. Indsæt dine egne Supabase-værdier i filen (de bliver ikke automatisk overført fra cloudmiljøet). Gem aldrig en service-role-nøgle i en `NEXT_PUBLIC_`-variabel. Tilføj kun din egen faktiske PageSpeed-nøgle lokalt — en cloud-proxybinding kan ikke kopieres som en almindelig nøgle.

Kør derefter `npm run dev`, og skriv **http://localhost:3000** i browserens adresselinje. Hold terminalen åben. Hvis port 3000 er optaget og Next vælger en anden port, anvend den port, terminalen viser. I Windows kan `.env.example` kopieres via Stifinder eller `Copy-Item .env.example .env.local` i PowerShell.

I Supabase → SQL Editor → New query indsættes hele `supabase/schema.sql`, hvorefter du vælger **Run**. Sæt Site URL til den aktuelle appadresse og tillad `/auth/callback` samt `/auth/callback?recovery=1` som redirectadresser. Åbn appens **Indstillinger → Test forbindelsen**, opret/log ind på din egen konto, gem et lead og kontrollér det efter genindlæsning. Brug to separate konti til den beskrevne isolationstest.

Til en offentlig hjemmeside skal koden deployes til en Node-host med HTTPS og vedvarende lager. Byg med `npm run build`, start med `npm start`, og tilføj det faktiske domæne til Supabases redirectadresser. En offentlig URL kan først oplyses, når en konkret hosting er valgt og et deployment er gennemført.

## Nemmeste online-test: GitHub Codespaces

En browser på din computer kan ikke åbne Codex-maskinens `localhost`. Denne Codex-session tilbyder ikke et værktøj til direkte browser-preview eller port forwarding. GitHub Codespaces giver en privat browseradresse og kræver ingen lokal Node-installation.

Projektet indeholder nu `.devcontainer/devcontainer.json`, som vælger Node 24, installerer afhængighederne, starter WebHunt og videresender port 3000. `next.config.ts` tillader den konkrete Codespaces-previewhost til udviklingsfilerne. Porten behøver ikke gøres offentlig.

1. Kildekoden og Codespaces-konfigurationen ligger nu på `main` i GitHub. Fortsæt til trin 2. Som reservevej ved en senere overførsel, hvis direkte push ikke lykkes, hent den opdaterede `WebHunt-source.zip`, pak den ud, og brug GitHub → **Add file → Upload files** (eller **uploading an existing file** i et tomt repository). Upload indholdet af mappen `WebHunt`, inklusive `.devcontainer`, `.gitignore`, `.nvmrc` og `.env.example`, og vælg **Commit changes**. Upload ikke ZIP-filen som én fil.
2. På repositoryets forside vælger du den grønne **Code**-knap → fanen **Codespaces** → **Create codespace on main**. Du kan også åbne https://codespaces.new/antonfrederik101-ux/WebHunt og vælge **Create codespace**, når filerne er gemt.
3. Vent på, at browsereditoren åbner, og containeren installerer afhængighederne. Appens port 3000 åbnes automatisk, når klienten understøtter automatisk åbning.
4. Hvis ingen fane åbner: Vælg **Ports** i nederste panel i editoren. Hvis panelet er skjult, vælg **Terminal → New Terminal** og derefter fanen **Ports**. Find rækken **3000 / WebHunt**, peg på den, og klik på globusikonet **Open in Browser**. Alternativt højreklik på rækken og vælg **Open in Browser**. Brug adressen, GitHub åbner — ikke `localhost` på din computer. Behold portens synlighed **Private** og brug din egen GitHub-login-session.
5. Hvis port 3000 mangler: Vælg **Terminal → New Terminal**, skriv `npm run dev`, og vent på **Ready**. I **Ports** vælger du derefter **Forward a Port**, skriver `3000` og vælger **Open in Browser**.

Kortvisning og lokale leads kan testes uden Supabase-konfiguration. Cloudmiljøets variabler overføres ikke automatisk til Codespaces. For login/database:

- Vælg **Terminal → New Terminal**, kør `cp .env.example .env.local` én gang, og åbn `.env.local` i filoversigten. Overskriv ikke en eksisterende konfiguration. Indsæt dine egne Supabase-værdier; filen er Git-ignoreret. Genstart `npm run dev`, hvis serveren allerede kører, så den læser de nye værdier.
- I Supabase kører du `supabase/schema.sql` i **SQL Editor**. Brug derefter den konkrete Codespaces-browseradresse som **Site URL** og tilføj dens `/auth/callback` og `/auth/callback?recovery=1` under **Authentication → URL Configuration → Redirect URLs**. Previewdomænet er specifikt for dit codespace; kopiér det fra den åbne fane.
- Kontrollér **Indstillinger → Test forbindelsen** i WebHunt. Virksomheder kræver en færdig import til eget katalog; det er uafhængigt af, om previewserveren kan åbnes. Datafejl må ikke forveksles med forbindelsesfejlen `ERR_CONNECTION_REFUSED`.

Hvis browsereditoren er åben, men en gammel codespace ikke bruger den nye opsætning, åbn kommandopaletten med **F1**, vælg **Codespaces: Rebuild Container**, og følg porttrinnene igen. Codespaces er et udviklingsmiljø, ikke permanent offentlig webhosting.

## Kortrettelse: lokal oversigt og licenseret MapTiler

OpenStreetMaps standardfliser på `tile.openstreetmap.org` er helt fjernet fra appens kortkode. `osm.wiki/Blocked` i fejlflisen var et hjælpelink, ikke den kaldte kortserver. Skærmbilledet dokumenterer en policyblokering; uden netværksheaderne fra brugerens Codespace kan den præcise udløsende regel ikke fastslås. Appen forsøger ikke at løse dette med skjult proxying, falsk User-Agent/Referer, nye IP-adresser eller rotation mellem gratis fliseservere.

**Kortet virker uden nøgle som geografisk oversigt:** `public/maps/denmark-context.geojson` er et lokalt udtræk af Natural Earth 1:10m public-domain geometri for Danmark og nabolande. Bornholm er med. Kilde og vilkår er angivet i `public/maps/NOTICE.md`. Det er et generaliseret landeoversigtskort, ikke et gadekort eller en virksomhedsdatakilde. Leaflet-pan/zoom, bysøgning, clustering og farvede virksomhedsmarkører er bevaret. Bysøgning og rigtige virksomheder kræver fortsat deres egne datakilders tilgængelighed.

**Aktivér lyst gade-/detaljekort fra MapTiler:**

1. Opret/log ind på en konto på https://cloud.maptiler.com/ og vælg en plan, der tillader din forventede brug og trafik. Gennemgå MapTilers aktuelle vilkår og kvoter.
2. Åbn **API keys**: https://cloud.maptiler.com/account/keys/ . Opret en særskilt nøgle til WebHunt via **New key** / **Create key**.
3. Begræns nøglen til appens faktiske HTTP-origins under nøglens indstillinger for tilladte origins. For Codespaces kopierer du den konkrete previewadresse fra browseren (adresse med `-3000.app.github.dev`), ikke editoradressen på `github.dev`. Tilføj kun lokal origin, hvis du bruger den, og dit egentlige produktionsdomæne ved deployment. Undgå en ubegrænset nøgle.
4. I **dit Codespace**: åbn `.env.local` (opret filen i projektroden, hvis den mangler). Tilføj:

   ```dotenv
   NEXT_PUBLIC_MAPTILER_KEY=DIN_EGEN_MAPTILER_NØGLE
   ```

   Bevar eksisterende Supabase-/Google-værdier. Nøglen er en browsernøgle og indgår i kortforespørgslerne; derfor er domænebegrænsning og kvoter nødvendige. Brug ikke en privat administrationsnøgle. `.env.local` er Git-ignoreret og må ikke committes. Send ikke nøglen i chat. Codex- og Codespaces-miljøvariabler er separate.

5. Genstart udviklingsserveren. Hvis den kører i terminalen, tryk **Ctrl+C** og kør `npm run dev` igen. Ved automatisk baggrundsstart kan du vælge **F1 → Codespaces: Rebuild Container**, som bevarer projektets ignorerede lokale fil og genstarter appen. Produktionsserveren kræver et nyt `npm run build`, fordi `NEXT_PUBLIC_` indlejres ved build.
6. Genindlæs browser-previewen. Kortet skal vise **MapTiler Streets Light · gader, bynavne og bygninger**. Ved HTTP 401/403 vises en tydelig adgangsfejl og det lokale oversigtskort; appen stopper nye kortforespørgsler i den session og skifter ikke til en anden ekstern leverandør. Kontrollér nøgle, origins, plan og kvote i MapTiler.

MapTiler-layeren indlæser `https://api.maptiler.com/maps/streets-v4/style.json` med den eksisterende `NEXT_PUBLIC_MAPTILER_KEY`. Efter kontrol af style.json bruges MapTilers tilhørende Streets v4-rasterfliser i Leaflet (512 px, zoom-offset −1), så bynavne, veje, gader og bygninger bevares på de relevante zoomniveauer. Stilen bliver ikke filtreret eller farvet mørk. Ved udbyderfejl vises en tydelig besked og det lokale oversigtskort. MapTiler- og OSM-kildeangivelse bevares. Nøglen tilføjes kun til MapTilers egen origin. Der bruges almindelig browseridentitet og ægte origin-referrer uden proxy eller omgåelser.

**Virksomheder er uafhængige af basiskortet:** Det nye katalog læser Overture-importer fra egen database uden Overpass. Se [datavejledningen](docs/business-data.md). En manglende import vises som **Data ikke indlæst**, aldrig som et bevis på nul virksomheder.

**Hent denne rettelse i dit eksisterende Codespace:** Åbn en ny terminal, kør `git pull --ff-only` og `npm ci`. Stop den eksisterende udviklingsserver med **Ctrl+C**, kør `npm run dev`, og genindlæs previewfanen med **Ctrl+Shift+R**. Den eksisterende `.env.local` bevares, og samme MapTiler-nøgle bruges fortsat. Du behøver ikke oprette et nyt Codespace.
