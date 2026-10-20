# MASTER PROMPT TIL CODEX – BYG MIN KOMPLETTE DANSKE VIRKSOMHEDSPLATFORM

Du skal fortsætte udviklingen af min eksisterende hjemmeside og gøre den til en professionel, moderne og fuldt fungerende platform.

Læs HELE denne besked grundigt, inden du begynder.

**VIGTIGT:**
- Start IKKE projektet forfra.
- Behold den eksisterende kode, database, funktioner og integrationer, der fungerer.
- Undersøg først hele projektets struktur.
- Ret eksisterende fejl, inden du begynder på nye funktioner.
- Gennemfør arbejdet direkte i projektet.
- Byg reelle funktioner, ikke bare flotte demonstrationer.
- Arbejd systematisk og test funktionerne undervejs.
- Hvis opgaven er for stor til én session, skal du opdele den i faser, gemme fremskridtene og fortsætte uden at ødelægge det eksisterende arbejde.

## 1. MIN IDÉ OG MIT ENDELIGE MÅL

Jeg vil bygge en dansk platform inspireret af:

https://sitefliper.com/

Undersøg gerne den hjemmeside og dens offentligt tilgængelige funktioner, så du forstår idéen.

Jeg vil ikke kopiere deres kode, navn, grafik eller beskyttede design. Jeg vil bygge min egen platform med samme overordnede koncept, men med mit eget moderne design og mine egne funktioner.

Min platform skal gøre det muligt at:

1. Se virksomheder fra hele Danmark på et interaktivt kort.
2. Identificere virksomheder, der mangler en hjemmeside.
3. Identificere virksomheder, der har dårlige eller teknisk fejlbehæftede hjemmesider.
4. Identificere virksomheder, der allerede har gode hjemmesider.
5. Søge og filtrere mellem hundredtusindvis af virksomheder.
6. Klikke på virksomheder og se relevante oplysninger.
7. Analysere en virksomheds eksisterende hjemmeside.
8. Generere en ny, flot hjemmeside til en virksomhed.
9. Redigere hjemmesiden manuelt eller ved at skrive instruktioner til AI.
10. Se en liveforhåndsvisning af den nye hjemmeside.
11. Gemme forskellige hjemmesideprojekter.
12. Dele en demonstration med en potentiel kunde.
13. På sigt udgive hjemmesider og administrere kunder.

**Mit langsigtede mål er at have omkring 300.000–500.000 virksomheder fra hele Danmark i systemet.**

Det er et mål, ikke en påstand om hvor mange virksomheder vores datakilder allerede indeholder.

Platformen skal kunne udvikles til en rigtig virksomhed.

---

# 2. HELT NYT OG PROFESSIONELT DANMARKSKORT

Det eksisterende Danmarkskort skal forbedres markant.

Lige nu er nogle virksomheder bare vist som grå prikker, og kortet føles ikke færdigt.

Jeg vil have et kort, der ser professionelt ud, er hurtigt og fungerer som et rigtigt moderne kort.

Brug eksempelvis MapLibre GL JS, Mapbox eller en tilsvarende moderne kortløsning, afhængigt af projektets eksisterende teknologi og licenser.

Kortet skal indeholde:

- Alle danske byer og områder.
- Vejnavne og gadenavne.
- Lokale veje og motorveje.
- Bygninger, hvor kortdata understøtter dem.
- Parker, skove og grønne områder.
- Søer, vandløb og hav.
- Zoom og panorering.
- Glidende animationer.
- Flot kortstil med god kontrast.
- Responsivt design på computer, tablet og mobil.
- Hurtig indlæsning.

Brug en lovlig kort- og tileudbyder, og overhold dens licens, attribution og begrænsninger.

Kortet skal som standard vise Danmark, ikke kun én by.

Jeg bor i Nykøbing Falster, men platformen skal dække HELE Danmark.

## 3. FARVEKODEDE VIRKSOMHEDER – MEGET VIGTIGT

Dette er en af platformens vigtigste funktioner.

Jeg vil IKKE længere have, at alle virksomheder bare er grå prikker.

Hver virksomhed skal have en tydelig farve afhængigt af hjemmesidens status.

### RØD – VIRKSOMHEDEN HAR INGEN REGISTRERET HJEMMESIDE

Brug røde prikker til virksomheder, hvor vi ikke har fundet en registreret hjemmeside.

Det kan eksempelvis være:

- En lokal frisør uden registreret hjemmeside.
- En håndværker uden registreret hjemmeside.
- En butik uden registreret hjemmeside.
- En virksomhed, som kun har Facebook eller Instagram.

Vigtigt: Manglende hjemmeside i vores data er ikke et endeligt bevis på, at virksomheden ikke har en hjemmeside.

Skriv derfor tydeligt, at der ikke er fundet en registreret hjemmeside.

### ORANGE – DÅRLIG HJEMMESIDE ELLER REDESIGNPOTENTIALE

Brug orange prikker til virksomheder, som har en hjemmeside med dokumenterede problemer eller tydeligt forbedringspotentiale.

Eksempler:

- Hjemmesiden returnerer vedvarende 404 eller 410.
- Domænet er parkeret eller udløbet.
- Hjemmesiden har ødelagte funktioner.
- Hjemmesiden fungerer dårligt på mobil.
- Designet har alvorlige brugervenlighedsproblemer.
- Centrale oplysninger er svære at finde.
- Siden har væsentlige tilgængelighedsproblemer.
- Hjemmesiden er langsom.
- Hjemmesiden ser forældet ud efter en konkret designvurdering.

Systemet skal kunne forklare, HVORFOR en hjemmeside er orange.

En hjemmeside må ikke få orange status på grund af en enkelt timeout eller midlertidig netværksfejl.

### GRØN – GOD OG VELFUNGERENDE HJEMMESIDE

Brug grønne prikker til virksomheder, hvor en tilstrækkelig kvalitetskontrol viser, at hjemmesiden fungerer godt.

Eksempelvis:

- Hjemmesiden kan indlæses.
- Den fungerer på mobil.
- Navigationen fungerer.
- Designet er overskueligt.
- Der er ingen væsentlige registrerede tekniske fejl.
- Siden har acceptabel ydeevne.
- Centrale funktioner og kontaktoplysninger fungerer.

En hjemmeside må IKKE automatisk blive grøn, bare fordi serveren svarer med HTTP 200.

### GRÅ – ENDNU IKKE KONTROLLERET

Brug kun grå som midlertidig status til virksomheder, som systemet endnu ikke har undersøgt, eller hvor der er for stor usikkerhed.

Det endelige mål er, at så mange virksomheder som muligt får en pålidelig rød, orange eller grøn status.

## 4. FARVEFILTER OG STATISTIK

Lav en flot og brugervenlig oversigt over virksomhedernes status.

Der skal være tydelige filtre:

- Alle virksomheder.
- Røde virksomheder.
- Orange virksomheder.
- Grønne virksomheder.
- Ikke kontrolleret.

Jeg vil kunne slå farverne til og fra.

Vis også statistik som:

- Antal virksomheder i alt.
- Antal røde.
- Antal orange.
- Antal grønne.
- Antal endnu ikke kontrollerede.

Tallene skal komme fra databasen og ikke være opdigtede.

Lav et flot design omkring statistikken.

---

# 5. IMPORTER VIRKSOMHEDER FRA HELE DANMARK

Det eksisterende projekt har allerede forsøgt at hente omkring 600 virksomheder fra et lokalt område.

Det er kun begyndelsen.

Jeg vil have et system, der gradvist kan hente og håndtere virksomheder fra hele Danmark.

**Målet er 300.000–500.000 relevante virksomhedsopslag, hvis lovlige datakilder giver mulighed for det.**

Undersøg muligheder for at anvende:

- Overture Maps Foundation.
- OpenStreetMap.
- Relevante offentlige danske virksomhedsdata.
- Andre lovlige og pålidelige datakilder.

Undersøg licenser og adgangsvilkår, inden data importeres.

Overhold GDPR, datalicenser, API-begrænsninger og øvrige relevante regler.

Brug ikke uautoriseret scraping fra konkurrenter eller tjenester, der forbyder det.

### Databasen skal som minimum kunne indeholde:

- Unikt virksomheds-ID.
- Virksomhedsnavn.
- Adresse.
- Postnummer.
- By.
- Koordinater.
- Branche.
- CVR-nummer, hvis lovligt tilgængeligt.
- Hjemmesideadresse, hvis kendt.
- Sociale profiler, hvis tilgængelige.
- Datakilde.
- Tidspunkt for seneste opdatering.
- Hjemmesidestatus.
- Resultat af hjemmesideanalyse.
- Tidspunkt for seneste kontrol.
- Usikkerhed/konfidens for status.

Undgå at importere den samme virksomhed flere gange.

Brug stabile ID'er og deduplikering.

Hvis flere datakilder indeholder samme virksomhed, skal systemet forsøge at samle oplysningerne korrekt.

### Importen skal kunne:

- Behandle data i batches.
- Fortsætte efter afbrydelser.
- Gemme fremskridt.
- Undgå dubletter.
- Registrere fejl.
- Genoptage uden at starte forfra.
- Vise antal importerede virksomheder.
- Opdatere eksisterende oplysninger.
- Håndtere store datamængder.

Importér ikke automatisk alle 500.000 på én gang uden først at kontrollere performance, omkostninger og datakvalitet.

Start med en korrekt fungerende import, test den, og gør derefter systemet klar til gradvis udvidelse over hele Danmark.

---

# 6. LØS PROBLEMET MED 404 OG DÅRLIGE HJEMMESIDER

Lige nu indeholder nogle af de importerede virksomheder hjemmesidelinks, der ikke virker.

Andre virksomheder ser ud til at have lukkede eller forældede hjemmesider.

Det skal håndteres professionelt.

Lav et automatisk kontrolsystem, som:

1. Undersøger om virksomheden har en registreret hjemmeside.
2. Normaliserer hjemmesideadressen.
3. Kontrollerer HTTP-status.
4. Følger relevante redirects.
5. Kontrollerer om domænet findes.
6. Registrerer gentagne tekniske fejl.
7. Forsøger at identificere parkerede domæner.
8. Gemmer kontrolresultater.
9. Undgår at teste den samme hjemmeside unødvendigt.
10. Kan genkontrollere hjemmesider efter et passende interval.

En 404-fejl betyder ikke nødvendigvis, at virksomheden er lukket.

Et aktivt firma uden hjemmeside skal fortsat kunne vises på kortet.

Hvis det ikke kan afgøres, om virksomheden stadig eksisterer, må systemet ikke opfinde en status.

Kontrollen skal foregå sikkert på serveren med blandt andet timeout, rate limiting og beskyttelse mod SSRF og adgang til interne netværksadresser.

---

# 7. ANALYSÉR HJEMMESIDERNES KVALITET

Jeg vil have et system, som kan afgøre, om en virksomhed har en dårlig eller god hjemmeside.

Det skal være baseret på konkrete forhold, ikke tilfældige gæt.

Lav gerne et pointsystem fra 0 til 100.

Undersøg blandt andet:

- Mobilvenlighed.
- Indlæsningshastighed.
- Navigation.
- Design og overskuelighed.
- Tilgængelighed.
- Tekniske fejl.
- HTTPS.
- Ødelagte links.
- Kontaktinformation.
- Brugervenlighed.

Brug relevante tekniske analyseværktøjer, eksempelvis Lighthouse, hvor det er praktisk og lovligt.

Adskil automatiske tekniske målinger fra mere subjektive designvurderinger.

Vis både samlet score og konkrete fund.

Farvegrænserne skal kunne justeres.

Eksempel på foreløbig logik:

- Rød: Ingen registreret hjemmeside.
- Orange: Dokumenterede væsentlige fejl eller lav kvalitetsscore.
- Grøn: Tilstrækkeligt kontrolleret hjemmeside med god kvalitetsscore.
- Grå: Ikke kontrolleret eller usikker status.

Systemet skal ikke foregive, at det kan vurdere alle hjemmesider perfekt.

---

# 8. FLOTT INFORMATIONSPANEL NÅR MAN KLIKKER PÅ EN VIRKSOMHED

Når jeg klikker på en farvet prik på kortet, skal et moderne panel åbne.

Panelet skal indeholde:

- Virksomhedens navn.
- Adresse.
- Branche.
- CVR-nummer, hvis tilgængeligt.
- Hjemmesidelink, hvis kendt.
- Eventuelle sociale profiler.
- Hjemmesidens farvestatus.
- Eventuel kvalitetsscore.
- Begrundelse for status.
- Seneste kontrol.
- Datakilde.

Lav tydelige handlingsknapper:

**Besøg hjemmeside**

**Analysér hjemmeside**

**Byg ny hjemmeside**

**Gem virksomhed**

**Tilføj til mine potentielle kunder**

Designet skal ligne et professionelt SaaS-produkt.

Panelet skal være overskueligt, moderne og fungere på mobil.

Hvis oplysninger mangler, skal systemet vise det tydeligt i stedet for at opfinde dem.

---

# 9. AVANCERET SØGNING

Lav en hurtig og moderne søgefunktion.

Jeg vil kunne søge efter:

- Virksomhedsnavn.
- By.
- Adresse.
- Postnummer.
- Branche.
- CVR-nummer, hvis tilgængeligt.

Eksempel:

Hvis jeg skriver "Nykøbing Falster", skal kortet automatisk kunne flytte sig til byen og vise virksomhederne i området.

Hvis jeg skriver "frisør", skal jeg kunne få vist relevante frisører.

Hvis jeg vælger "røde virksomheder", skal jeg kunne se virksomheder uden registreret hjemmeside.

Søgningen skal fungere hurtigt, også når databasen indeholder hundredtusindvis af virksomheder.

Tilføj søgeforslag og relevante filtre.

---

# 10. KORTET SKAL KUNNE HÅNDTERE 500.000 VIRKSOMHEDER

Performance er meget vigtig.

Alle virksomheder må ikke hentes direkte til browseren på én gang.

Brug i stedet:

- Serverbaseret geografisk filtrering.
- Geografiske databaseindekser.
- Clustering.
- Pagination.
- Caching.
- Effektiv kort-rendering.
- Indlæsning efter det aktuelle kortområde.
- Eventuelt vector tiles ved store datamængder.

Når jeg zoomer langt ud, skal tætte områder samles i grupper.

Når jeg zoomer ind, skal de enkelte farvede prikker komme frem.

Farverne skal stadig være lette at forstå.

Hvis en klynge indeholder både røde, orange og grønne virksomheder, må den ikke fremstå, som om alle virksomheder har samme status.

Vis gerne farvefordelingen i klynger eller ved klik.

Målet er et kort, der føles hurtigt og glidende.

---

# 11. BYG EN RIGTIG HJEMMESIDEGENERATOR

Dette er en af de vigtigste funktioner efter kortet.

Jeg vil kunne vælge en virksomhed og trykke:

**BYG HJEMMESIDE**

Derefter skal platformen kunne oprette et professionelt hjemmesideforslag.

Systemet skal bruge de oplysninger om virksomheden, som vi faktisk har.

Eksempel:

Jeg klikker på en lokal tømrervirksomhed uden hjemmeside.

Derefter vælger jeg "Byg hjemmeside".

Systemet skal kunne generere et flot forslag med:

- Forside.
- Navigation.
- Hero-sektion.
- Virksomhedsbeskrivelse.
- Oversigt over ydelser.
- Kontaktsektion.
- Kontaktformular.
- Footer.
- Mobilvenligt design.

Systemet må ikke opfinde anmeldelser, medarbejdere, certificeringer, priser eller andre virksomhedsoplysninger.

Hvis relevante oplysninger mangler, skal jeg kunne tilføje dem manuelt.

Lav forskellige designs til forskellige brancher.

En tømrers hjemmeside skal ikke ligne en restaurants hjemmeside.

En frisørs hjemmeside skal ikke ligne et autoværksteds hjemmeside.

Alle designs skal føles moderne og professionelle.

---

# 12. AI-HJEMMESIDEREDIGERING

Jeg vil kunne redigere en genereret hjemmeside ved at skrive almindelig tekst.

Det skal fungere som en AI-hjemmesidebygger.

Eksempel:

Jeg skriver:

"Gør hjemmesiden mere moderne, brug mørkeblå farver og lav en større forside."

Så skal systemet ændre hjemmesiden.

Andre eksempler:

- "Lav menuen mere minimalistisk."
- "Tilføj en kontaktsektion."
- "Lav knapperne grønne."
- "Gør hjemmesiden mere eksklusiv."
- "Tilføj en sektion med virksomhedens ydelser."
- "Lav en flot mobilversion."
- "Gør forsiden mere professionel."

Ændringerne skal vises i en liveforhåndsvisning.

Systemet skal kunne:

- Gemme ændringer.
- Fortryde ændringer.
- Gendanne tidligere versioner.
- Redigere tekst.
- Skifte billeder.
- Skifte farver.
- Ændre sektioner.
- Tilføje og fjerne sektioner.
- Se mobilvisning.
- Se desktopvisning.

Brug en eksisterende AI-integration i projektet, hvis en sådan allerede findes og fungerer.

Hvis en AI-integration mangler, skal løsningen bygges modulært med sikker serverbaseret håndtering af API-nøgler.

Indfør ikke automatisk betalingskrævende API-kald uden at vise og dokumentere omkostningerne.

---

# 13. MANUEL HJEMMESIDEREDIGERING

Jeg vil ikke være afhængig af AI til alle ændringer.

Lav også en manuel editor.

Jeg skal kunne:

- Klikke på tekst og redigere den.
- Ændre farver.
- Skifte skrifttype.
- Uploade billeder.
- Ændre knapper.
- Flytte eller omarrangere sektioner.
- Tilføje nye sektioner.
- Slette sektioner.
- Se ændringer med det samme.

Editoren skal være nem at bruge.

Brug genanvendelige komponenter og en struktureret datamodel til hjemmesiderne, så AI-ændringer ikke ødelægger hele projektet.

Liveforhåndsvisningen skal være isoleret og sikker.

---

# 14. FORHÅNDSVISNING AF HJEMMESIDER

Når jeg har bygget en hjemmeside, vil jeg kunne se den præcis som en besøgende ville se den.

Lav følgende visninger:

- Desktop.
- Tablet.
- Mobil.

Tilføj en tydelig knap:

"Se forhåndsvisning"

Jeg skal også kunne oprette et delbart demonstrationslink.

Demonstrationen skal være tydeligt markeret som et forslag og må ikke give indtryk af, at virksomheden allerede har godkendt eller ejer den.

Brug ikke beskyttede billeder, logoer eller andet materiale uden de nødvendige rettigheder.

---

# 15. PROJEKTER OG GEMTE VIRKSOMHEDER

Lav en sektion, der hedder:

"MINE PROJEKTER"

Her skal jeg kunne se alle de hjemmesider, jeg arbejder på.

Vis eksempelvis:

- Virksomhedsnavn.
- Projektets status.
- Forhåndsvisning.
- Sidst redigeret.
- Knap til redigering.
- Knap til forhåndsvisning.

Lav også en sektion:

"MINE VIRKSOMHEDER"

Her skal jeg kunne gemme virksomheder fra kortet.

Jeg skal kunne give dem status som:

- Interessant.
- Skal undersøges.
- Vil kontakte.
- Kontaktet.
- I dialog.
- Kunde.
- Ikke relevant.

Tilføj mulighed for egne noter.

Det skal være let at vende tilbage til virksomheder, man har fundet på kortet.

---

# 16. MODERNE DESIGN AF HELE PLATFORMEN

Jeg ønsker et design, der ser ud som et færdigt professionelt produkt i 2026.

Det må IKKE ligne et standard AI-genereret skoleprojekt.

Designet skal være minimalistisk, eksklusivt og gennemført.

Brug:

- God typografi.
- Gennemførte farver.
- Afrundede hjørner.
- Flotte ikoner.
- Diskrete skygger.
- Moderne knapper.
- Glidende animationer.
- Gennemtænkt spacing.
- Hovereffekter.
- Responsivt layout.
- Tydeligt visuelt hierarki.

Jeg vil gerne have en professionel sidebar.

Eksempel på navigation:

**Kort**

**Find virksomheder**

**Mine virksomheder**

**Byg hjemmeside**

**Mine projekter**

**Kunder**

**Indstillinger**

Hovedkortet skal fylde en stor del af skærmen, så kortoplevelsen bliver god.

Ved siden af kortet skal man kunne have søgning, filtre og virksomhedsoplysninger.

Designet skal føles hurtigt og gennemarbejdet.

Lad dig inspirere af moderne SaaS-platforme og Siteflipers arbejdsgang, men skab et selvstændigt visuelt udtryk.

---

# 17. LOGIN OG BRUGERKONTI

Undersøg hvad der allerede er implementeret.

Hvis login allerede fungerer, skal det bevares.

Ellers skal arkitekturen forberedes til:

- Oprettelse af konto.
- Login.
- Logout.
- Sikker adgangskodehåndtering.
- Gemte virksomheder.
- Egne projekter.
- Egne hjemmesider.
- Brugerindstillinger.

Hver bruger skal kun kunne ændre sine egne projekter og data.

Brug sikker autentifikation og adgangskontrol.

---

# 18. FREMTIDIG KUNDESTYRING OG BETALING

Forbered platformen til, at man senere kan sælge hjemmesider til virksomheder.

Lav gerne grundstrukturen til:

- Kundeoversigt.
- Projekter pr. kunde.
- Status på aftaler.
- Engangspris.
- Månedlig betaling.
- Publiceringsstatus.

Betaling via eksempelvis Stripe kan være en senere fase.

Aktivér ikke rigtige betalinger eller abonnementer uden særskilt opsætning og godkendelse.

Fokusér først på at få kortet, virksomhedsdata og hjemmesidebyggeren til at fungere.

---

# 19. KVALITET, LOVLIGHED OG SIKKERHED

Alle funktioner skal være bygget ordentligt.

Sørg for:

- Lovlige datakilder.
- Korrekt kreditering af kortdata.
- Respekt for datalicenser.
- GDPR-hensyn.
- Sikker håndtering af API-nøgler.
- Ingen hemmelige nøgler i frontend.
- Beskyttelse mod skadelige URL'er.
- Rate limiting.
- Fejlhåndtering.
- Logging.
- Inputvalidering.
- Adgangskontrol.
- Sikker rendering af AI-genereret indhold.

Undgå uautoriseret kopiering af konkurrenters kode, billeder, grafik eller data.

Brug kun virksomhedsoplysninger, billeder og logoer, når der er et passende lovligt grundlag.

---

# 20. RET DE EKSISTERENDE FEJL

Før du begynder på de største nye funktioner, skal du gennemgå det eksisterende projekt.

Jeg har tidligere oplevet blandt andet:

- Virksomheder der ikke indlæses korrekt.
- JSON-import med manglende eller uventede felter.
- Hjemmesider med 404-fejl.
- Virksomheder uden fungerende links.
- Dubletter.
- Grå prikker uden tilstrækkelige oplysninger.
- Problemer med publicering.

Undersøg de faktiske fejl.

Lav ikke tilfældige rettelser.

Find årsagerne og løs dem korrekt.

Hvis en JSON-fil har en anden struktur end forventet, skal importsystemet kunne håndtere eller tydeligt rapportere det.

Undersøg eksisterende felter, før du laver mapping.

Undgå at slette data for at skjule en fejl.

---

# 21. ARBEJDSPLAN – SÅDAN SKAL DU IMPLEMENTERE DET

Opgaven er stor, så du skal arbejde i en fornuftig rækkefølge.

## FASE 1 – UNDERSØG OG REPARÉR

- Gennemgå eksisterende kodebase.
- Identificér teknologistak.
- Gennemgå databasen.
- Undersøg eksisterende virksomhedsimport.
- Ret fejl i JSON-import.
- Ret problemer med indlæsning.
- Bevar eksisterende funktionalitet.

## FASE 2 – BYG ET PROFESSIONELT KORT

- Forbedr kortdesign.
- Tilføj byer, veje og relevante detaljer.
- Implementér rød, orange, grøn og grå status.
- Implementér clustering.
- Byg virksomhedsinfopanel.
- Tilføj kortfiltre.
- Tilføj søgning.

## FASE 3 – FORBEDR VIRKSOMHEDSDATA

- Undersøg lovlige datakilder.
- Implementér stabil import.
- Fjern dubletter.
- Kontrollér links.
- Gem kilde og opdateringsdato.
- Udvid gradvist datadækningen.
- Gør databasen klar til hundredtusindvis af opslag.

## FASE 4 – HJEMMESIDEANALYSE

- Implementér teknisk kontrol.
- Byg kvalitetsscore.
- Implementér statusklassificering.
- Vis forklaringer på vurderinger.
- Tilføj mulighed for genkontrol.

## FASE 5 – AI-HJEMMESIDEBYGGER

- Opret hjemmesideprojekter.
- Byg branchetilpassede designs.
- Generér forslag.
- Lav liveforhåndsvisning.
- Tilføj AI-redigering.
- Tilføj manuel redigering.
- Implementér versionshistorik.

## FASE 6 – PROJEKTER OG KUNDER

- Gem virksomheder.
- Gem hjemmesideprojekter.
- Opret projektoversigt.
- Implementér status og noter.
- Tilføj delbare demonstrationslinks.

## FASE 7 – TEST OG OPTIMERING

- Test vigtige brugerflows.
- Test mobil og desktop.
- Test kort med mange virksomheder.
- Test import og genoptagelse.
- Kontrollér performance.
- Kontrollér sikkerhed.
- Ret fejl.
- Gør løsningen klar til udgivelse.

---

# 22. VIGTIGE KRAV TIL DIN ARBEJDSMETODE

Du skal ikke nøjes med at fortælle mig, hvordan funktionerne KUNNE bygges.

Jeg vil have, at du rent faktisk implementerer dem i projektet.

Følg denne metode:

1. Undersøg projektets nuværende tilstand.
2. Lav en kort teknisk implementeringsplan.
3. Begynd med første fase.
4. Skriv rigtig fungerende kode.
5. Test ændringerne.
6. Ret eventuelle fejl.
7. Gem ændringerne.
8. Fortsæt til næste fase, når det er forsvarligt.

Når en fase er færdig, skal du vise:

- Hvad der er lavet.
- Hvilke filer der er ændret.
- Hvilke tests der er gennemført.
- Hvad der virker.
- Hvad der stadig mangler.
- Om der er API-nøgler eller eksterne tjenester, jeg selv skal konfigurere.
- Eventuelle løbende omkostninger.

Du skal ikke kalde noget færdigt, hvis det kun er en placeholder.

Hvis der er begrænsninger, skal du forklare dem tydeligt.

Opret gerne en fil med navnet DEVELOPMENT_PROGRESS.md, så det bliver let at fortsætte i en senere Codex-session uden at miste overblikket.

---

# 23. MIT ENDELIGE ØNSKE

Jeg vil bygge en rigtig dansk virksomhed- og hjemmesideplatform, der kan konkurrere med eksisterende tjenester.

Når jeg åbner min platform, skal jeg kunne:

1. Se et flot og professionelt Danmarkskort.
2. Se hundredtusindvis af virksomheder, efterhånden som data importeres.
3. Se røde, orange og grønne prikker.
4. Filtrere efter virksomhedernes hjemmesidestatus.
5. Zoome ind på en hvilken som helst dansk by.
6. Klikke på en virksomhed.
7. Se virksomhedens oplysninger.
8. Se hvorfor hjemmesiden er vurderet som god eller dårlig.
9. Trykke på "Byg hjemmeside".
10. Generere et professionelt hjemmesideforslag.
11. Ændre designet med AI.
12. Redigere hjemmesiden manuelt.
13. Gemme projektet.
14. Dele en demonstration.
15. På sigt sælge hjemmesiden til virksomheden.

**Det skal være en reel, brugbar platform og ikke bare et visuelt koncept.**

Det vigtigste lige nu er at få det eksisterende kort og virksomhederne til at fungere perfekt.

Derefter skal du bygge resten systematisk.

Start med at analysere det eksisterende projekt og implementere fase 1 og fase 2. Fortsæt derefter fase for fase, så langt den tilgængelige tid og kapacitet tillader.

**BEHOLD MIN EKSISTERENDE HJEMMESIDE, FORBEDR DEN OG BYG VIDERE PÅ DEN.**