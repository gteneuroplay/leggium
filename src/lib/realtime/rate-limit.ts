type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

export function assertRateLimit(
  key: string,
  {
    max,
    windowMs,
    message,
  }: {
    max: number;
    windowMs: number;
    message: string;
  }
) {
  const now = Date.now();
  const current = buckets.get(key);

  if (!current || now >= current.resetAt) {
    buckets.set(key, {
      count: 1,
      resetAt: now + windowMs,
    });
    return;
  }

  if (current.count >= max) {
    throw new Error(message);
  }

  current.count += 1;
  buckets.set(key, current);
}
