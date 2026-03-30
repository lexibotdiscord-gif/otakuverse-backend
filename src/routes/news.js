import express from 'express';
import logger from '../utils/logger.js';

const router = express.Router();

// Mock news data
const mockNews = [
  {
    id: 1,
    title: "Demon Slayer Season 4 Announced",
    description: "Official announcement of the fourth season coming in 2025. Director Haruo Sotozaki returns.",
    imageUrl: "https://via.placeholder.com/400x300?text=Demon+Slayer+S4",
    releaseDate: new Date("2025-01-15"),
    category: "Anime",
    authorId: "admin",
    viewCount: 5420,
    likeCount: 320,
    isBreakingNews: true
  },
  {
    id: 2,
    title: "Jujutsu Kaisen Movie Box Office Record",
    description: "The latest Jujutsu Kaisen movie breaks box office records worldwide with gross exceeding $100 million.",
    imageUrl: "https://via.placeholder.com/400x300?text=Jujutsu+Kaisen+Movie",
    releaseDate: new Date("2025-01-10"),
    category: "News",
    authorId: "admin",
    viewCount: 3210,
    likeCount: 245
  },
  {
    id: 3,
    title: "Attack on Titan Final Arc Visual Released",
    description: "New visual and trailer for the final arc of Attack on Titan released. Studio MAPPA confirmed.",
    imageUrl: "https://via.placeholder.com/400x300?text=Attack+on+Titan",
    releaseDate: new Date("2025-01-08"),
    category: "Anime",
    authorId: "admin",
    viewCount: 8900,
    likeCount: 512
  },
  {
    id: 4,
    title: "Chainsaw Man Manga New Chapter",
    description: "Latest Chainsaw Man chapter released with major plot revelations. Fans speculate on anime adaptation.",
    imageUrl: "https://via.placeholder.com/400x300?text=Chainsaw+Man",
    releaseDate: new Date("2025-01-05"),
    category: "Manga",
    authorId: "admin",
    viewCount: 6750,
    likeCount: 445
  },
  {
    id: 5,
    title: "Spy x Family Final Arc Announced",
    description: "Studio CloverWorks announces final arc adaptation for Spy x Family anime series.",
    imageUrl: "https://via.placeholder.com/400x300?text=Spy+x+Family",
    releaseDate: new Date("2025-01-03"),
    category: "Anime",
    authorId: "admin",
    viewCount: 4320,
    likeCount: 298
  }
];

// ============== NEWS ENDPOINTS ==============

// Get all news with pagination
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const category = req.query.category;
    const sort = req.query.sort || 'latest';

    let filtered = mockNews;
    
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
    const breakingNews = mockNews.filter(news => news.isBreakingNews);
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
    
    const results = mockNews.filter(news => 
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