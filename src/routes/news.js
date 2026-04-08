import express from 'express';
import axios from 'axios';
import logger from '../utils/logger.js';

const router = express.Router();

// Cache per le notizie (2 ore - Jikan cambia spesso)
let newsCache = [];
let cacheTime = 0;

// Fetcha VERE notizie di annunci, nuovi anime e manga da Jikan API
const fetchNewsFromJikan = async () => {
  try {
    const now = Date.now();
    // Se il cache è fresco (meno di 2 ore), restituiscilo
    if (newsCache.length > 0 && now - cacheTime < 2 * 60 * 60 * 1000) {
      console.log('📦 Using cached news');
      return newsCache;
    }

    console.log('📰 Fetching REAL anime news: announcements & new releases...');
    
    try {
      // Fetcha anime in USCITA ADESSO (airing now)
      const airingResponse = await axios.get('https://api.jikan.moe/v4/top/anime', {
        params: {
          filter: 'airing',
          limit: 20
        },
        timeout: 8000
      });

      // Fetcha top anime (top rated & trending = nuovi successi)
      const trendingResponse = await axios.get('https://api.jikan.moe/v4/top/anime', {
        params: {
          limit: 20,
          page: 1
        },
        timeout: 8000
      });

      console.log('✅ Both API responses received');

      const airingAnimes = airingResponse.data?.data || [];
      const trendingAnimes = trendingResponse.data?.data || [];
      
      console.log(`📊 Airing now: ${airingAnimes.length}, Top trending: ${trendingAnimes.length}`);

      const newsItems = [];
      
      // Crea notizie da anime in uscita (NUOVE USCITE)
      airingAnimes.forEach((anime, index) => {
        const airedDate = anime.aired?.from ? new Date(anime.aired.from) : new Date();
        newsItems.push({
          id: `jikan-airing-${anime.mal_id}`,
          title: `🎬 ${anime.title} - Ora in onda!`,
          description: `${anime.synopsis ? anime.synopsis.substring(0, 180) : 'Dagli creatori di...'} \n⭐ Score: ${anime.score}/10 | 📺 Ep: ${anime.episodes || '?'}`,
          imageUrl: anime.images?.webp?.large_image_url || anime.images?.jpg?.large_image_url || 'https://via.placeholder.com/400x300',
          releaseDate: airedDate.toISOString(),
          category: 'Now Airing',
          source: 'Jikan (MyAnimeList)',
          malLink: anime.url || 'https://myanimelist.net/',
          authorId: 'jikan',
          viewCount: anime.scored_by ? Math.floor(anime.scored_by / 50) : 2000,
          likeCount: Math.floor((anime.score || 6) * 800),
          isBreakingNews: index < 3,
          metadata: {
            type: 'AIRING_NOW',
            score: anime.score,
            episodes: anime.episodes,
            status: anime.status,
            studio: anime.studios?.[0]?.name || 'Unknown'
          }
        });
      });

      // Crea notizie da trending anime (NUOVI SUCCESSI)
      trendingAnimes.slice(0, 10).forEach((anime, index) => {
        const releaseDate = anime.aired?.from ? new Date(anime.aired.from) : new Date();
        newsItems.push({
          id: `jikan-trending-${anime.mal_id}`,
          title: `🆕 ${anime.title} - TRENDING MONDIALE!`,
          description: `Nuovo anime che sta conquistando tutti! ⭐ ${anime.score}/10 | ${anime.rating || 'Family Friendly'} | ${anime.source || 'Manga Adaptation'}`,
          imageUrl: anime.images?.webp?.large_image_url || anime.images?.jpg?.large_image_url || 'https://via.placeholder.com/400x300',
          releaseDate: releaseDate.toISOString(),
          category: 'Trending',
          source: 'Jikan (MyAnimeList)',
          malLink: anime.url || 'https://myanimelist.net/',
          authorId: 'jikan',
          viewCount: anime.scored_by ? Math.floor(anime.scored_by / 30) : 3000,
          likeCount: Math.floor((anime.score || 7) * 1000),
          isBreakingNews: index === 0,
          metadata: {
            type: 'TRENDING',
            score: anime.score,
            rank: anime.rank,
            popularity: anime.popularity,
            studio: anime.studios?.[0]?.name || 'Unknown'
          }
        });
      });

      // Ordina per data (più recenti prima)
      newsItems.sort((a, b) => new Date(b.releaseDate) - new Date(a.releaseDate));

      if (newsItems.length > 0) {
        newsCache = newsItems.slice(0, 30);
        cacheTime = now;
        console.log(`✅ Cached ${newsCache.length} REAL news (airing + trending)`);
        return newsCache;
      } else {
        console.log('⚠️ No news found, using fallback');
        return getFallbackNews();
      }
    } catch (apiError) {
      console.error('❌ API Error:', apiError.message);
      return newsCache.length > 0 ? newsCache : getFallbackNews();
    }
  } catch (error) {
    console.error('❌ Error in news fetching:', error.message);
    console.log('🔄 Using fallback news');
    return newsCache.length > 0 ? newsCache : getFallbackNews();
  }
};

// Fallback news quando ANN non è disponibile
const getFallbackNews = () => {
  return [
    {
      id: '1',
      title: 'New Anime Announcement 2026',
      description: 'Exciting new anime series announced for Spring 2026',
      imageUrl: 'https://via.placeholder.com/400x300?text=New+Anime',
      releaseDate: new Date(),
      category: 'Anime',
      source: 'OtakuVerse',
      authorId: 'admin',
      viewCount: 5000,
      likeCount: 250,
      isBreakingNews: true
    },
    {
      id: '2',
      title: 'Manga Milestone',
      description: 'Popular manga series reaches historic chapter count',
      imageUrl: 'https://via.placeholder.com/400x300?text=Manga+News',
      releaseDate: new Date(Date.now() - 86400000),
      category: 'Manga',
      source: 'OtakuVerse',
      authorId: 'admin',
      viewCount: 3000,
      likeCount: 150,
      isBreakingNews: false
    }
  ];
};

// ============== NEWS ENDPOINTS ==============

// Get all news with pagination
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const category = req.query.category;
    const sort = req.query.sort || 'latest';

    let filtered = await fetchNewsFromJikan();
    
    if (category) {
      filtered = filtered.filter(news => news.category === category);
    }

    // Sort
    if (sort === 'trending') {
      filtered.sort((a, b) => b.viewCount - a.viewCount);
    } else if (sort === 'popular') {
      filtered.sort((a, b) => b.likeCount - a.likeCount);
    } else {
      filtered.sort((a, b) => new Date(b.releaseDate) - new Date(a.releaseDate));
    }

    // Pagination
    const skip = (page - 1) * limit;
    const paginatedNews = filtered.slice(skip, skip + limit);
    const total = filtered.length;

    res.status(200).json({
      data: paginatedNews,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    logger.error('Get news error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get breaking news
router.get('/breaking', async (req, res) => {
  try {
    const allNews = await fetchNewsFromJikan();
    const breakingNews = allNews.filter(news => news.isBreakingNews);
    res.status(200).json({ data: breakingNews });
  } catch (error) {
    logger.error('Get breaking news error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Search news
router.get('/search/:query', async (req, res) => {
  try {
    const { query } = req.params;
    const lowerQuery = query.toLowerCase();
    
    const allNews = await fetchNewsFromJikan();
    const results = allNews.filter(news => 
      news.title.toLowerCase().includes(lowerQuery) ||
      news.description.toLowerCase().includes(lowerQuery)
    );

    res.status(200).json({ data: results });
  } catch (error) {
    logger.error('Search news error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
