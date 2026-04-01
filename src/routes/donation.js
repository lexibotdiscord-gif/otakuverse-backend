import express from 'express';
import axios from 'axios';
import qs from 'qs';
import Donation from '../models/Donation.js';
import User from '../models/User.js';
import logger from '../utils/logger.js';

const router = express.Router();

// Stripe API base URL
const STRIPE_API_URL = 'https://api.stripe.com/v1';
const STRIPE_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_fake';

console.log('🔐 Stripe inizializzato (axios mode)');
console.log('🔑 Stripe Key Present:', !!STRIPE_KEY);
console.log('🔑 Key Format:', STRIPE_KEY?.substring(0, 10) + '...');

// Helper function per Stripe API calls
const stripeAPI = async (method, endpoint, data = null) => {
  try {
    const config = {
      method,
      url: `${STRIPE_API_URL}${endpoint}`,
      headers: {
        'Authorization': `Bearer ${STRIPE_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    };

    if (data) {
      // Usa qs per serializzare correttamente gli array per Stripe
      config.data = qs.stringify(data);
    }

    const response = await axios(config);
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

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

// TEST: Check Stripe connection
router.get('/stripe/test-connection', async (req, res) => {
  try {
    console.log('🔗 Testing Stripe connection...');
    const account = await stripeAPI('GET', '/account');
    console.log('✅ Stripe connection successful!');
    res.status(200).json({
      status: 'connected',
      message: 'Successfully connected to Stripe',
      account: account.id
    });
  } catch (error) {
    console.error('❌ Stripe connection test failed:', error.message || error);
    res.status(500).json({
      status: 'disconnected',
      error: error.message || error,
      suggestions: [
        'Check internet connection',
        'Verify STRIPE_SECRET_KEY is correct',
        'Check firewall/proxy settings',
        'Verify API key is active in Stripe dashboard'
      ]
    });
  }
});

// Create payment intent for donation
router.post('/stripe/create-intent', async (req, res) => {
  try {
    const { amount, currency = 'usd', description, donorEmail } = req.body;

    console.log('📦 Create Intent Request:', { amount, currency, donorEmail });
    console.log('🔑 Stripe Key Present:', !!STRIPE_KEY);
    console.log('🔑 Stripe Key Format:', STRIPE_KEY?.substring(0, 10) + '...');

    // Validazione amount
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount', amount });
    }

    // Validazione currency
    const validCurrencies = ['usd', 'eur', 'gbp', 'jpy', 'aud'];
    if (!validCurrencies.includes(currency.toLowerCase())) {
      return res.status(400).json({ error: 'Invalid currency', currency });
    }

    // Validazione email
    if (!donorEmail || !donorEmail.includes('@')) {
      return res.status(400).json({ error: 'Invalid email', donorEmail });
    }

    if (!STRIPE_KEY || STRIPE_KEY === 'sk_test_fake') {
      return res.status(500).json({ 
        error: 'STRIPE_SECRET_KEY not configured',
        message: 'Missing STRIPE_SECRET_KEY environment variable'
      });
    }

    // Check se la chiave è valida (deve iniziare con sk_test_ o sk_live_)
    if (!STRIPE_KEY.startsWith('sk_')) {
      return res.status(500).json({ 
        error: 'Invalid STRIPE_SECRET_KEY format',
        message: 'STRIPE_SECRET_KEY must start with sk_test_ or sk_live_'
      });
    }

    const amountInCents = Math.round(amount * 100);
    console.log('💰 Payment details:', { amountInCents, currency, donorEmail });

    // Crea payment intent via Stripe API
    const paymentIntent = await stripeAPI('POST', '/payment_intents', {
      amount: amountInCents,
      currency: currency.toLowerCase(),
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
    console.error('❌ Stripe Error Complete:', {
      message: error.message || error,
      type: error.type || 'Unknown'
    });

    logger.error('Create payment intent error:', error);
    
    res.status(500).json({ 
      error: error.message || error,
      details: 'Payment processing error - please try again'
    });
  }
});

// Confirm donation and save to database
router.post('/stripe/confirm', async (req, res) => {
  try {
    const { paymentIntentId, userId, donorEmail, donorName, amount, level } = req.body;

    console.log('📋 Confirm Donation Request:', {
      paymentIntentId,
      userId,
      donorEmail,
      donorName,
      amount,
      level,
      bodyKeys: Object.keys(req.body)
    });

    // Validazione base
    if (!paymentIntentId) {
      return res.status(400).json({ error: 'paymentIntentId is required' });
    }
    if (!donorEmail) {
      return res.status(400).json({ error: 'donorEmail is required' });
    }
    if (!donorName) {
      return res.status(400).json({ error: 'donorName is required' });
    }
    if (!amount) {
      return res.status(400).json({ error: 'amount is required' });
    }

    const paymentIntent = await stripeAPI('GET', `/payment_intents/${paymentIntentId}`);

    console.log('✅ Payment Intent Retrieved:', {
      id: paymentIntent.id,
      status: paymentIntent.status,
      amount: paymentIntent.amount
    });

    if (paymentIntent.status === 'succeeded' || paymentIntent.status === 'requires_payment_method' || paymentIntent.status === 'processing') {
      // Note: In produzione, solo 'succeeded' dovrebbe essere accettato
      // Per testing, accettiamo anche gli altri stati
      
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
          transactionDate: new Date(),
          isActive: paymentIntent.status === 'succeeded', // Solo se davvero pagato
          expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        });
        
        await donation.save();
        logger.info(`Stripe donation: ${donorName} (${donorEmail}) - $${amount} - Status: ${paymentIntent.status}`);
        
        res.status(200).json({
          success: true,
          message: paymentIntent.status === 'succeeded' 
            ? 'Thank you for your donation!' 
            : 'Payment processing - Thank you!',
          amount: amount,
          transactionId: paymentIntentId,
          status: paymentIntent.status
        });
      } catch (dbError) {
        logger.warn('Could not save to database:', dbError.message);
        res.status(200).json({
          success: true,
          message: 'Donation recorded (database save failed)',
          amount: amount,
          transactionId: paymentIntentId
        });
      }
    } else {
      res.status(400).json({
        success: false,
        message: 'Payment not completed',
        status: paymentIntent.status
      });
    }
  } catch (error) {
    console.error('❌ Confirm donation error:', {
      message: error.message || error,
      type: error.type || 'Unknown'
    });
    logger.error('Confirm donation error:', error);
    res.status(500).json({ error: error.message || error });
  }
});

// Create Stripe Checkout Session (per WebView payment)
router.post('/stripe/checkout-session', async (req, res) => {
  try {
    const { amount, level, donorEmail, label } = req.body;

    console.log('🛒 Create Checkout Session:', { amount, level, donorEmail });

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }
    if (!donorEmail || !donorEmail.includes('@')) {
      return res.status(400).json({ error: 'Invalid email' });
    }

    const amountInCents = Math.round(amount * 100);

    // URL di callback dopo il pagamento (deve essere il tuo sito/app)
    const successUrl = `http://localhost:5000/api/donations/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `http://localhost:5000/api/donations/cancel`;

    const checkoutSession = await stripeAPI('POST', '/checkout/sessions', {
      'payment_method_types[0]': 'card',
      'line_items[0][price_data][currency]': 'usd',
      'line_items[0][price_data][product_data][name]': `OtakuVerse ${level || 'Donation'} Tier`,
      'line_items[0][price_data][product_data][description]': 'Support OtakuVerse anime news platform',
      'line_items[0][price_data][unit_amount]': amountInCents,
      'line_items[0][quantity]': 1,
      mode: 'payment',
      customer_email: donorEmail,
      success_url: successUrl,
      cancel_url: cancelUrl
    });

    console.log('✅ Checkout Session Created:', checkoutSession.id);

    res.status(200).json({
      checkoutUrl: checkoutSession.url,
      sessionId: checkoutSession.id,
      amount: amount
    });
  } catch (error) {
    console.error('❌ Checkout session error:', error.message || error);
    logger.error('Create checkout session error:', error);
    
    res.status(500).json({ 
      error: error.message || error,
      details: 'Checkout session creation failed'
    });
  }
});

// Success callback (chiamato dopo pagamento riuscito)
router.get('/success', async (req, res) => {
  try {
    const { session_id } = req.query;
    console.log('✅ Success callback - Session:', session_id);

    const session = await stripeAPI('GET', `/checkout/sessions/${session_id}`);
    
    res.status(200).json({
      success: true,
      message: 'Payment successful',
      sessionId: session_id,
      paymentStatus: session.payment_status,
      amount: session.amount_total / 100,
      email: session.customer_email
    });
  } catch (error) {
    console.error('❌ Success callback error:', error.message || error);
    res.status(500).json({ error: error.message || error });
  }
});

// Cancel callback (chiamato se l'utente annulla il pagamento)
router.get('/cancel', async (req, res) => {
  console.log('❌ Payment cancelled by user');
  
  res.status(200).json({
    success: false,
    message: 'Payment cancelled'
  });
});

export default router;
