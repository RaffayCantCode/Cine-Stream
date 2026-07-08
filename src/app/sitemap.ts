import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://cine-stream.site';

  // Standard static routes
  const routes = [
    '',
    '/browse/movies',
    '/browse/tv',
    '/anime',
    '/browse/trending',
    '/browse/movies/popular',
    '/browse/movies/top-rated',
    '/browse/tv/popular',
    '/browse/tv/top-rated',
  ].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: 'daily' as const,
    priority: route === '' ? 1 : 0.8,
  }));

  // Theme routes
  const themes = [
    'k-dramas',
    'superhero',
    'true-crime',
    'sci-fi-fantasy',
    'rom-com',
    'action-packed',
    'horror-thriller',
    'fantasy-magic',
    'feel-good-comedy',
    'documentary',
  ].map((theme) => ({
    url: `${baseUrl}/browse/theme/${theme}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.6,
  }));

  return [...routes, ...themes];
}
