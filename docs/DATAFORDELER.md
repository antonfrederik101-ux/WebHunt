# Datafordeler: CVR-forbindelsestest

## Bekræftet af brugerens officielle skærmbilleder

- Datafordelerens `Fildownload (CVR)`-dokumentation på `https://confluence.kds.dk/pages/viewpage.action?pageId=193921410` beskriver JSON/CSV-totaldownload og aktuelle, temporale og bitemporale udtræk. Der findes ikke kommuneopdelt fildownload i den viste tabel.
- Den viste adgangsform er API-key, OAuth Shared Secret eller OAuth Certifikat. Kun entiteten CVRPerson kræver særskilt anmodning om registeradgang; dette er ikke en generel tilladelse til alle anvendelser af andre data.
- De viste eksempler anvender `https://api.datafordeler.dk/FileDownloads/GetFile` med `Register`, `LatestTotalForEntity`, `type`, `format` og `apiKey`. Tabellen siger udtrykkeligt: "Totaldownload af entiteterne CVREnhed og Beskæftigelse findes kun som bitemporalt download." Proben bruger derfor `CVREnhed` med `type=bitemporal`. Bitemporale oplysninger må ikke behandles som aktuelle virksomheder uden efterfølgende filtrering af registrerings- og virkningsperioder.
- Brugeren har oprettet IT-systemet WebHunt i administrationen, oprettet en API-key og oplyst at have gemt den i sit Codespace. Nøglen er ikke sendt i chatten eller indsat i projektet her.

## Kørsel i det eksisterende Codespace

Tilføj servervariablen `DATAFORDELER_API_KEY` i den ignorerede `.env.local`. Den er forskellig fra PageSpeed- og MapTiler-nøglerne og må ikke have `NEXT_PUBLIC_` foran.

```bash
npm run data:cvr:check
```

Testen gør én forespørgsel til fil-API'et med `Range: bytes=0-3` for `CVREnhed/bitemporal/JSON`. Den læser kun indtil den har de fire ZIP-signaturbytes, og annullerer herefter forbindelsen. En server kan ignorere Range og levere en større første netværksblok; også i det tilfælde afbrydes overførslen, og hele filen gemmes ikke. Der er 30 sekunders timeout og ingen automatiske genforsøg.

Der åbnes ingen database, gemmes ingen virksomhedsdata og anmodes ikke om CVRPerson eller alle registrets entiteter. Viderestillinger følges ikke automatisk, så nøglen ikke sendes videre til en anden vært. TLS og eksisterende netværksproxy bevares. Resultatet viser kun kontrollerede felter: statuskode, kendt MIME-type, eventuel filstørrelse/tid, antal modtagne bytes og en fast fejlbeskrivelse. Svarindhold, downloadadresse, Location og vilkårlige fejlbeskeder logges ikke.

## Fortolkning

- `file_available`: HTTP 200/206 og starten af en ZIP-fil er faktisk modtaget. Det beviser endnu ikke schema, aktuelle virksomhedsstatusser, komplette data eller ret til den planlagte anvendelse.
- `authentication_rejected`: HTTP 401. Kontrollér nøglens status/gyldighed i administrationen.
- `forbidden`: HTTP 403. Kan være API eller netværksmellemled; nøglen antages ikke automatisk forkert.
- `request_not_supported`: blandt andet 400/404/405/416/422. Afklar endpoint, udtræk/filter eller understøttelse af Range før ny kørsel.
- `redirect`: afklar den faktiske downloadkontrakt og destination før implementering af viderestilling.
- `rate_limited`/`unavailable`: 429/5xx. Ingen virksomhed markeres lukket, og ingen automatisk gentagelse startes.
- `unexpected_response`/`network_error`: ingen bekræftet ZIP-fil; ingen aktivitet udledes af resultatet.

## Resterende arbejde

En fuld CVR-download, schemaadapter, kobling af P-enheder/adresser, første verificerede import og planlagt opdatering er **ikke** implementeret af denne probe. Det eksisterende `verify:identities` læser fortsat det særskilte, dokumenterede CVR-distributionsformat og kan ikke få en ukendt Datafordeler-fil lagt ind som om formaterne var ens. Adapteren skal bygges mod et faktisk datasample og dokumenterede felter, så der ikke gættes status eller identitet.

Den 22. oktober 2026 afviste dette udviklingsmiljøs proxy også `api.datafordeler.dk` med HTTPS CONNECT 403, før API'et kunne nås. Brugerens nøgle og virkelige database ligger i det andet Codespace. Ingen fungerende liveforbindelse eller 20.000 faktiske virksomheder påstås på baggrund af kontrollerede tests.

## Validering

Brugerens første virkelige kørsel af `c9d8acc` returnerede HTTP 404 for `CVREnhed/current`. Testen indeholdt en fejl: den bad om en filterkombination, som den allerede viste officielle tabel udelukkede. Proben og dens forventede parametre er rettet til bitemporal. Det konkrete upstream-svar for den rettede forespørgsel er endnu ikke modtaget. Ingen ny nøgle, ekstra rettighed eller netværksændring anbefales ud fra den første 404.

68 Node-tests og TypeScript-kontrol bestået. Nye tests dækker opsplittet ZIP-signatur, server der ignorerer Range, afbrydelse af filstrømmen, skelnen mellem HTTP-fejl, manglende nøgle uden netkald, uventet JSON-svar og nøglebeskyttelse i svarheadere, redirect og fejl. Ingen browserændringer i denne levering.
