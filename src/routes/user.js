import express from 'express';
import User from '../models/User.js';
import logger from '../utils/logger.js';

const router = express.Router();

// ============== USER ENDPOINTS ==============

// Get user profile
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId).select('-password');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.status(200).json({ data: user });
  } catch (error) {
    logger.error('Get user profile error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update user profile
router.put('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { username, bio, avatar, theme } = req.body;

    const user = await User.findByIdAndUpdate(
      userId,
      {
        username,
        bio,
        avatar,
        theme,
        updatedAt: new Date()
      },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    logger.info(`User profile updated: ${userId}`);
    res.status(200).json({ data: user });
  } catch (error) {
    logger.error('Update user profile error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add favorite anime
router.post('/:userId/favorites/anime/:animeId', async (req, res) => {
  try {
    const { userId, animeId } = req.params;

    const user = await User.findByIdAndUpdate(
      userId,
      { $addToSet: { favoriteAnimeIds: Number(animeId) } },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.status(200).json({ data: user });
  } catch (error) {
    logger.error('Add favorite anime error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get watchlist
router.get('/:userId/watchlist', async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId).select('watchlist');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.status(200).json({ data: user.watchlist });
  } catch (error) {
    logger.error('Get watchlist error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add to watchlist
router.post('/:userId/watchlist', async (req, res) => {
  try {
    const { userId } = req.params;
    const { animeId, status } = req.body;

    const user = await User.findByIdAndUpdate(
      userId,
      {
        $push: {
          watchlist: {
            animeId,
            status: status || 'PLAN_TO_WATCH',
            addedAt: new Date()
          }
        }
      },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.status(201).json({ data: user.watchlist });
  } catch (error) {
    logger.error('Add to watchlist error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;