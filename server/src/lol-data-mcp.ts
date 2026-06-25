import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MCP_DIR = path.resolve(__dirname, "../../lol-data-mcp");
const PYTHON = path.join(MCP_DIR, "venv", "Scripts", "python.exe");

let _client: Client | null = null;
let _connectPromise: Promise<Client> | null = null;

async function ensureClient(): Promise<Client> {
  if (_client) return _client;
  if (_connectPromise) return _connectPromise;

  _connectPromise = (async () => {
    try {
      const transport = new StdioClientTransport({
        command: PYTHON,
        args: ["-m", "src.mcp_server.stdio_server"],
        env: { ...process.env, PYTHONPATH: MCP_DIR } as Record<string, string>,
      });
      const client = new Client({ name: "soul-point-server", version: "1.0.0" });
      await client.connect(transport);
      _client = client;
      return client;
    } finally {
      _connectPromise = null;
    }
  })();

  return _connectPromise;
}

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  try {
    const client = await ensureClient();
    const result = await client.callTool({ name, arguments: args });
    const content = (result as { content?: Array<{ type: string; text?: string }> })?.content;
    const text = content?.[0]?.text;
    if (text) {
      try { return JSON.parse(text); } catch { return text; }
    }
    return result;
  } catch (err) {
    _client = null;
    throw err;
  }
}

// ── Champion tools ────────────────────────────────────────────

export async function getChampionStats(champion: string, level?: number): Promise<unknown> {
  const args: Record<string, unknown> = { champion };
  if (level !== undefined) args.level = level;
  return callTool("get_champion_stats", args);
}

export async function getChampionAbilities(champion: string, abilitySlot?: string): Promise<unknown> {
  const args: Record<string, unknown> = { champion };
  if (abilitySlot) args.ability_slot = abilitySlot;
  return callTool("get_champion_abilities", args);
}

export async function getChampionPatchNote(championName: string, patchVersion?: string): Promise<unknown> {
  const args: Record<string, unknown> = { champion_name: championName };
  if (patchVersion) args.patch_version = patchVersion;
  return callTool("get_champion_patch_note", args);
}

// ── Item tools ────────────────────────────────────────────────

export async function getItemData(itemName: string, sections?: string[]): Promise<unknown> {
  const args: Record<string, unknown> = { item_name: itemName };
  if (sections?.length) args.sections = sections;
  return callTool("get_item_data", args);
}

export async function getItemPatchNote(itemName: string, patchVersion?: string): Promise<unknown> {
  const args: Record<string, unknown> = { item_name: itemName };
  if (patchVersion) args.patch_version = patchVersion;
  return callTool("get_item_patch_note", args);
}

// ── Rune tools ────────────────────────────────────────────────

export async function getRuneData(runeName: string, sections?: string[]): Promise<unknown> {
  const args: Record<string, unknown> = { rune_name: runeName };
  if (sections?.length) args.sections = sections;
  return callTool("get_rune_data", args);
}

export async function getRunePatchNote(runeName: string, patchVersion?: string): Promise<unknown> {
  const args: Record<string, unknown> = { rune_name: runeName };
  if (patchVersion) args.patch_version = patchVersion;
  return callTool("get_rune_patch_note", args);
}

// ── Server status ─────────────────────────────────────────────

export async function ping(): Promise<unknown> {
  return callTool("ping", {});
}
