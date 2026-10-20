export function compareReleases(a: string, b: string) {
  const parse = (value: string) => {
    const match = /^(\d{4}-\d{2}-\d{2})\.(\d+)$/.exec(value);
    if (!match || !Number.isFinite(Date.parse(match[1])))
      throw new Error("Ugyldig Overture-udgivelse.");
    return { date: match[1], patch: BigInt(match[2]) };
  };
  const left = parse(a),
    right = parse(b);
  return left.date !== right.date
    ? left.date < right.date
      ? -1
      : 1
    : left.patch === right.patch
      ? 0
      : left.patch < right.patch
        ? -1
        : 1;
}
