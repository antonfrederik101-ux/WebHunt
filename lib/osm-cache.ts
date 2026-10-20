import { createHash, randomUUID } from "node:crypto";
import {
  mkdir,
  readFile,
  writeFile,
  rename,
  readdir,
  stat,
  unlink,
  rmdir,
} from "node:fs/promises";
import path from "node:path";
import type { Business } from "./types";
export type Snapshot = {
  version: 1;
  key: string;
  fetchedAt: string;
  endpoint: string;
  records: Business[];
  limited: boolean;
};
export const FRESH_MS = 24 * 60 * 60 * 1000;
export const MAX_STALE_MS = 7 * FRESH_MS;
export class OsmCache {
  constructor(
    readonly directory = process.env.WEBHUNT_CACHE_DIR ||
      path.join(process.cwd(), ".data", "osm"),
  ) {}
  private file(key: string) {
    return path.join(
      this.directory,
      createHash("sha256").update(key).digest("hex") + ".json",
    );
  }
  async read(key: string): Promise<Snapshot | null> {
    try {
      const data = JSON.parse(
        await readFile(this.file(key), "utf8"),
      ) as Snapshot;
      if (
        data.version !== 1 ||
        data.key !== key ||
        !Array.isArray(data.records) ||
        !Number.isFinite(Date.parse(data.fetchedAt)) ||
        Date.now() - Date.parse(data.fetchedAt) > MAX_STALE_MS
      )
        return null;
      return data;
    } catch {
      return null;
    }
  }
  async write(snapshot: Snapshot) {
    await mkdir(this.directory, { recursive: true });
    const file = this.file(snapshot.key),
      temp = file + "." + randomUUID() + ".tmp";
    await writeFile(temp, JSON.stringify(snapshot), { mode: 0o600 });
    await rename(temp, file);
    const files = (await readdir(this.directory)).filter((f) =>
      /^[a-f0-9]{64}\.json$/.test(f),
    );
    if (files.length > 256) {
      const entries = await Promise.all(
        files.map(async (f) => ({
          f,
          time: (await stat(path.join(this.directory, f))).mtimeMs,
        })),
      );
      for (const old of entries
        .sort((a, b) => a.time - b.time)
        .slice(0, files.length - 256))
        await unlink(path.join(this.directory, old.f));
    }
  }
  async lock(): Promise<(() => Promise<void>) | null> {
    await mkdir(this.directory, { recursive: true });
    const location = path.join(this.directory, "refresh.lock");
    try {
      await mkdir(location);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
      try {
        if (Date.now() - (await stat(location)).mtimeMs > 90_000) {
          await rmdir(location);
          await mkdir(location);
        } else return null;
      } catch {
        return null;
      }
    }
    return async () => {
      await rmdir(location).catch(() => {});
    };
  }
  async partial(bounds: number[] | null): Promise<Snapshot | null> {
    try {
      const files = (await readdir(this.directory)).filter((f) =>
        /^[a-f0-9]{64}\.json$/.test(f),
      );
      const records = new Map<string, Business>();
      let oldest = Infinity;
      let endpoint = "";
      for (const file of files) {
        try {
          const s = JSON.parse(
            await readFile(path.join(this.directory, file), "utf8"),
          ) as Snapshot;
          const at = Date.parse(s.fetchedAt);
          if (
            s.version !== 1 ||
            !Number.isFinite(at) ||
            Date.now() - at > MAX_STALE_MS ||
            !Array.isArray(s.records)
          )
            continue;
          for (const b of s.records) {
            if (
              !bounds ||
              (b.lat >= bounds[0] &&
                b.lat <= bounds[2] &&
                b.lon >= bounds[1] &&
                b.lon <= bounds[3])
            ) {
              records.set(b.id, b);
              oldest = Math.min(oldest, at);
              endpoint = s.endpoint;
            }
          }
        } catch {}
      }
      if (!records.size) return null;
      return {
        version: 1,
        key: "partial",
        fetchedAt: new Date(oldest).toISOString(),
        endpoint,
        records: Array.from(records.values()).slice(0, 600),
        limited: records.size >= 600,
      };
    } catch {
      return null;
    }
  }
  async readCooldowns(): Promise<
    Record<string, { failures: number; until: number }>
  > {
    try {
      return JSON.parse(
        await readFile(path.join(this.directory, "cooldowns.json"), "utf8"),
      );
    } catch {
      return {};
    }
  }
  async writeCooldowns(
    data: Record<string, { failures: number; until: number }>,
  ) {
    await mkdir(this.directory, { recursive: true });
    const temp = path.join(this.directory, randomUUID() + ".tmp");
    await writeFile(temp, JSON.stringify(data));
    await rename(temp, path.join(this.directory, "cooldowns.json"));
  }
}
