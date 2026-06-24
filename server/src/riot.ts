// Riot API routing helpers

export const PLATFORM_MAP: Record<string, string> = {
  NA:   "na1",
  EUW:  "euw1",
  EUNE: "eune1",
  KR:   "kr",
  BR:   "br1",
  LAN:  "la1",
  LAS:  "la2",
  OCE:  "oc1",
  TR:   "tr1",
  RU:   "ru",
  JP:   "jp1",
};

export const REGIONAL_MAP: Record<string, string> = {
  NA:   "americas",
  EUW:  "europe",
  EUNE: "europe",
  KR:   "asia",
  BR:   "americas",
  LAN:  "americas",
  LAS:  "americas",
  OCE:  "sea",
  TR:   "europe",
  RU:   "europe",
  JP:   "asia",
};

export function platformUrl(region: string): string {
  const platform = PLATFORM_MAP[region.toUpperCase()] ?? "na1";
  return `https://${platform}.api.riotgames.com`;
}

export function regionalUrl(region: string): string {
  const regional = REGIONAL_MAP[region.toUpperCase()] ?? "americas";
  return `https://${regional}.api.riotgames.com`;
}

export async function riotFetch(url: string, apiKey: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { "X-Riot-Token": apiKey },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    let message = `Riot API error ${res.status}`;
    try {
      const json = JSON.parse(text);
      message = json.status?.message ?? message;
    } catch { /* use default */ }
    const err = new Error(message);
    (err as Error & { status: number }).status = res.status;
    throw err;
  }

  return res.json();
}
