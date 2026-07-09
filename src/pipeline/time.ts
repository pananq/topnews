export function isWithinWindow(publishedAt: string, now: Date, hours: number): boolean {
  const publishedTime = Date.parse(publishedAt);

  if (Number.isNaN(publishedTime)) {
    return false;
  }

  const ageMs = now.getTime() - publishedTime;
  return ageMs >= 0 && ageMs <= hours * 60 * 60 * 1000;
}
