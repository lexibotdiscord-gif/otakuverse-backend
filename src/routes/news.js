import express from 'express';
import axios from 'axios';
import logger from '../utils/logger.js';

const router = express.Router();

const JIKAN_API = 'https://api.jikan.moe/v4';

// Cache per le notizie (10 minuti)
let newsCache = [];
let cacheTime = 0;

// Genera notizie da anime reali di Jikan API
const generateNewsFromAnime = async () => {
  try {
    const now = Date.now();
    // Se il cache è fresco (meno di 10 minuti), restituiscilo
    if (newsCache.length > 0 && now - cacheTime < 10 * 60 * 1000) {
      return newsCache;
    }

    const response = await axios.get(`${JIKAN_API}/top/anime`, {
      params: { limit: 25, page: 1 }
    });

    const animeList = response.data.data || [];
    
    const generatedNews = animeList.slice(0, 10).map((anime, index) => ({
      id: index + 1,
      title: `${anime.title} - Top Anime Rating: ${anime.score}`,
      description: anime.synopsis ? anime.synopsis.substring(0, 200) + '...' : 'New anime announcement',
      imageUrl: anime.images?.jpg?.image_url || 'https://via.placeholder.com/400x300?text=Anime',
      releaseDate: anime.aired?.from ? new Date(anime.aired.from) : new Date(),
      category: anime.type === 'TV' ? 'Anime' : anime.type === 'Movie' ? 'Movie' : 'Manga',
      authorId: 'admin',
      viewCount: Math.floor(Math.random() * 10000),
      likeCount: Math.floor(Math.random() * 500),
      isBreakingNews: index === 0
    }));

    newsCache = generatedNews;
    cacheTime = now;

    return newsCache;
  } catch (error) {
    logger.error('Error fetching anime data:', error.message);
    return newsCache;
  }
};

// ============== NEWS ENDPOINTS ==============

// Get all news with pagination
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const category = req.query.category;
    const sort = req.query.sort || 'latest';

    let filtered = await generateNewsFromAnime();
    
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
    const allNews = await generateNewsFromAnime();
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
    
    const allNews = await generateNewsFromAnime();
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
