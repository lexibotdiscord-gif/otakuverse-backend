import express from 'express';
import Donation from '../models/Donation.js';
import User from '../models/User.js';
import logger from '../utils/logger.js';

const router = express.Router();

// ============== DONATION ENDPOINTS ==============

// Get donation levels info
router.get('/levels', (req, res) => {
  const levels = {
    BRONZE: {
      price: 5,
      features: ['Ad-free experience', 'Bronze badge', 'Supporter status']
    },
    SILVER: {
      price: 15,
      features: ['Everything in Bronze', 'Silver badge', 'Early access to features', 'Custom theme']
    },
    GOLD: {
      price: 30,
      features: ['Everything in Silver', 'Gold badge', 'Priority support', '2 premium themes']
    },
    LEGEND: {
      price: 100,
      features: ['Everything in Gold', 'Legend badge', '24/7 support', 'All premium themes', 'Exclusive content']
    }
  };

  res.status(200).json({ data: levels });
});

// Get user donations
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const donations = await Donation.find({ userId }).sort({ transactionDate: -1 });

    res.status(200).json({ data: donations });
  } catch (error) {
    logger.error('Get user donations error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create donation
router.post('/create', async (req, res) => {
  try {
    const { userId, amount, level, paymentMethod, message } = req.body;

    const donation = new Donation({
      userId,
      amount,
      level,
      paymentMethod,
      message,
      expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
    });

    await donation.save();

    // Update user donor level
    await User.findByIdAndUpdate(
      userId,
      { donorLevel: level }
    );

    logger.info(`Donation created: ${userId} - Level: ${level}`);

    res.status(201).json({
      message: 'Donation successful',
      data: donation
    });
  } catch (error) {
    logger.error('Create donation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get top donors
router.get('/top/donors', async (req, res) => {
  try {
    const topDonors = await Donation.aggregate([
      { $match: { isActive: true } },
      { $group: {
          _id: '$userId',
          totalDonated: { $sum: '$amount' },
          donationCount: { $sum: 1 },
          level: { $max: '$level' }
        }
      },
      { $sort: { totalDonated: -1 } },
      { $limit: 50 },
      { $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      }
    ]);

    res.status(200).json({ data: topDonors });
  } catch (error) {
    logger.error('Get top donors error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;