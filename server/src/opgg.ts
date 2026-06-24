import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const OPGG_MCP_URL = "https://mcp-api.op.gg/mcp";

// ── OP.GG class-notation parser ───────────────────────────────
// The MCP returns a compact "ClassName(field1,field2,...)" notation
// alongside schema headers like "class Foo: a,b,c"

function splitByComma(s: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let inStr = false;
  let start = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '"' && s[i - 1] !== '\\') inStr = !inStr;
    else if (!inStr) {
      if (ch === '(' || ch === '[') depth++;
      else if (ch === ')' || ch === ']') depth--;
      else if (ch === ',' && depth === 0) {
        parts.push(s.slice(start, i));
        start = i + 1;
      }
    }
  }
  if (start < s.length) parts.push(s.slice(start));
  return parts;
}

function parseVal(s: string, schemas: Record<string, string[]>): unknown {
  s = s.trim();
  if (!s || s === 'null' || s === 'None') return null;
  if (s === 'true')  return true;
  if (s === 'false') return false;

  // String literal
  if (s.startsWith('"')) {
    let i = 1;
    while (i < s.length && !(s[i] === '"' && s[i - 1] !== '\\')) i++;
    return s.slice(1, i);
  }

  // Array
  if (s.startsWith('[')) {
    const inner = s.slice(1, s.lastIndexOf(']')).trim();
    if (!inner) return [];
    return splitByComma(inner).map(a => parseVal(a.trim(), schemas));
  }

  // Class instance: Name(args...)
  const parenIdx = s.indexOf('(');
  if (parenIdx > 0) {
    const className = s.slice(0, parenIdx);
    const argsStr   = s.slice(parenIdx + 1, s.lastIndexOf(')'));
    const fields    = schemas[className];
    if (fields) {
      const args = argsStr.trim() ? splitByComma(argsStr) : [];
      const obj: Record<string, unknown> = {};
      fields.forEach((field, i) => {
        obj[field] = i < args.length ? parseVal(args[i].trim(), schemas) : null;
      });
      return obj;
    }
    return s; // unknown class — return raw
  }

  // Number
  const num = Number(s);
  return isNaN(num) ? s : num;
}

export function parseOPGGClassNotation(text: string): unknown {
  const lines   = text.split('\n');
  const schemas: Record<string, string[]> = {};
  let dataStart = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const m = line.match(/^class (\w+\d*): (.+)$/);
    if (m) {
      schemas[m[1]] = m[2].split(',').map(f => f.trim());
      dataStart = i + 1;
    }
  }

  const dataStr = lines.slice(dataStart).join('').trim();
  return parseVal(dataStr, schemas);
}

// ── Champion name → OP.GG UPPER_SNAKE_CASE ───────────────────
function toOpggChampion(name: string): string {
  return name
    .toUpperCase()
    .replace(/['’]/g, "")     // Kai'Sa → KAISA
    .replace(/&/g, "AND")          // Nunu & Willump → NUNU AND WILLUMP
    .replace(/\./g, "")            // Dr. Mundo → DR MUNDO
    .replace(/[^A-Z0-9]+/g, "_")  // spaces/symbols → _
    .replace(/^_+|_+$/g, "");     // trim leading/trailing _
}

// ── Position & tier mappings ──────────────────────────────────
const POSITION_MAP: Record<string, string> = {
  Top: "top", Jungle: "jungle", Mid: "mid", ADC: "adc", Support: "support",
};

const TIER_MAP: Record<string, string> = {
  CHALLENGER: "challenger",
  MASTER:     "master_plus",
  DIAMOND:    "diamond_plus",
  EMERALD:    "emerald_plus",
  PLATINUM:   "platinum_plus",
  GOLD:       "gold_plus",
};

// ── Singleton client ──────────────────────────────────────────
let _client: Client | null = null;

async function ensureClient(): Promise<Client> {
  if (_client) return _client;
  const transport = new StreamableHTTPClientTransport(new URL(OPGG_MCP_URL));
  const client = new Client({ name: "soul-point", version: "1.0.0" });
  await client.connect(transport);
  _client = client;
  return client;
}

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  try {
    const client = await ensureClient();
    const result = await client.callTool({ name, arguments: args });

    // Extract text content and parse the OP.GG class notation into plain JSON
    const content = (result as { content?: Array<{ type: string; text?: string }> })?.content;
    const text = content?.[0]?.text;
    if (text) {
      try { return parseOPGGClassNotation(text); } catch { /* fall through */ }
    }
    return result;
  } catch (err) {
    _client = null;
    throw err;
  }
}

// ── Exported helpers ──────────────────────────────────────────

export async function fetchChampionAnalysis(
  championName: string,
  position: string,
  rankKey?: string,
): Promise<unknown> {
  const opggPos  = POSITION_MAP[position] ?? position.toLowerCase();
  const opggTier = rankKey ? (TIER_MAP[rankKey] ?? undefined) : undefined;

  const args: Record<string, unknown> = {
    champion:  toOpggChampion(championName),
    position:  opggPos,
    game_mode: "RANKED",
  };
  if (opggTier) args.tier = opggTier;

  return callTool("lol_get_champion_analysis", args);
}

export async function fetchLaneMetaChampions(
  position: string,
  rankKey?: string,
): Promise<unknown> {
  const opggPos  = POSITION_MAP[position] ?? position.toLowerCase();
  const opggTier = rankKey ? (TIER_MAP[rankKey] ?? undefined) : undefined;

  const args: Record<string, unknown> = {
    position:  opggPos,
    game_mode: "RANKED",
  };
  if (opggTier) args.tier = opggTier;

  return callTool("lol_list_lane_meta_champions", args);
}

export async function fetchChampionSynergies(
  championName: string,
  position: string,
): Promise<unknown> {
  return callTool("lol_get_champion_synergies", {
    champion:  toOpggChampion(championName),
    position:  POSITION_MAP[position] ?? position.toLowerCase(),
    game_mode: "RANKED",
  });
}
