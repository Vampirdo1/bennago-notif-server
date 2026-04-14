// server.js — Backend BennaGO pour notifications FCM v1

const express = require("express");
const admin   = require("firebase-admin");
const app     = express();

app.use(express.json());

// ── Stockage des tokens clients ─────────────────────────────
let clientTokens = [];

// ── Initialisation Firebase Admin ─────────────────────────────
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_KEY);

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});

const messaging = admin.messaging();

// ── Route santé ───────────────────────────────────────────────
app.get("/", (req, res) => {
    res.json({ status: "BennaGO Notification Server ✅", version: "2.0" });
});

// ── ROUTE 1 : notifier admin ─────────────────────────────────
app.post("/notify/admin", async (req, res) => {
    const { orderId, clientName, total } = req.body;

    if (!orderId || !clientName || total === undefined) {
        return res.status(400).json({ error: "Champs manquants" });
    }

    const message = {
        topic: "admin",
        notification: {
            title: "🍽️ Nouvelle commande !",
            body: `${clientName} — ${parseFloat(total).toFixed(3)} TND`,
        },
        data: {
            type: "new_order",
            orderId: String(orderId),
            title: "🍽️ Nouvelle commande !",
            body: `${clientName} — ${parseFloat(total).toFixed(3)} TND`,
        },
        android: { priority: "high" },
    };

    try {
        const response = await messaging.send(message);
        console.log(`✅ Notif admin envoyée — commande #${orderId}`);
        res.json({ success: true, messageId: response });
    } catch (err) {
        console.error("❌ Erreur admin :", err);
        res.status(500).json({ error: err.message });
    }
});


// ── ROUTE 2 : sauvegarder token client ──────────────────────
app.post("/save-token", (req, res) => {
    const { token } = req.body;

    if (!token) {
        return res.status(400).json({ error: "Token manquant" });
    }

    if (!clientTokens.includes(token)) {
        clientTokens.push(token);
    }

    console.log("📲 Token enregistré:", token);
    console.log("📊 Total tokens:", clientTokens.length);

    res.json({ success: true });
});


// ── ROUTE 3 : notifier client ───────────────────────────────
app.post("/notify/client", async (req, res) => {
    const { clientToken, orderId, newStatus } = req.body;

    if (!orderId || !newStatus) {
        return res.status(400).json({ error: "Champs manquants" });
    }

    const icons = {
        "Confirmée": "✅",
        "En livraison": "🚚",
        "Livrée": "🎉",
        "Annulée": "❌",
    };

    const icon = icons[newStatus] || "⏳";

    // 🎯 si token envoyé directement sinon tous les tokens enregistrés
    let tokensToSend = [];

    if (clientToken) {
        tokensToSend.push(clientToken);
    } else {
        tokensToSend = clientTokens;
    }

    if (tokensToSend.length === 0) {
        return res.status(400).json({ error: "Aucun token client disponible" });
    }

    try {
        const promises = tokensToSend.map(token =>
            messaging.send({
                token: token,
                notification: {
                    title: `${icon} Commande #${orderId}`,
                    body: `Votre commande est maintenant : ${newStatus}`,
                },
                data: {
                    type: "status_changed",
                    orderId: String(orderId),
                    newStatus: newStatus,
                },
                android: { priority: "high" },
            })
        );

        await Promise.all(promises);

        console.log(`✅ Notif client envoyée à ${tokensToSend.length} device(s)`);
        res.json({ success: true, sent: tokensToSend.length });

    } catch (err) {
        console.error("❌ Erreur client :", err);
        res.status(500).json({ error: err.message });
    }
});


// ── Démarrage serveur ────────────────────────────────────────
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`🚀 BennaGO server running on port ${PORT}`);
});