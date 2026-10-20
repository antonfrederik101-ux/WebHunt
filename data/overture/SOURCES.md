# Overture Places source policy

Official source: https://docs.overturemaps.org/attribution/
Retrieved from the official OvertureMaps/docs GitHub repository, 2026-10-20.

### Places
    </summary>
- Data from [Meta](https://about.meta.com/). Available under [CDLA Permissive 2.0](https://cdla.dev/permissive-2-0/).
- Data from [Microsoft](https://www.microsoft.com/en-us/). Available under [CDLA Permissive 2.0](https://cdla.dev/permissive-2-0/).
- Data from [PinMeTo](https://www.pinmeto.com/). Available under [CDLA Permissive 2.0](https://cdla.dev/permissive-2-0/).
- Data from [Krick](https://www.krick.com/). Available under [CDLA Permissive 2.0](https://cdla.dev/permissive-2-0/).
- Data from [RenderSEO](https://www.renderseo.com/). Available under [CDLA Permissive 2.0](https://cdla.dev/permissive-2-0/).
- Data from [DAC](https://www.dacgroup.com/). Available under [CDLA Permissive 2.0](https://cdla.dev/permissive-2-0/).
- Data from [BrightQuery](https://brightquery.com/). Available under [CDLA Permissive 2.0](https://cdla.dev/permissive-2-0/).
- Data from [Foursquare](https://foursquare.com/). Copyright 2024 Foursquare Labs, Inc. All rights reserved. Available under [Apache 2.0](https://www.apache.org/licenses/LICENSE-2.0). Foursquare data was transformed to the Overture schema. Changed: 2026-03-18. [NOTICE.txt](https://opensource.foursquare.com/places-notice-txt/).
- Data from [AllThePlaces](https://alltheplaces.xyz/). Available under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/deed.en).

WebHunt currently excludes Foursquare until the full linked upstream NOTICE can be verified and included. New or unknown providers are rejected, rather than assigned a guessed license.

Official source identifiers `metaPlaces` and `msftPlaces` are mapped explicitly to
Meta and Microsoft respectively, both under the existing CDLA-Permissive-2.0 policy.
Original identifiers and source records are retained. Evidence: OvertureMaps/schema
commit b53004401617a0709cd2ee3b872bb3672819078e, examples/places/place.yaml.
No blanket license is assigned to unknown dataset identifiers.
