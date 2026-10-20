# Batchkontrol af virksomhedsidentitet

## Hvad der er implementeret

`npm run verify:identities` matcher et dateret, administratorleveret CVR-JSON-udtræk mod allerede importerede kortposter. Det henter **ikke** et CVR-register og opretter ingen nye virksomheder. Standard er en skrivebeskyttet forhåndskontrol. Først med `--apply` skrives kontrolresultater og historik. Hjemmesider og PageSpeed kaldes ikke; tidligere hjemmesidemålinger bevares.

Kildeformatet er den allerede understøttede `hits.hits[]._source.Vrvirksomhed`-struktur. Der er ikke lavet en XLSX-parser ud fra gættede kolonnenavne. Et udtræk skal være lovligt indhentet og indeholde de krævede identitets-, status- og adressefelter. Operatøren skal dokumentere adgang, opdateringsfrekvens og ret til anvendelsen; et offentligt søgeresultat er ikke i sig selv en dokumenteret masse-API.

```bash
# Kun forhåndskontrol, ingen ændringer:
npm run verify:identities -- --input .data/imports/cvr.json

# Gem højst 100 kontroller i første gennemløb:
npm run verify:identities -- --input .data/imports/cvr.json --apply --limit 100

# Fortsæt samme kilde/område; allerede færdige opgaver gentages ikke:
npm run verify:identities -- --input .data/imports/cvr.json --apply

# Kontrollér alle eksisterende importområder mod samme udtræk:
npm run verify:identities -- --input .data/imports/cvr.json --region all --apply
```

Brug filens dokumenterede `exportedAt` eller angiv `--observed-at` med kildens faktiske kontroldato. Datoen skal være højst 30 dage gammel og må ikke ligge i fremtiden. Et nyt filstempel gør ikke gamle oplysninger aktuelle. Ukendt format, tom kilde, gammel dato eller manglende database afvises. Der oprettes ikke en tom erstatningsdatabase.

## Matching og bevarelse

- Der bygges ét indeks over CVR og præcist normaliseret navn/adresse/postnummer. Et CVR alene bekræfter ikke en ændret filialadresse. Tvetydighed og manglende match bliver usikre, aldrig lukkede ud fra fravær.
- Juridisk CVR-aktivitet er ikke en garanti for fysisk butiksdrift. Denne adapter importerer ikke P-enheder; støtte til en konkret P-enhedskilde kræver dens faktiske schema og vilkår.
- Hvert kontroljob identificeres ved kildefilens SHA-256, dokumenteret kontroldato, område og fingeraftryk af de aktuelle kortposter. Nye kilder eller ændrede kortposter får et nyt job, også når der er kørt hjemmesidekontrol samme dag.
- Gentagelse med samme kilde og katalog fortsætter det eksisterende job. Job låses med de eksisterende leases; kontrolresultat og afslutning gemmes atomisk. Individuelle fejl vises i jobrapporten og giver fejl-exitstatus. De forsøges ikke automatisk uendeligt.
- Historik og kildefingeraftryk gemmes. Oprindelige importerede poster, private leads og miljønøgler ændres ikke. Gamle hjemmesideanalyser bevares ved identitetskontrol. En ny fil kan ikke blive erstattet af gamle CVR-opslag fra cachen eller blive gemt som et liveopslag.
- Resultatet ligger lokalt i `.data/reports/identity-verification.json`. Kildefilen og rapporten er Git-ignorerede. Rapportens kandidatmatch før anvendelse er adskilt fra de endelige gemte statusser, hvor dubletter og modstridende evidens også vurderes.

## Faktisk kildeadgang og resterende arbejde

Den 20. oktober 2026 blev følgende adresser testet fra udviklingsmiljøet: Erhvervsstyrelsens CVR-dataindgang, datacvr.virk.dk, Datafordelerens CVR-indgang samt cvrapi.dk, cvr.dev og docs.cvr.dev. HTTPS-proxyen afviste CONNECT med HTTP 403 før adgang til siderne. Det er ikke en konstateret afvisning fra udbyderne eller dokumentation for deres aktuelle vilkår. Der blev ikke ændret netværksindstillinger, omgået proxy eller foreslået nye allowlist-domæner. Offentlig GitHub-søgning via API var ligeledes blokeret.

Der er derfor **ikke valgt eller aktiveret en ny masseleverandør**, og der er ikke importeret 20.000 rigtige virksomheder i denne ændring. Den faktiske database findes kun i brugerens Codespace. Før skalering kræves en dokumenteret datakilde med aktuelle CVR-/P-enhedsoplysninger, en verificeret adgangsmetode og et konkret datasample. Herefter kan en adapter og en planlagt opdatering implementeres mod det faktiske format. Der er ingen ny scheduler, eksternt abonnement eller driftsgaranti for et sovende Codespace.

## Validering

64 Node-tests og TypeScript-kontrol. Matchindekset testes med 20.000 **syntetiske testidentiteter**, ikke rigtige virksomheder. CLI-testen bruger isoleret database og kontrollerer skrivebeskyttet preview, delvis kørsel/genoptagelse, ingen gentagelse af afsluttet job, ny kilde, ændret katalog, historik, bevarede råposter/hjemmesidekontroller og afvisning af gamle kildedatoer. Separate tests sikrer, at der ikke udføres hjemmesidescanning i identitetsfasen, og at et gammelt cachet CVR-svar ikke skjuler en nyere kilde med ophør.
