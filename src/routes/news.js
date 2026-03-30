import express from 'express';
import News from '../models/News.js';
import logger from '../utils/logger.js';

const router = express.Router();

// ============== NEWS ENDPOINTS ==============

// Get all news with pagination
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const category = req.query.category;
    const sort = req.query.sort || 'latest';

    let query = {};
    if (category) query.category = category;

    let sortOption = { publishedAt: -1 };
    if (sort === 'trending') sortOption = { viewCount: -1 };
    if (sort === 'popular') sortOption = { likeCount: -1 };

    const skip = (page - 1) * limit;
    const news = await News.find(query)
      .sort(sortOption)
      .skip(skip)
      .limit(limit)
      .populate('authorId', 'username avatar');

    const total = await News.countDocuments(query);

    res.status(200).json({
      data: news,
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
    const news = await News.find({ isBreakingNews: true })
      .sort({ publishedAt: -1 })
      .limit(10)
      .populate('authorId', 'username avatar');

    res.status(200).json({ data: news });
  } catch (error) {
    logger.error('Get breaking news error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Search news
router.get('/search/:query', async (req, res) => {
  try {
    const { query } = req.params;
    const news = await News.find(
      { $text: { $search: query } },
      { score: { $meta: 'textScore' } }
    )
      .sort({ score: { $meta: 'textScore' } })
      .limit(20);

    res.status(200).json({ data: news });
  } catch (error) {
    logger.error('Search news error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get news by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const news = await News.findByIdAndUpdate(
      id,
      { $inc: { viewCount: 1 } },
      { new: true }
    ).populate('authorId', 'username avatar');

    if (!news) {
      return res.status(404).json({ error: 'News not found' });
    }

    res.status(200).json({ data: news });
  } catch (error) {
    logger.error('Get news by ID error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;