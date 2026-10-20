# WebHunt

Dansk virksomhedskort til webdesignere. Next.js 16, React 19, TypeScript, Tailwind CSS 4, Leaflet/markercluster, Lucide og Supabase. Egen visuel identitet med mørkt kort og mintgrønne detaljer.

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

Kort og virksomhedssøgning kræver ingen API-nøgle. Uden Supabase kan du bruge lokale leads, noter og vurderinger i browserens localStorage. Det er udtrykkeligt mærket som lokal tilstand; det er ikke permanent databaselagring, og slettede browserdata kan ikke genskabes. Ingen opdigtede virksomheder bruges som fallback. Uden adgang til datakilden vises en fejl og en genforsøgsknap.

## Funktioner

- Danmarkskort inkl. Bornholm, øer, zoom, panorering, clustering og klikbare virksomhedsmarkører.
- Landsoversigten henter et begrænset udvalg omkring København, Aarhus, Odense, Aalborg, Nykøbing Falster, Roskilde, Næstved, Esbjerg og Rønne. Zoom ind for geografisk søgning i resten af Danmark. Det er ikke en komplet CVR-database.
- Overpass søger efter navngivne butikker, håndværkere, kontorer, udvalgte restaurations-/sundhedsvirksomheder og lokalt også hoteller. Højst 600 virksomheder pr. lokalt udsnit, eller 60 pr. by i landsoversigten. Kun virksomheder inden for Danmarks OSM-administrationsområde medtages.
- Navn, adresse, by og postnummer filtreres blandt indlæste virksomheder. Enter eller “Søg som sted” søger en dansk by/postnummer via Nominatim. Kendte bygenveje kræver ikke geokodning.
- Branche- og statusfiltre; “Find potentielle kunder” viser røde/orange vurderinger. Alle importerede virksomheder starter grå, også når en webadresse mangler.
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

Analysen bruger mobilstrategi og kategorierne performance, SEO og accessibility. Scoren er gennemsnittet af de returnerede kategorier (0–100); performance skal være til stede. Grøn kræver score ≥85 og HTTPS. Andre gennemførte analyser bliver orange. Resultater forklares, dateres og caches i op til 24 timer. En teknisk score er ikke en vurdering af design, juridisk efterlevelse eller en garanti for mobilvenlighed. Timeout/API-fejl giver ingen score og status “Ikke undersøgt”. Analysen kan tage op til 100 sekunder; hostingen skal understøtte dette eller bruge en jobkø før større drift.

## Netværk og ansvarlig brug af datakilder

Tillad HTTPS til:

| Domæne | Formål |
| --- | --- |
| `overpass-api.de`, `overpass.private.coffee` | Virksomhedsdata / alternativ offentlig Overpass-instans |
| `tile.openstreetmap.org` | Kortfliser (direkte fra browseren) |
| `nominatim.openstreetmap.org` | Danske stedssøgninger |
| `www.googleapis.com` | PageSpeed Insights |
| `DIT-PROJEKT.supabase.co` | Login/database; præcist projektdomæne foretrækkes |
| `registry.npmjs.org` | Installation |

Cloudmiljøets kladde indeholder de ekstra domæner. At gemme kladden aktiverer ikke nødvendigvis netværksændringer i den kørende instans: gem miljøindstillingerne, og prøv igen. Publicér derefter miljøet, når du ønsker et genbrugeligt snapshot. Supabase- og Google-nøgler leveres separat og sikkert; send ikke hemmeligheder i chat.

Overpass-resultater gemmes atomisk som JSON i `.data/osm/` (eller `WEBHUNT_CACHE_DIR`). Kun offentlige virksomhedsdata ligger her, aldrig login, private leads eller nøgler. Snapshotfilerne må ikke committes. Friske resultater genbruges i 24 timer, også efter servergenstart. Ved driftsfejl kan højst syv dage gamle resultater bruges med synlig dato og advarsel. For andre kortudsnit bruges kun geografisk matchende poster, tydeligt mærket som delvis dækning. Uden et rigtigt snapshot og uden netadgang vises en fejl — ikke testvirksomheder.

Identiske samtidige forespørgsler samles. En fillås tillader kun én OSM-opdatering ad gangen på det delte datalager. Ved kapacitetsfejl ventes eksponentielt fra to minutter til 30 minutter; en længere `Retry-After` respekteres. Fejlpauser gemmes på disk og overlever genstart. Den anden offentlige instans bruges sekventielt, ikke parallelt. Forespørgsler bruger konkrete indekserede OSM-tags, et begrænset geografisk område og særskilte resultatlofter for hver oversigtsby. En tom, gennemført søgning caches; en timeout eller delvist svar caches ikke som et tomt resultat.

Kortbevægelser har 600 ms debounce, og kortudsnit afrundes til et lille geografisk gitter for bedre cachegenbrug. Der er IP-begrænsning (virksomheder 24/minut, steder 10/minut, analyse 5/5 minutter). Nominatim begrænses til højst én udgående forespørgsel pr. 1,1 sekund pr. proces og bruges ikke til autocomplete. Der foretages ingen forudindlæsning eller offline-download af kortfliser.

Opvarm eller genopfrisk et begrænset landsudvalg med `npm run data:refresh`. Kommandoen bruger samme cache, lås og ventetider som appen og omgår aldrig en aktiv fejlpause.

**Stabil drift:** Offentlige Overpass-servere tilbyder ingen SLA, og en ny installation uden cache kan derfor være utilgængelig, hvis alle kilder er nede. Ved offentlig eller større drift skal du bruge en aftalt dataleverandør eller egen Overpass-instans og et vedvarende datalager:

```dotenv
OVERPASS_API_URL=https://DIN-EGEN-TJENESTE.example/api/interpreter
WEBHUNT_CACHE_DIR=/var/lib/webhunt/osm
```

Sæt kun en URL, du har ret til at bruge, og tillad det præcise værtsnavn i netværksindstillingerne. Ved en konfigureret URL bruges kun denne kilde. Gennemgå leverandørens kapacitets- og licensvilkår. På en server uden et vedvarende filsystem forsvinder cachen mellem instanser; brug en persistent volume eller flyt cacheadapteren til fælles objektlager/database. Ved flere servere kræves et fælles datalager og en fælles rate limiter/jobkø. De nuværende IP-grænser og Nominatim-cache er stadig proceslokale. Stol kun på forwarding-headere fra din egen reverse proxy.

De aktuelle offentlige instanser er bekræftet mod [Overpass Turbos konfiguration](https://github.com/tyrasd/overpass-turbo/blob/master/js/configs.ts). Overhold [OSM tile policy](https://operations.osmfoundation.org/policies/tiles/), [Nominatim policy](https://operations.osmfoundation.org/policies/nominatim/) og den valgte Overpass-operatørs vilkår. Denne løsning benytter åbne OSM-data og ingen scraping af Google Maps eller beskyttede CVR-databaser.

OSM-data er © OpenStreetMap-bidragsydere under [ODbL](https://www.openstreetmap.org/copyright). Bevar kildeangivelse og gennemgå licensforpligtelser ved videreudgivelse af datasæt. Eksport giver ikke tilladelse til uanmodet markedsføring. Brug kun data med et lovligt formål og slet unødvendige personoplysninger.

## Test

```bash
npm run test          # data, bounds, URL-validering, scoring og CSV
npm run typecheck
npm run build
npm run test:e2e      # starter produktionsserveren på port 3000
```

Browserprøverne bruger Chromium på `/usr/bin/chromium` i dette cloudmiljø. På andre maskiner: sæt `CHROMIUM_PATH` til en lokal Chrome/Chromium-installation. Browserprøverne bruger eksplicitte testfixtures og blokerer kortfliser; de beviser UI-funktioner, ikke live OSM/Google-adgang eller Supabase-isolation. Fixtures bruges aldrig i den kørende app. `npm run format` formaterer kildekoden med Prettier.

## Projektstruktur

- `app/`: Next App Router, layout og API-ruter for geografisk data, geokodning og analyse.
- `components/DenmarkMap.tsx`: klientindlæst Leaflet med clustering; ingen Leaflet i SSR.
- `components/RadarApp.tsx`: kort, virksomhedsvisning, leads, statistik, indstillinger og Auth.
- `lib/`: fælles typer, datanormalisering, sikker URL-/CSV-behandling, analyse og Supabase-klient.
- `supabase/schema.sql`: database og ejerbaserede adgangspolitikker.
- `tests/`: domænetests og browserforløb.

Ingen credentials, opdigtede virksomhedsdata, tracking eller tredjepartsfonte er indbygget.


## Åbn hjemmesiden og gem på GitHub

Et publiceret **Codex-cloudmiljø er et udviklingssnapshot**, ikke en offentlig webhosting. Der oprettes ikke automatisk en hjemmesideadresse. Denne session har ingen funktion til at oprette en offentlig browser-previewadresse. Den lokale browseradresse virker på den computer, hvor udviklingsserveren kører.

### Gem de aktuelle projektfiler på GitHub

GitHub-repositoryet var tomt ved kontrollen. Følgende skal køres i en terminal, som har adgang til de nuværende projektfiler — ikke i en ny tom klon:

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

1. Gem først kildekoden i GitHub-repositoryet. Hvis en direkte push fra Codex ikke lykkes, hent den opdaterede `WebHunt-source.zip`, pak den ud, og brug GitHub → **Add file → Upload files** (eller **uploading an existing file** i et tomt repository). Upload indholdet af mappen `WebHunt`, inklusive `.devcontainer`, `.gitignore`, `.nvmrc` og `.env.example`, og vælg **Commit changes**. Upload ikke ZIP-filen som én fil.
2. På repositoryets forside vælger du den grønne **Code**-knap → fanen **Codespaces** → **Create codespace on main**. Du kan også åbne https://codespaces.new/antonfrederik101-ux/WebHunt og vælge **Create codespace**, når filerne er gemt.
3. Vent på, at browsereditoren åbner, og containeren installerer afhængighederne. Appens port 3000 åbnes automatisk, når klienten understøtter automatisk åbning.
4. Hvis ingen fane åbner: Vælg **Ports** i nederste panel i editoren. Hvis panelet er skjult, vælg **Terminal → New Terminal** og derefter fanen **Ports**. Find rækken **3000 / WebHunt**, peg på den, og klik på globusikonet **Open in Browser**. Alternativt højreklik på rækken og vælg **Open in Browser**. Brug adressen, GitHub åbner — ikke `localhost` på din computer. Behold portens synlighed **Private** og brug din egen GitHub-login-session.
5. Hvis port 3000 mangler: Vælg **Terminal → New Terminal**, skriv `npm run dev`, og vent på **Ready**. I **Ports** vælger du derefter **Forward a Port**, skriver `3000` og vælger **Open in Browser**.

Kortvisning og lokale leads kan testes uden Supabase-konfiguration. Cloudmiljøets variabler overføres ikke automatisk til Codespaces. For login/database:

- Vælg **Terminal → New Terminal**, kør `cp .env.example .env.local` én gang, og åbn `.env.local` i filoversigten. Overskriv ikke en eksisterende konfiguration. Indsæt dine egne Supabase-værdier; filen er Git-ignoreret. Genstart `npm run dev`, hvis serveren allerede kører, så den læser de nye værdier.
- I Supabase kører du `supabase/schema.sql` i **SQL Editor**. Brug derefter den konkrete Codespaces-browseradresse som **Site URL** og tilføj dens `/auth/callback` og `/auth/callback?recovery=1` under **Authentication → URL Configuration → Redirect URLs**. Previewdomænet er specifikt for dit codespace; kopiér det fra den åbne fane.
- Kontrollér **Indstillinger → Test forbindelsen** i WebHunt. Appens OSM-datakilder kan stadig være overbelastede; det er uafhængigt af, om previewserveren kan åbnes. Datafejl må ikke forveksles med forbindelsesfejlen `ERR_CONNECTION_REFUSED`.

Hvis browsereditoren er åben, men en gammel codespace ikke bruger den nye opsætning, åbn kommandopaletten med **F1**, vælg **Codespaces: Rebuild Container**, og følg porttrinnene igen. Codespaces er et udviklingsmiljø, ikke permanent offentlig webhosting.
