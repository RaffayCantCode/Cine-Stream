export function getAnimePaheUrl(animeId: string, episode: number): string {
  const numericId = animeId.replace(/\D/g, "");
  return `https://vidnest.fun/animepahe/${numericId}/${episode}/sub`;
}
