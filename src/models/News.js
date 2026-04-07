import express from 'express';
import axios from 'axios';
import xml2js from 'xml2js';
import logger from '../utils/logger.js';

const router = express.Router();

const ANN_API = 'https://www.animenewsnetwork.com/encyclopedia/api.php';

// Cache per le notizie (30 minuti)
let newsCache = [];
let cacheTime = 0;

const xmlParser = new xml2js.Parser({
  explicitArray: false,
  mergeAttrs: true
});

// Fetcha notizie da Anime News Network API
const fetchNewsFromANN = async () => {
  try {
    const now = Date.now();
    // Se il cache è fresco (meno di 30 minuti), restituiscilo
    if (newsCache.length > 0 && now - cacheTime < 30 * 60 * 1000) {
      return newsCache;
    }

    console.log('📰 Fetching news from ANN API...');
    
    // Richiesta all'API di ANN (ritorna XML)
    const response = await axios.get(ANN_API, {
      params: {
        type: 'anime',
        part: 'news',
        limit: 50
      },
      timeout: 10000
    });

    const parsed = await xmlParser.parseStringPromise(response.data);
    const articles = parsed.ann?.anime || [];
    
    // Trasforma i dati di ANN nel formato dell'app
    const annNews = articles.slice(0, 20).map((anime, index) => {
      const newsItems = Array.isArray(anime.news) ? anime.news : anime.news ? [anime.news] : [];
      
      return newsItems.slice(0, 1).map((news, newsIndex) => ({
        id: `${index}-${newsIndex}`,
        title: news.title || anime.name || 'Anime News',
        description: news.d || news.type || 'New anime or manga update',
        imageUrl: 'https://via.placeholder.com/400x300?text=ANN+News',
        releaseDate: new Date(news.date || new Date()),
        category: anime.type === 'Anime' ? 'Anime' : 'Manga',
        source: 'ANN',
        annLink: news.url || `https://www.animenewsnetwork.com/`,
        authorId: 'ann-admin',
        viewCount: Math.floor(Math.random() * 5000),
        likeCount: Math.floor(Math.random() * 300),
        isBreakingNews: index === 0
      }));
    }).flat().filter(item => item);

    // Se ANN ritorna pochi dati, fallback a Jikan
    if (annNews.length < 5) {
      console.log('⚠️ ANN returned few results, using fallback data');
      return getFallbackNews();
    }

    newsCache = annNews;
    cacheTime = now;

    console.log(`✅ Fetched ${annNews.length} news from ANN`);
    return newsCache;
  } catch (error) {
    logger.error('Error fetching ANN news:', error.message);
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

    let filtered = await fetchNewsFromANN();
    
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
    const allNews = await fetchNewsFromANN();
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
    
    const allNews = await fetchNewsFromANN();
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
