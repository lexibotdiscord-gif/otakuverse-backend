import express from 'express';
import authRoutes from './auth.js';
import newsRoutes from './news.js';
import animeRoutes from './anime.js';
import userRoutes from './user.js';
import donationRoutes from './donation.js';
import communityRoutes from './community.js';

const setupRoutes = (app) => {
  const router = express.Router();

  // Auth routes
  router.use('/auth', authRoutes);

  // News routes
  router.use('/news', newsRoutes);

  // Anime routes
  router.use('/anime', animeRoutes);

  // User routes
  router.use('/user', userRoutes);

  // Donation routes
  router.use('/donations', donationRoutes);

  // Community routes
  router.use('/community', communityRoutes);

  // Mount all routes under /api
  app.use('/api', router);
};

export default setupRoutes;