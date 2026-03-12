interface EpisodeInfo {
  season?: number;
  episode?: number;
  episodeId?: string;
}

export interface SeasonalStatus {
  isSeasonalEpisode: boolean;
  seasonType?: string;
}

function extractEpisodeInfo(imageName: string): EpisodeInfo {
  const cleanName = imageName.replace(/\.(jpg|jpeg|png|gif|bmp)$/i, '');

  // Shorts: "The_Adventures_of_Pete_&_Pete_-_0x01_-_..." → Short1
  const shortMatch = cleanName.match(/(\d+)x(\d+)/i);
  if (shortMatch && cleanName.includes('Pete_&_Pete')) {
    return { season: 0, episode: parseInt(shortMatch[2]), episodeId: `Short${parseInt(shortMatch[2])}` };
  }

  // Standard: S01E08, S00E05, etc.
  const stdMatch = cleanName.match(/S(\d+)E(\d+)/i);
  if (stdMatch) {
    const season = parseInt(stdMatch[1]);
    const episode = parseInt(stdMatch[2]);
    return { season, episode, episodeId: `S${season}E${episode}` };
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
  const content = imageName.toLowerCase();

  // S02E06 Halloweenie + 0x17 Halloween short
  if (content.includes('halloweenie') || content.includes('0x17_-_halloween')) {
    return { isSeasonalEpisode: true, seasonType: 'halloween' };
  }

  // S03E11 O' Christmas Pete + S00E05 New Year's Pete
  if (
    content.includes('christmas_pete') ||
    content.includes("o'_christmas_pete") ||
    content.includes("new_year's_pete") ||
    content.includes('new_years_pete')
  ) {
    return { isSeasonalEpisode: true, seasonType: 'christmas' };
  }

  return { isSeasonalEpisode: false };
}
