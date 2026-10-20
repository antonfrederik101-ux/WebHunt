import { osmService } from "../lib/osm-service";
(async () => {
  try {
    const result = await osmService.get(null);
    console.log(
      JSON.stringify(
        {
          count: result.businesses.length,
          fetchedAt: result.fetchedAt,
          cached: result.cached,
          stale: result.stale,
          source: result.source,
          warning: result.warning,
        },
        null,
        2,
      ),
    );
    if (result.stale) process.exitCode = 1;
  } catch (e) {
    console.error((e as Error).message);
    process.exitCode = 1;
  }
})();
