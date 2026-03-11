export interface EpisodeInfo {
  season?: number;
  episode?: number;
  episodeId?: string;
}

export interface SeasonalStatus {
  isSeasonalEpisode: boolean;
  currentlySeasonal: boolean;
  seasonType?: string;
}

const SEASON_EPISODE_PATTERNS = [
  /(?:Season?\s*)?(\d+)x(\d+)/i,
  /S(\d+)E(\d+)/i,
  /(\d+)\s*x\s*(\d+)/i,
];

export function extractEpisodeInfo(imageName: string): EpisodeInfo {
  const cleanName = imageName.replace(/\.(jpg|jpeg|png|gif|bmp)$/i, '');

  for (const pattern of SEASON_EPISODE_PATTERNS) {
    const match = cleanName.match(pattern);
    if (match) {
      const season = parseInt(match[1]);
      const episode = parseInt(match[2]);
      return { season, episode, episodeId: `S${season}E${episode}` };
    }
  }

  return {};
}

export function extractEpisodeIdentifier(imageName: string): string {
  const info = extractEpisodeInfo(imageName);
  if (info.episodeId) {
    return info.episodeId;
  }
  const cleanName = imageName.replace(/\.(jpg|jpeg|png|gif|bmp)$/i, '');
  return cleanName.split('-')[0] || cleanName;
}

export function getSeasonalStatus(imageName: string): SeasonalStatus {
  const now = new Date();
  const month = now.getMonth() + 1;
  const content = imageName.toLowerCase();

  if (content.includes('halloweenie')) {
    return { isSeasonalEpisode: true, currentlySeasonal: month === 10, seasonType: 'halloween' };
  }

  if (
    content.includes('christmas_pete') ||
    content.includes("o'_christmas_pete") ||
    content.includes("new_year's_pete") ||
    content.includes('new_years_pete')
  ) {
    return { isSeasonalEpisode: true, currentlySeasonal: month === 12, seasonType: 'christmas' };
  }

  return { isSeasonalEpisode: false, currentlySeasonal: true };
}
