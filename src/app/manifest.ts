import { MetadataRoute } from 'next'
 
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Cine-Stream',
    short_name: 'Cine-Stream',
    description: 'A premium streaming platform for movies, TV shows, and anime.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0d1233',
    theme_color: '#4B5694',
    icons: [
      {
        src: '/icon.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon.png',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: '/apple-icon.png',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
  }
}
