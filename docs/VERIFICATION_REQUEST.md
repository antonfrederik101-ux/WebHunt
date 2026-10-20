# VIGTIG OPDATERING – RET VIRKSOMHEDSDATA OG HJEMMESIDEANALYSE

Min platform fungerer nu, og der er importeret cirka 600 virksomheder i Nykøbing Falster.

Systemet har markeret cirka 205 virksomheder med røde prikker, men resten står som "Ikke undersøgt".

Jeg har manuelt undersøgt nogle af virksomhederne og opdaget, at flere ikke længere eksisterer.

Dette er et alvorligt problem, som skal løses, inden platformen kan offentliggøres.

Jeg vil have, at du retter det eksisterende system grundigt.

**VIGTIGT:**
- Start ikke projektet forfra.
- Behold det eksisterende kort og databasen.
- Ret problemerne i den nuværende kode.
- Brug rigtige data og rigtige kontroller.
- Ingen fiktive virksomheder eller opdigtede analyser.
- Gennemfør ændringerne og test dem.

## 1. KONTROLLÉR OM VIRKSOMHEDERNE STADIG EKSISTERER

Det første og vigtigste er at undersøge, om hver importeret virksomhed stadig er aktiv.

Brug pålidelige og lovlige datakilder.

Undersøg mulighederne for at bruge:
- Det danske CVR-register via lovlige og tilgængelige grænseflader.
- Offentlige virksomhedsoplysninger.
- Overture Maps.
- OpenStreetMap.
- Andre troværdige kilder, der må bruges til dette formål.

Match virksomheder ved hjælp af CVR-nummer, hvis det findes, og ellers navn, adresse og andre relevante oplysninger.

Vær opmærksom på, at nogle virksomheder har skiftet navn eller adresse.

En hjemmeside, der ikke virker, betyder IKKE automatisk, at virksomheden er lukket.

### Opret en separat virksomhedsstatus:

**AKTIV**
Virksomheden er bekræftet aktiv i en pålidelig kilde.

**LUKKET**
Der er troværdig dokumentation for, at virksomheden er ophørt eller lukket.

**USIKKER**
Systemet har ikke tilstrækkelige oplysninger til at afgøre, om virksomheden stadig eksisterer.

**MANGLENDE DATA**
Der findes ikke tilstrækkelige oplysninger til at identificere virksomheden sikkert.

Virksomheder, der er bekræftet lukkede, skal automatisk skjules fra det offentlige Danmarkskort.

Virksomheder med usikker status skal som udgangspunkt ikke vises som bekræftede salgsmuligheder.

Slet ikke virksomheder permanent fra databasen uden videre. Behold deres kildeoplysninger og kontrolhistorik, så fejl kan undersøges.

Jeg vil have en separat administratoroversigt, hvor jeg kan se lukkede og usikre virksomheder.

## 2. KONTROLLÉR ALLE DE 600 VIRKSOMHEDER I NYKØBING FALSTER

Gennemgå den eksisterende import igen.

For hver virksomhed skal systemet forsøge at undersøge:

1. Eksisterer virksomheden stadig?
2. Er den aktiv?
3. Er adressen korrekt?
4. Er virksomheden flyttet?
5. Er virksomheden allerede registreret under et andet navn?
6. Findes der dubletter?
7. Har virksomheden en hjemmeside?
8. Virker hjemmesiden?
9. Kan hjemmesiden forbedres?

Start med at validere de cirka 600 eksisterende virksomheder, før du udvider importen til flere byer.

Vis en rapport over:

- Virksomheder undersøgt.
- Bekræftede aktive virksomheder.
- Bekræftede lukkede virksomheder.
- Virksomheder med usikker status.
- Dubletter.
- Virksomheder uden registreret hjemmeside.
- Virksomheder med forbedringspotentiale.
- Virksomheder med velfungerende hjemmeside.

Alle tal skal komme fra faktiske kontroller.

## 3. IMPLEMENTÉR DE TRE VIGTIGSTE FARVER KORREKT

Jeg vil have dette farvesystem:

🔴 **RØD – INGEN HJEMMESIDE**

En bekræftet aktiv virksomhed, hvor systemet efter en rimelig søgning ikke har fundet en registreret hjemmeside.

Virksomheden skal ikke markeres rød, hvis den er lukket.

Hvis der kun findes en Facebook-side, må systemet gerne registrere den, men samtidig forklare, at der ikke er fundet en selvstændig hjemmeside.

🟠 **ORANGE – KAN FORBEDRES**

En aktiv virksomhed med en hjemmeside, som har dokumenterede problemer.

Eksempler:
- Forældet eller dårligt fungerende design.
- Dårlig mobiltilpasning.
- Langsom indlæsning.
- Tekniske fejl.
- Ødelagte links.
- Problemer med navigation.
- Dårlig tilgængelighed.
- Dårlig brugeroplevelse.
- Vedvarende fejl på hjemmesiden.

Der skal være en konkret begrundelse for, hvorfor hjemmesiden er orange.

🟢 **GRØN – VELFUNGERENDE HJEMMESIDE**

En aktiv virksomhed med en hjemmeside, som er blevet kontrolleret og vurderet til at fungere godt.

Eksempler:
- Hjemmesiden indlæses korrekt.
- Den fungerer på mobil.
- Navigationen virker.
- Hjemmesiden er overskuelig.
- Der er ingen væsentlige registrerede tekniske problemer.
- Den har acceptabel ydeevne.

En HTTP 200-status alene må ikke være nok til at klassificere hjemmesiden som grøn.

⚪ **GRÅ – ENDNU IKKE UNDERSØGT**

Bruges kun, når hjemmesidens kvalitet endnu ikke er kontrolleret, eller når der mangler tilstrækkelige oplysninger.

Målet er at få så mange bekræftede aktive virksomheder som muligt fordelt mellem rød, orange og grøn.

## 4. AUTOMATISK HJEMMESIDEKONTROL

Byg eller forbedr et automatisk system til at kontrollere virksomheders hjemmesider.

Det skal kunne:

- Kontrollere om domænet eksisterer.
- Kontrollere HTTP-status.
- Følge redirects.
- Registrere 404- og 410-fejl.
- Registrere gentagne timeout-fejl.
- Kontrollere HTTPS.
- Undersøge mobilvenlighed.
- Måle grundlæggende performance.
- Undersøge centrale navigationsfunktioner.
- Registrere ødelagte links.
- Beregne en kvalitetsscore.
- Gemme alle analyseresultater i databasen.

Brug eksempelvis Lighthouse eller andre relevante analyseværktøjer.

Kontrollen skal foregå serverbaseret med rate limiting, timeout og beskyttelse mod usikre URL'er og SSRF.

Overhold datakildernes og hjemmesidernes relevante adgangsvilkår.

Undgå at kontrollere de samme hjemmesider igen og igen uden grund.

## 5. LAV EN KVALITETSSCORE FRA 0 TIL 100

Lav en konkret og gennemsigtig vurdering af hjemmesider.

Eksempel på vurderingsområder:

- Performance: 20 point.
- Mobilvenlighed: 20 point.
- Brugervenlighed/navigation: 20 point.
- Tilgængelighed: 15 point.
- Teknisk funktionalitet: 15 point.
- Design og overskuelighed: 10 point.

Pointfordelingen må gerne forbedres, hvis du finder en mere fagligt forsvarlig model.

Forslag til klassificering:

- 0–59 point: Orange.
- 60–79 point: Orange, hvis der stadig er tydelige forbedringsmuligheder.
- 80–100 point: Grøn, hvis alle væsentlige kvalitetskrav er opfyldt.

Brug ikke en beregnet score, hvis der mangler nødvendige målinger.

Hvis hjemmesiden ikke kan vurderes pålideligt, skal status være "Ikke undersøgt" eller "Kontrol mislykkedes".

AI må gerne hjælpe med designvurderingen, men må ikke opfinde fejl eller resultater.

## 6. FIX PROBLEMET MED DE 205 RØDE VIRKSOMHEDER

Undersøg de 205 virksomheder, som allerede er markeret røde.

Find ud af, hvorfor de er røde.

Er det fordi:
- De mangler en registreret hjemmeside?
- Deres hjemmeside ikke kunne indlæses?
- Der mangler hjemmesideoplysninger i databasen?
- Virksomheden er lukket?
- Importen ikke har fundet den korrekte hjemmeside?

Ret de eksisterende klassificeringer, hvis de er forkerte.

En virksomhed må ikke være rød, bare fordi importen fejlede.

Et mislykket opslag må heller ikke blive behandlet som bevis på, at virksomheden ingen hjemmeside har.

## 7. UNDERSØG RESTEN AF VIRKSOMHEDERNE

Der er omkring 395 virksomheder, som ikke er færdigundersøgt.

Jeg vil have, at du laver et system, der automatisk gennemgår dem i batches.

Systemet skal:
- Fortsætte efter afbrydelser.
- Vise fremskridt.
- Gemme resultater løbende.
- Kunne genoptages.
- Registrere mislykkede kontroller.
- Undgå unødige gentagelser.

Vis eksempelvis:

"Undersøgt: 350 ud af 600 virksomheder"

og

"Røde: 120 | Orange: 145 | Grønne: 85 | Afventer: 200"

Tallene er kun eksempler. Vis de rigtige tal fra databasen.

## 8. FORBEDR INFORMATIONSPANELET

Når jeg klikker på en virksomhed, skal jeg kunne se:

- Virksomhedens navn.
- Adresse.
- CVR-nummer, hvis tilgængeligt.
- Branche.
- Virksomhedsstatus.
- Hjemmesideadresse.
- Hjemmesidens farvekode.
- Hjemmesidens kvalitetsscore.
- Konkrete problemer fundet ved analysen.
- Datakilde.
- Dato for seneste kontrol.

Hvis virksomheden er aktiv og har en dårlig hjemmeside, skal der være en tydelig knap:

"Byg en bedre hjemmeside"

Hvis virksomheden mangler en hjemmeside:

"Byg hjemmeside"

Hvis virksomheden er lukket, skal den ikke vises som en salgsmulighed.

## 9. GØR SYSTEMET KLAR TIL HELE DANMARK

Selvom vi starter med de 600 virksomheder i Nykøbing Falster, er målet stadig HELE DANMARK.

På sigt skal systemet kunne håndtere 300.000–500.000 virksomheder.

Derfor skal virksomhedsvalidering, hjemmesidekontrol og kvalitetsvurdering kunne køre automatisk i batches på store datamængder.

Det skal være muligt at genkontrollere virksomheders status løbende, da virksomheder kan lukke eller ændre oplysninger.

Brug effektive databaseforespørgsler, jobkøer og caching, når det er relevant.

## 10. TEST ALT INDEN UDGIVELSE

Dette er meget vigtigt.

Du må ikke bare sætte nogle tilfældige farver på kortet.

Du skal kontrollere, at farverne bygger på faktiske analyser og troværdige data.

Lav automatiske tests med eksempler på:

1. Aktiv virksomhed uden hjemmeside.
2. Aktiv virksomhed med dårlig hjemmeside.
3. Aktiv virksomhed med god hjemmeside.
4. Lukket virksomhed.
5. Virksomhed med ukendt status.
6. Virksomhed med midlertidig hjemmesidefejl.
7. Dublet.
8. Virksomhed, der har skiftet adresse eller navn.

Test også de faktiske eksisterende virksomheder i Nykøbing Falster.

Lav en rapport over resultatet.

## 11. VIGTIG ARBEJDSINSTRUKTION

Start med at finde årsagen til, at de fleste virksomheder ikke er undersøgt, og hvorfor nogle lukkede virksomheder stadig vises.

Implementér derefter en korrekt virksomhedsvalidering og en reel hjemmesideanalyse.

Ret databasen og kortvisningen, så lukkede virksomheder automatisk skjules fra det offentlige kort.

Gennemgå derefter de 600 virksomheder systematisk.

Begynd ikke på nye AI-hjemmesidebyggerfunktioner endnu.

Fokusér udelukkende på:

1. At finde rigtige og aktive virksomheder.
2. At finde korrekte hjemmesideadresser.
3. At identificere virksomheder uden hjemmeside.
4. At identificere dårlige hjemmesider.
5. At identificere gode hjemmesider.
6. At få kortets farver til at vise korrekte resultater.

Vis mig til sidst, hvor mange virksomheder der er bekræftet aktive, hvor mange der er lukkede, og hvor mange der er røde, orange og grønne.

Hvis en kontrol ikke kan gennemføres pålideligt, skal du forklare hvorfor, frem for at opfinde et resultat.

**DET VIGTIGSTE ER, AT PLATFORMEN VISER TROVÆRDIGE VIRKSOMHEDER OG KORREKTE HJEMMESIDESTATUSSER.**

Implementér ændringerne i den eksisterende kode, test dem grundigt, og gør dem klar til udgivelse.