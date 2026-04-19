// server.js — Backend BennaGO (Render.com)
const express = require("express");
const admin   = require("firebase-admin");
const app     = express();
app.use(express.json());

// ── Firebase ──────────────────────────────────────────────────────────────────
try {
    admin.initializeApp({
        credential: admin.credential.cert(
            JSON.parse(process.env.FIREBASE_SERVICE_KEY))
    });
    console.log("✅ Firebase Admin initialisé");
} catch (e) { console.error("❌ Firebase:", e.message); process.exit(1); }

const messaging = admin.messaging();

// ── Stripe ────────────────────────────────────────────────────────────────────
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

app.get("/",     (req, res) => res.json({ status: "BennaGO Server ✅" }));
app.get("/ping", (req, res) => res.json({ pong: true }));

// ── PaymentIntent Stripe ──────────────────────────────────────────────────────
app.post("/stripe/create-payment-intent", async (req, res) => {
    const { amount } = req.body; // en millimes
    console.log("💳 PaymentIntent — amount:", amount);
    if (!amount || amount <= 0)
        return res.status(400).json({ error: "Montant invalide" });
    try {
        const pi = await stripe.paymentIntents.create({
            amount:   Math.round(amount),
            currency: "tnd",
            automatic_payment_methods: { enabled: true },
        });
        console.log("✅ PaymentIntent:", pi.id);
        res.json({ clientSecret: pi.client_secret });
    } catch (e) {
        console.error("❌ Stripe:", e.message);
        res.status(500).json({ error: e.message });
    }
});

// ── Notif admin ───────────────────────────────────────────────────────────────
app.post("/notify/admin", async (req, res) => {
    const { orderId, clientName, total } = req.body;
    if (!orderId || !clientName || total === undefined)
        return res.status(400).json({ error: "Champs manquants" });
    try {
        const id = await messaging.send({
            topic: "admin",
            notification: { title: "🍽️ Nouvelle commande !",
                body: `${clientName} — ${parseFloat(total).toFixed(3)} TND` },
            data: { type: "new_order", orderId: String(orderId),
                title: "🍽️ Nouvelle commande !",
                body: `${clientName} — ${parseFloat(total).toFixed(3)} TND` },
            android: { priority: "high",
                notification: { channelId: "channel_orders" } },
        });
        res.json({ success: true, messageId: id });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Notif client ──────────────────────────────────────────────────────────────
app.post("/notify/client", async (req, res) => {
    const { clientToken, orderId, newStatus } = req.body;
    if (!clientToken || !orderId || !newStatus)
        return res.status(400).json({ error: "Champs manquants" });
    const icons = {"Confirmée":"✅","En livraison":"🚚","Livrée":"🎉","Annulée":"❌"};
    const icon  = icons[newStatus] || "⏳";
    try {
        const id = await messaging.send({
            token: clientToken,
            notification: { title: `${icon} Commande #${orderId}`,
                body: `Votre commande est maintenant : ${newStatus}` },
            data: { type: "status_changed", orderId: String(orderId),
                newStatus, title: `${icon} Commande #${orderId}`,
                body: `Votre commande est maintenant : ${newStatus}` },
            android: { priority: "high",
                notification: { channelId: "channel_status" } },
        });
        res.json({ success: true, messageId: id });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Serveur sur port ${PORT}`));
