# Vedvarende virksomhedsdata

## Valg af kilde

Overture **Places** er velegnet til klikbare virksomhedssteder: koordinater, GERS-id,
navn, kategorier og ofte adresse, hjemmeside og telefon. Places er ikke et komplet
CVR-register og omfatter også skoler, natursteder og institutioner. WebHunt filtrerer
kendte ikke-erhvervskategorier, permanent lukkede steder, udenlandske adresser og
poster med ukendt licens fra. Oplysninger kan være mangelfulde eller forældede.
Ingen virksomhed får automatisk status "ingen hjemmeside" på grund af manglende data.

De officielle kilder blev læst fra OvertureMaps/docs på GitHub, da dette cloudmiljø
endnu ikke tillader dokumentations- og datalagerdomænerne:

- https://docs.overturemaps.org/guides/places/
- https://docs.overturemaps.org/attribution/
- https://docs.overturemaps.org/getting-data/overturemaps-py/
- https://github.com/OvertureMaps/overturemaps-py

September 2026 fjernede Overture det gamle `categories`-felt. Importen understøtter
`basic_category`, `taxonomy` og gamle udgivelser med `categories`. Licens, oprindelige
source-entries, source-id, udgivelse og importdato bevares. Meta, Microsoft, PinMeTo,
Krick, RenderSEO, DAC og BrightQuery er CDLA-Permissive-2.0; AllThePlaces er CC0-1.0.
Foursquare har Apache-2.0 og yderligere upstream-NOTICE. Foursquare og ukendte
leverandører er indtil videre udelukket, indtil alle deres distributionskrav kan
bekræftes. Kopier af de anvendte licenser følger med projektet og CSV-eksporten.

## Danske offentlige registre

CVR er relevant for juridiske virksomhedsidentiteter og officielle registreringer.
P-enheder er relevante for fysiske afdelinger; CVR-nummer alene er ikke et sikkert
sammenfald mellem flere butikker. En senere dansk berigelse skal have særskilte
CVR-/P-numre, proveniens og eventuel reklamebeskyttelse og må ikke koble alene på navn.
DAR kan levere officielle adresser/geokodning, men er ikke en virksomhedsfortegnelse.

Officielle indgange til kontrol af adgang, produkter og aktuelle vilkår:

- https://datacvr.virk.dk/
- https://datafordeler.dk/dataoversigt/det-centrale-virksomhedsregister-cvr/

De konkrete CVR-/Datafordeler-sider var netværksblokeret i denne session; aktuelle
API-adgangsvilkår og produktlicenser er derfor **ikke verificeret**. Der er en separat
adapter til kontrol mod et dateret, administratorleveret CVR-JSON-udtræk, men ingen
aktiveret masseleverandør eller scraping af CVR-søgesiden. Se [batchvejledningen](BULK_IDENTITY.md).
Offentlige kontaktoplysninger er ikke et samtykke til uanmodet markedsføring.

## Drift uden Overpass

`GET /api/businesses` læser udelukkende egen database. Den henter aldrig Overpass og
starter aldrig en ekstern import. Der er ingen kildeventetid på kortvisningen.

Standard i Codespaces er Node 24's SQLite med WAL, foreign keys og geografisk
R-tree-indeks i `.data/businesses.sqlite`. Brug `WEBHUNT_CATALOG_PATH` på en
**persistent volume** i drift. En genopbygning af containeren bevarer projektets
`/workspaces`-filer; sletning af Codespace/volume kan slette databasen. Den lokale
database er ikke delt mellem flere serverinstanser og må ikke lægges på et usikkert
netværksfilsystem. Serverless hosting kræver Supabase-adapteren eller andet fælles lager.

Et verificeret, begrænset Nykøbing Falster-udtræk kan gemmes som
`data/overture/nykoebing-falster.json` og indlæses ved første start. Filen må kun
indeholde faktisk importerede Overture-poster, aldrig testvirksomheder. En nyere
lokal import erstattes ikke af en ældre opstartskopi. Kortet starter ved Nykøbing
Falster; områder uden import mærkes tydeligt.

Importerede data udløber ikke ved kildefejl. Udgivelser over 90 dage mærkes gamle,
men bliver fortsat vist. Opdatering foregår i en separat proces; transaktionen
udskifter kun ét importområde, bevarer andre områder og ruller tilbage ved fejl.
Tomme eller ældre udgivelser afvises. Dubletter på samme GERS-id samles; forskellige
filialer med samme navn samles ikke automatisk.

## Importjob

Importværktøjerne er adskilt fra appens npm-afhængigheder:

```bash
npm run data:setup
npm run data:refresh -- --publish-seed
```

Det officielle `overturemaps==1.0.2`-værktøj bruges til den aktuelle udgivelse og et
begrænset GeoParquet/STAC-udsnit. HTTPS-proxy og TLS-verifikation bevares. Der hentes
ikke kortfliser, globale datadumps eller beskyttede data. Råudtræk og normaliseret
snapshot ligger i den ignorerede `.data/imports/`-mappe. Et færdigt udtræk kan
reimporteres uden netadgang:

```bash
npm run data:import -- --input .data/imports/nykoebing-falster-UDGIVELSE.geojson --release UDGIVELSE
```

Udvid med geografiske felter, der holder sig inden for Danmark; brug særskilte
region-id'er. Ved store udsnit kræves landekode DK på posten, så et Danmark-bbox
ikke også importerer svenske og tyske virksomheder:

```bash
npm run data:refresh -- --region roskilde --name Roskilde --bounds 12.03,55.60,12.13,55.68
```

Planlæg importjobbet uden for webserveren efter nye Overture-udgivelser (typisk
månedligt). Det kan køres af en scheduler med samme vedvarende lager. Et fejlet job
skal alarmere operatøren og efterlade den gamle database; det er ikke et tomt resultat.
Der er ikke oprettet en ekstern scheduler eller et hosted deployment i denne session.

## Supabase som fælles katalog

`supabase/business-catalog.sql` opretter separate offentlige katalogtabeller og to
RPC-funktioner. Browserroller har SELECT og adgang til den geografiske læsefunktion;
import er kun tilladt for databaseejeren/service_role. Private leads og deres RLS
ændres ikke. Ingen administrationsnøgle behøves i appen.

Et verificeret snapshot kan samles med migreringen til én SQL-fil:

```bash
node --import tsx scripts/export-catalog-sql.ts
```

Gennemgå og kør `.data/imports/install-catalog.sql` i Supabases SQL Editor. Sæt først
derefter servervariablen `WEBHUNT_CATALOG_BACKEND=supabase`, og genstart appen.
API'et bruger den eksisterende offentlige anon/publishable key til læsning. En
Supabase-fejl viser en tydelig databasefejl; der skiftes aldrig til Overpass.
Administrationsnøgler må aldrig være `NEXT_PUBLIC_` eller med i Git/klientkode.

## Status og begrænsninger

Database, normalisering og transaktions-/adgangskontrol kan testes med isolerede
fixtures. Det beviser ikke live dataadgang. En virkelig Nykøbing Falster-import og
klikbare **virkelige** virksomheder kan først godkendes, når det officielle STAC-
og GeoParquet-lager kan nås og data er hentet. Der er ikke indsat opdigtede poster.

## Netværksfejl og samlet pilotimport

Se [den konkrete forbindelsesdiagnose](network-diagnosis.md). En adresse i en gemt
allowlist beviser ikke, at den kørende proxy har aktiveret den. Test de eksisterende
adresser med `python3 scripts/check-overture-network.py` før netværkslisten ændres.

`bash scripts/import-pilot.sh` samler netværkskontrol, installation, afgrænset import
og lokal databaseverifikation. Brug den i det eksisterende checkout; den skifter
ikke miljøindstillinger, kopierer ikke nøgler og overskriver ikke `.env.local`.

## Genbrug et allerede hentet pilotudtræk

Hvis download er gennemført, men normaliseringen fejler, genbrug den senest hentede
råfil med `node scripts/reimport-pilot.mjs`. Kommandoen henter ingen nye data,
bevarer det oprindelige udtræk og importerer først til databasen efter validering.
Fejlrapporten angiver nu antal afvisninger fordelt på årsag og ukendte kildenavne.
De officielle kilde-id'er `metaPlaces` og `msftPlaces` genkendes med bevaret proveniens.
