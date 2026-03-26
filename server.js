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
const app = express();

app.use(cors());

// Initialize Firebase Admin (Requires serviceAccountKey.json)
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// CREATE CHECKOUT SESSION
app.post('/create-checkout-session', express.json(), async (req, res) => {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'Missing userId' });

    try {
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{
                price_data: {
                    currency: 'usd',
                    product_data: {
                        name: 'AeroByte Professional',
                        description: '100% hardware utilization and cloud-offloaded training.',
                    },
                    unit_amount: 1500, // $15.00
                },
                quantity: 1,
            }],
            mode: 'payment',
            client_reference_id: userId,
            success_url: `https://aerobyte.shop/profile.html?session_id={CHECKOUT_SESSION_ID}&status=success`,
            cancel_url: `https://aerobyte.shop/index.html?status=cancel`,
        });

        res.json({ id: session.id, url: session.url });
    } catch (err) {
        console.error("Stripe Error:", err);
        res.status(500).json({ error: err.message });
    }
});

const db = admin.firestore();

// STRIPE WEBHOOK HANDLER
app.post('/webhook', express.raw({type: 'application/json'}), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const endpointSecret = 'whsec_YOUR_WEBHOOK_ENDPOINT_SECRET';

    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err) {
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the checkout.session.completed event
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const userId = session.client_reference_id; // Set this in your frontend checkout call
        const customerEmail = session.customer_details.email;

        console.log(`💰 Fulfilling order for User: ${userId} (${customerEmail})`);

        // --- PRODUCTION FULFILLMENT LOGIC ---
        // 1. Calculate Expiry (30 Days)
        const expiresAt = Date.now() + (30 * 24 * 60 * 60 * 1000);

        // 2. Generate Real License Key
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        const rand = (len) => Array.from({length: len}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
        const newKey = `${rand(4)}-${rand(4)}-${rand(4)}-${rand(4)}`;

        try {
            // Update User Profile
            await db.collection('users').doc(userId).update({
                plan: 'Premium',
                expiresAt: expiresAt,
                licenseKey: newKey
            });

            // Register Global License
            await db.collection('licenses').doc(newKey).set({
                userId: userId,
                plan: 'Premium',
                status: 'active',
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });

            console.log(`✅ Successfully upgraded ${customerEmail} to Professional!`);
        } catch (dbErr) {
            console.error("❌ FULFILLMENT FAILED IN DATABASE:", dbErr);
            // In a real app, you might want to send an alert email here
        }
    }

    res.json({received: true});
});

const PORT = process.env.PORT || 4242;
app.listen(PORT, () => console.log(`🚀 AeroByte Payment Server running on port ${PORT}`));
