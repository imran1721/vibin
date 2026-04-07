import Ably from "ably";

let rest: Ably.Rest | null = null;

export function getAblyRest(): Ably.Rest {
  if (rest) return rest;
  const key = process.env.ABLY_API_KEY;
  if (!key) {
    throw new Error("Missing ABLY_API_KEY");
  }
  rest = new Ably.Rest({ key });
  return rest;
}

