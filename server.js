/**
 * AeroByte Secure Payment Backend (Node.js + Express + Stripe)
 * 
 * Instructions:
 * 1. Install dependencies: npm install express stripe firebase-admin
 * 2. Add your Stripe Secret Key & Webhook Secret from dashboard.stripe.com
 * 3. Deploy to a VPS or Firebase Functions.
 */

const express = require('express');
const cors = require('cors');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const admin = require('firebase-admin');
const app = express();

app.use(cors());

// Health check endpoint
app.get('/', (req, res) => res.json({ status: 'AeroByte Backend is Alive!', time: new Date().toISOString() }));

// Initialize Firebase Admin (Requires FIREBASE_SERVICE_ACCOUNT env var or serviceAccountKey.json)
let serviceAccount;
try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  } else {
    serviceAccount = require('./serviceAccountKey.json');
  }
} catch (e) {
  console.error("Firebase Admin Error: Missing serviceAccountKey.json or FIREBASE_SERVICE_ACCOUNT env var.");
}

if (serviceAccount) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

// TIER CONFIGURATION
const TIER_PRICES = {
    '48h': 500,      // $5.00
    '7d': 1000,      // $10.00
    '30d': 1500,     // $15.00
    '90d': 4000,     // $40.00
    '365d': 12000,   // $120.00
    'LIFETIME': 25000 // $250.00
};

// CREATE PAYMENT INTENT (For In-Modal Stripe Elements)
app.post('/create-payment-intent', express.json(), async (req, res) => {
    const { userId, tier } = req.body;
    if (!userId) return res.status(400).json({ error: 'Missing userId' });
    
    const selectedTier = tier || '30d'; // Fallback
    const amount = TIER_PRICES[selectedTier] || 1500;

    try {
        const paymentIntent = await stripe.paymentIntents.create({
            amount: amount,
            currency: 'usd',
            automatic_payment_methods: { enabled: true },
            metadata: { 
                userId: userId,
                tier: selectedTier
            },
        });

        res.json({ clientSecret: paymentIntent.client_secret });
    } catch (err) {
        console.error("Stripe Error:", err);
        res.status(500).json({ error: err.message });
    }
});

const db = admin.firestore();

// STRIPE WEBHOOK HANDLER
app.post('/webhook', express.raw({type: 'application/json'}), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_YOUR_WEBHOOK_ENDPOINT_SECRET';

    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err) {
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'payment_intent.succeeded' || event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const metadata = session.metadata || {};
        const userId = metadata.userId || session.client_reference_id;
        const tier = metadata.tier || '30d';
        const customerEmail = session.receipt_email || (session.customer_details ? session.customer_details.email : 'Customer');

        console.log(`💰 Fulfilling order for User: ${userId} (${customerEmail}) - Tier: ${tier}`);

        // --- PRODUCTION FULFILLMENT LOGIC ---
        let durationMs = 30 * 24 * 60 * 60 * 1000; // Default 30d
        if (tier === '48h') durationMs = 2 * 24 * 60 * 60 * 1000;
        if (tier === '7d') durationMs = 7 * 24 * 60 * 60 * 1000;
        if (tier === '90d') durationMs = 90 * 24 * 60 * 60 * 1000;
        if (tier === '365d') durationMs = 365 * 24 * 60 * 60 * 1000;
        if (tier === 'LIFETIME') durationMs = 36500 * 24 * 60 * 60 * 1000; // ~100 years

        const expiresAt = Date.now() + durationMs;

        // 2. Generate Real License Key
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        const rand = (len) => Array.from({length: len}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
        const newKey = `${rand(4)}-${rand(4)}-${rand(4)}-${rand(4)}`;

        try {
            // Update User Profile
            await db.collection('users').doc(userId).update({
                plan: 'Premium',
                expiresAt: expiresAt,
                licenseKey: newKey,
                premiumTier: tier // Store tier for reference
            });

            // Register Global License
            await db.collection('licenses').doc(newKey).set({
                userId: userId,
                plan: 'Premium',
                status: 'active',
                tier: tier,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });

            console.log(`✅ Successfully upgraded ${customerEmail} to ${tier} Professional!`);
        } catch (dbErr) {
            console.error("❌ FULFILLMENT FAILED IN DATABASE:", dbErr);
        }
    }

    res.json({received: true});
});

const PORT = process.env.PORT || 4242;
app.listen(PORT, () => console.log(`🚀 AeroByte Payment Server running on port ${PORT}`));
