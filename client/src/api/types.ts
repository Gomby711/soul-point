// ── Riot API response types ──────────────────────────────────

export interface RiotAccount {
  puuid: string;
  gameName: string;
  tagLine: string;
}

export interface Summoner {
  id: string;
  accountId: string;
  puuid: string;
  name: string;
  profileIconId: number;
  revisionDate: number;
  summonerLevel: number;
}

export interface LeagueEntry {
  leagueId: string;
  summonerId: string;
  summonerName: string;
  queueType: "RANKED_SOLO_5x5" | "RANKED_FLEX_SR" | "RANKED_TFT" | string;
  tier: string;
  rank: string;
  leaguePoints: number;
  wins: number;
  losses: number;
  hotStreak: boolean;
  veteran: boolean;
  freshBlood: boolean;
  inactive: boolean;
  miniSeries?: {
    losses: number;
    progress: string;
    target: number;
    wins: number;
  };
}

export interface MatchParticipant {
  puuid: string;
  summonerName: string;
  riotIdGameName: string;
  riotIdTagline: string;
  championId: number;
  championName: string;
  teamId: number;
  win: boolean;
  kills: number;
  deaths: number;
  assists: number;
  totalMinionsKilled: number;
  neutralMinionsKilled: number;
  visionScore: number;
  totalDamageDealtToChampions: number;
  goldEarned: number;
  goldSpent: number;
  item0: number; item1: number; item2: number;
  item3: number; item4: number; item5: number; item6: number;
  individualPosition: string;
  teamPosition: string;
  lane: string;
  role: string;
  doubleKills: number;
  tripleKills: number;
  quadraKills: number;
  pentaKills: number;
  largestMultiKill: number;
  champLevel?: number;
  wardsPlaced?: number;
  wardsKilled?: number;
  totalDamageTaken?: number;
  profileIcon: number;
  summoner1Id: number;
  summoner2Id: number;
  perk?: {
    styles: Array<{
      description: string;
      style: number;
      selections: Array<{ perk: number; var1: number; var2: number; var3: number }>;
    }>;
  };
  perks?: {
    statPerks: { defense: number; flex: number; offense: number };
    styles: Array<{
      description: string;
      style: number;
      selections: Array<{ perk: number; var1: number; var2: number; var3: number }>;
    }>;
  };
}

export interface Match {
  metadata: {
    dataVersion: string;
    matchId: string;
    participants: string[];
  };
  info: {
    gameCreation: number;
    gameDuration: number;
    gameEndTimestamp: number;
    gameId: number;
    gameMode: string;
    gameName: string;
    gameStartTimestamp: number;
    gameType: string;
    gameVersion: string;
    mapId: number;
    participants: MatchParticipant[];
    platformId: string;
    queueId: number;
    teams: Array<{
      teamId: number;
      win: boolean;
      bans: Array<{ championId: number; pickTurn: number }>;
      objectives: Record<string, { first: boolean; kills: number }>;
    }>;
    tournamentCode?: string;
  };
}

export interface ChampionMastery {
  puuid: string;
  championId: number;
  championLevel: number;
  championPoints: number;
  lastPlayTime: number;
  championPointsSinceLastLevel: number;
  championPointsUntilNextLevel: number;
  chestGranted: boolean;
  tokensEarned: number;
  summonerId: string;
  championSeasonMilestone: number;
}

export interface ChallengeData {
  totalPoints: {
    level: string;
    current: number;
    max: number;
    percentile: number;
  };
  categoryPoints: Record<string, {
    level: string;
    current: number;
    max: number;
    percentile: number;
  }>;
  challenges: Array<{
    challengeId: number;
    percentile: number;
    level: string;
    value: number;
    achievedTime?: number;
  }>;
  preferences: {
    bannerAccent: string;
    title: string;
    challengeIds: number[];
    crestBorder: string;
    prestigeCrestBorderLevel: number;
  };
}

// ── Dragon Data types ────────────────────────────────────────

export interface DragonChampion {
  id: string;
  key: string;
  name: string;
  title: string;
  blurb: string;
  image: { full: string; sprite: string; group: string };
  tags: string[];
  stats: Record<string, number>;
  partype: string;
}

export interface DragonItem {
  name: string;
  description: string;
  colloq: string;
  plaintext: string;
  image: { full: string };
  gold: { base: number; purchasable: boolean; total: number; sell: number };
  tags: string[];
  stats: Record<string, number>;
}

// ── Soul Point Algorithm types ───────────────────────────────

export interface SoulPointBuild {
  rank: number;
  label: string;
  coreItems: number[];
  keystoneId: number;
  keystoneName: string;
  primaryPath: number;
  primaryPathName: string;
  primaryPathColor: string;
  secondaryPath: number;
  secondaryPathName: string;
  secondaryPathColor: string;
  runes: number[];
  wins: number;
  losses: number;
  games: number;
  winRate: number;
  pickRate: number;
  soulPointScore: number;
}

export interface ChampionSoulPoint {
  champion: string;
  totalGames: number;
  builds: SoulPointBuild[];
  lastUpdated: number;
}

export interface CrawlStatus {
  state: "idle" | "running" | "done" | "error";
  progress: number;
  totalPlayers: number;
  processedPlayers: number;
  totalMatches: number;
  processedMatches: number;
  champsCovered: number;
  matchesInDB: number;
  message: string;
  startedAt: number | null;
  completedAt: number | null;
  region: string;
}

// ── App-level types ──────────────────────────────────────────

export type Region = "NA" | "EUW" | "EUNE" | "KR" | "BR" | "LAN" | "LAS" | "OCE" | "TR" | "RU" | "JP";

export type QueueType = "RANKED_SOLO" | "RANKED_FLEX" | "ARAM" | "NORMAL" | "ARENA" | "TFT" | "ALL";

export interface PlayerProfile {
  account: RiotAccount;
  summoner: Summoner;
  soloQueue: LeagueEntry | null;
  flexQueue: LeagueEntry | null;
  region: Region;
}

export interface TFTLeagueEntry {
  leagueId: string;
  summonerId: string;
  queueType: string;
  tier: string;
  rank: string;
  leaguePoints: number;
  wins: number;
  losses: number;
  hotStreak: boolean;
  veteran: boolean;
  freshBlood: boolean;
  inactive: boolean;
}
