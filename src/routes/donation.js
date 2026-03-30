import express from 'express';
import Donation from '../models/Donation.js';
import User from '../models/User.js';
import logger from '../utils/logger.js';
import Stripe from 'stripe';

const router = express.Router();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_fake');

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

// ============== STRIPE PAYMENT ENDPOINTS ==============

// Create payment intent for donation
router.post('/stripe/create-intent', async (req, res) => {
  try {
    const { amount, currency = 'usd', description, donorEmail } = req.body;

    console.log('📦 Create Intent Request:', { amount, currency, donorEmail });
    console.log('🔑 Stripe Key Present:', !!process.env.STRIPE_SECRET_KEY);

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(500).json({ 
        error: 'STRIPE_SECRET_KEY not configured',
        message: 'Missing STRIPE_SECRET_KEY environment variable'
      });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Stripe usa centesimi
      currency,
      description: description || 'OtakuVerse Donation',
      receipt_email: donorEmail
    });

    console.log('✅ Payment Intent Created:', paymentIntent.id);

    res.status(200).json({
      clientSecret: paymentIntent.client_secret,
      id: paymentIntent.id,
      amount: paymentIntent.amount / 100
    });
  } catch (error) {
    console.error('❌ Stripe Error:', error.message);
    logger.error('Create payment intent error:', error);
    res.status(500).json({ 
      error: error.message,
      type: error.type,
      code: error.code
    });
  }
});

// Confirm donation and save to database
router.post('/stripe/confirm', async (req, res) => {
  try {
    const { paymentIntentId, userId, donorEmail, donorName, amount, level } = req.body;

    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status === 'succeeded') {
      // Salva nel database se usiamo MongoDB
      try {
        const donation = new Donation({
          userId: userId || 'guest',
          amount: amount,
          level: level || 'DONOR',
          paymentMethod: 'stripe',
          stripePaymentId: paymentIntentId,
          donorEmail: donorEmail,
          donorName: donorName,
          expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        });
        
        await donation.save();
        logger.info(`Stripe donation: ${donorName} (${donorEmail}) - $${amount}`);
      } catch (dbError) {
        logger.warn('Could not save to database:', dbError.message);
        // Continua comunque se il database non funziona
      }

      res.status(200).json({
        success: true,
        message: 'Thank you for your donation!',
        amount: amount,
        transactionId: paymentIntentId
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Payment not completed',
        status: paymentIntent.status
      });
    }
  } catch (error) {
    logger.error('Confirm donation error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;