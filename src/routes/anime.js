import express from 'express';
import axios from 'axios';
import logger from '../utils/logger.js';

const router = express.Router();

const JIKAN_API = process.env.JIKAN_API_URL || 'https://api.jikan.moe/v4';

// ============== ANIME ENDPOINTS ==============

// Get top anime from Jikan API
router.get('/top', async (req, res) => {
  try {
    const page = req.query.page || 1;
    const filter = req.query.filter || 'tv';

    const response = await axios.get(`${JIKAN_API}/top/anime`, {
      params: {
        filter,
        page,
        limit: 25
      }
    });

    res.status(200).json(response.data);
  } catch (error) {
    logger.error('Get top anime error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Search anime
router.get('/search', async (req, res) => {
  try {
    const { query, page = 1, type, status, year, genre } = req.query;

    if (!query) {
      return res.status(400).json({ error: 'Query parameter is required' });
    }

    const response = await axios.get(`${JIKAN_API}/anime`, {
      params: {
        query,
        page,
        type,
        status,
        year,
        genre,
        limit: 25
      }
    });

    res.status(200).json(response.data);
  } catch (error) {
    logger.error('Search anime error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get anime by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const response = await axios.get(`${JIKAN_API}/anime/${id}`);

    res.status(200).json(response.data);
  } catch (error) {
    logger.error('Get anime by ID error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get upcoming anime
router.get('/upcoming', async (req, res) => {
  try {
    const page = req.query.page || 1;

    const response = await axios.get(`${JIKAN_API}/top/anime`, {
      params: {
        filter: 'upcoming',
        page,
        limit: 25
      }
    });

    res.status(200).json(response.data);
  } catch (error) {
    logger.error('Get upcoming anime error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;