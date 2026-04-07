import express from 'express';
import axios from 'axios';
import logger from '../utils/logger.js';

const router = express.Router();

// Cache per le notizie (30 minuti)
let newsCache = [];
let cacheTime = 0;

// Fetcha notizie vere da Jikan API (MyAnimeList)
const fetchNewsFromJikan = async () => {
  try {
    const now = Date.now();
    // Se il cache è fresco (meno di 30 minuti), restituiscilo
    if (newsCache.length > 0 && now - cacheTime < 30 * 60 * 1000) {
      console.log('📦 Using cached news');
      return newsCache;
    }

    console.log('📰 Fetching news from Jikan API (MyAnimeList)...');
    
    // Richiedi forum posts (news/discussions)
    const response = await axios.get('https://api.jikan.moe/v4/top/anime', {
      params: {
        filter: 'airing',
        limit: 25
      },
      headers: {
        'User-Agent': 'OtakuVerse/1.0 (News Aggregator)'
      },
      timeout: 15000
    });

    console.log('✅ Jikan API response received, processing...');

    const animes = response.data?.data || [];
    console.log(`📊 Fetched ${animes.length} top airing anime from Jikan`);

    // Trasforma i dati di Jikan nel formato dell'app
    const jikanNews = animes.slice(0, 20).map((anime, index) => {
      const synopsis = anime.synopsis || 'Popular anime now airing';
      const aired = anime.aired?.from ? new Date(anime.aired.from).toISOString() : new Date().toISOString();
      
      return {
        id: `jikan-${anime.mal_id}-${index}`,
        title: `${anime.title} - #${index + 1} Airing`,
        description: synopsis.substring(0, 200),
        imageUrl: anime.images?.webp?.image_url || 'https://via.placeholder.com/400x300?text=Anime+News',
        releaseDate: aired,
        category: anime.type || 'Anime',
        source: 'Jikan (MyAnimeList)',
        malLink: anime.url || 'https://myanimelist.net/',
        authorId: 'jikan-api',
        viewCount: anime.scored_by ? Math.floor(anime.scored_by / 10) : 5000,
        likeCount: Math.floor(anime.score * 100 || 2500),
        isBreakingNews: index === 0 && anime.status === 'Currently Airing',
        metadata: {
          score: anime.score,
          rank: anime.rank,
          popularity: anime.popularity
        }
      };
    });

    if (jikanNews.length > 0) {
      newsCache = jikanNews;
      cacheTime = now;
      console.log(`✅ Cached ${jikanNews.length} news from Jikan`);
      return newsCache;
    } else {
      console.log('⚠️ Jikan returned no data, using fallback');
      return getFallbackNews();
    }
  } catch (error) {
    console.error('❌ Error fetching Jikan news:', error.message);
    console.error('📋 Error details:', error.response?.status, error.code);
    console.log('🔄 Falling back to cached/mock data');
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
