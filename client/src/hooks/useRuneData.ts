import { useState, useEffect } from "react";
import { getDragonVersion } from "@/api/client";

export interface RunePerk {
  id: number;
  key: string;
  icon: string;
  name: string;
  shortDesc: string;
}

export interface RuneSlot {
  runes: RunePerk[];
}

export interface RunePath {
  id: number;
  key: string;
  icon: string;
  name: string;
  slots: RuneSlot[];
}

// Path name → color
export const PATH_COLORS: Record<string, string> = {
  Precision:    "#C8A332",
  Domination:   "#C0392B",
  Sorcery:      "#3498DB",
  Inspiration:  "#1ABC9C",
  Resolve:      "#27AE60",
};

// Keystone name → path name (for quick lookup)
export const KEYSTONE_PATH: Record<string, string> = {
  "Press the Attack":       "Precision",
  "Lethal Tempo":           "Precision",
  "Fleet Footwork":         "Precision",
  "Conqueror":              "Precision",
  "Electrocute":            "Domination",
  "Predator":               "Domination",
  "Dark Harvest":           "Domination",
  "Hail of Blades":         "Domination",
  "Arcane Comet":           "Sorcery",
  "Phase Rush":             "Sorcery",
  "Nullifying Orb":         "Sorcery",
  "Summon Aery":            "Sorcery",
  "Glacial Augment":        "Inspiration",
  "First Strike":           "Inspiration",
  "Grasp of the Undying":   "Resolve",
  "Aftershock":             "Resolve",
  "Guardian":               "Resolve",
};

let _paths: RunePath[] | null = null;

export function useRuneData() {
  const [paths, setPaths] = useState<RunePath[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (_paths) { setPaths(_paths); setLoaded(true); return; }
    getDragonVersion().then(ver =>
      fetch(`https://ddragon.leagueoflegends.com/cdn/${ver}/data/en_US/runesReforged.json`)
        .then(r => r.json())
        .then((data: RunePath[]) => {
          _paths = data;
          setPaths(data);
          setLoaded(true);
        })
    ).catch(() => setLoaded(true));
  }, []);

  function getPath(name: string): RunePath | undefined {
    return paths.find(p => p.name.toLowerCase() === name.toLowerCase());
  }

  function getKeystone(keystoneName: string): { perk: RunePerk; path: RunePath } | undefined {
    for (const path of paths) {
      const slot0 = path.slots[0];
      if (!slot0) continue;
      const perk = slot0.runes.find(r => r.name.toLowerCase() === keystoneName.toLowerCase());
      if (perk) return { perk, path };
    }
    return undefined;
  }

  return { paths, loaded, getPath, getKeystone };
}
