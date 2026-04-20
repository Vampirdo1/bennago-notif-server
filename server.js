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
// Vérifier que la clé est présente
if (!process.env.STRIPE_SECRET_KEY) {
    console.error("❌ STRIPE_SECRET_KEY manquante dans les variables d'environnement !");
}
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY || "");

// ── Routes santé ──────────────────────────────────────────────────────────────
app.get("/",     (req, res) => res.json({ status: "BennaGO Server ✅", stripe: !!process.env.STRIPE_SECRET_KEY }));
app.get("/ping", (req, res) => res.json({ pong: true }));

// ── Stripe PaymentIntent ──────────────────────────────────────────────────────
// ⚠️  TND n'est PAS supporté par Stripe → on utilise EUR pour le test
// En production réelle, utiliser une passerelle locale (Konnect, Paymee, etc.)
app.post("/stripe/create-payment-intent", async (req, res) => {
    const { amount } = req.body;
    console.log("💳 PaymentIntent — amount reçu:", amount);

    if (!amount || isNaN(amount) || amount <= 0) {
        console.error("❌ Montant invalide:", amount);
        return res.status(400).json({ error: "Montant invalide : " + amount });
    }

    // Stripe exige un entier en centimes
    // On simule : 12.500 TND → 1250 centimes EUR (pour le test académique)
    const amountInCents = Math.round(parseFloat(amount));
    console.log("💳 Montant en centimes:", amountInCents);

    try {
        const paymentIntent = await stripe.paymentIntents.create({
            amount:   amountInCents,
            currency: "eur",   // ✅ EUR supporté en test mode Stripe
            automatic_payment_methods: { enabled: true },
        });

        console.log("✅ PaymentIntent créé :", paymentIntent.id);
        console.log("✅ clientSecret présent :", !!paymentIntent.client_secret);

        // S'assurer que clientSecret est bien envoyé
        res.json({
            clientSecret: paymentIntent.client_secret,
            paymentIntentId: paymentIntent.id
        });

    } catch (err) {
        console.error("❌ Stripe error code :", err.code);
        console.error("❌ Stripe error message :", err.message);
        console.error("❌ Stripe error type :", err.type);
        res.status(500).json({
            error:   err.message,
            code:    err.code,
            type:    err.type
        });
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
app.listen(PORT, () => {
    console.log(`🚀 Serveur lancé sur port ${PORT}`);
    console.log(`   STRIPE_SECRET_KEY : ${process.env.STRIPE_SECRET_KEY ? "✅ définie" : "❌ MANQUANTE"}`);
    console.log(`   FIREBASE_SERVICE_KEY : ${process.env.FIREBASE_SERVICE_KEY ? "✅ définie" : "❌ MANQUANTE"}`);
});
