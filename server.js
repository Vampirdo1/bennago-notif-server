// server.js — Backend BennaGO pour notifications FCM v1
const express = require("express");
const admin   = require("firebase-admin");
const app     = express();

app.use(express.json());

// ── Init Firebase Admin ───────────────────────────────────────────────────────
try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_KEY);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    console.log("✅ Firebase Admin initialisé");
} catch (e) {
    console.error("❌ Erreur init Firebase :", e.message);
    process.exit(1);
}

const messaging = admin.messaging();

// ── GET / (santé) ─────────────────────────────────────────────────────────────
app.get("/", (req, res) => {
    res.json({ status: "BennaGO Server ✅", time: new Date().toISOString() });
});

app.get("/ping", (req, res) => res.json({ pong: true }));

// ── POST /notify/admin ────────────────────────────────────────────────────────
app.post("/notify/admin", async (req, res) => {
    console.log("📥 /notify/admin :", JSON.stringify(req.body));
    const { orderId, clientName, total } = req.body;

    if (!orderId || !clientName || total === undefined)
        return res.status(400).json({ error: "Champs manquants" });

    try {
        const msgId = await messaging.send({
            topic: "admin",
            notification: {
                title: "🍽️ Nouvelle commande !",
                body:  `${clientName} — ${parseFloat(total).toFixed(3)} TND`,
            },
            data: {
                type: "new_order", orderId: String(orderId),
                title: "🍽️ Nouvelle commande !",
                body:  `${clientName} — ${parseFloat(total).toFixed(3)} TND`,
            },
            android: {
                priority: "high",
                notification: { sound: "default", channelId: "channel_orders" },
            },
        });
        console.log("✅ Admin notifié :", msgId);
        res.json({ success: true, messageId: msgId });
    } catch (err) {
        console.error("❌ Erreur FCM admin :", err.code, err.message);
        res.status(500).json({ error: err.message, code: err.code });
    }
});

// ── POST /notify/client ───────────────────────────────────────────────────────
app.post("/notify/client", async (req, res) => {
    console.log("📥 /notify/client :", JSON.stringify(req.body));
    const { clientToken, orderId, newStatus } = req.body;

    if (!clientToken || !orderId || !newStatus)
        return res.status(400).json({ error: "Champs manquants" });

    const icons = { "Confirmée":"✅","En livraison":"🚚","Livrée":"🎉","Annulée":"❌" };
    const icon  = icons[newStatus] || "⏳";

    try {
        const msgId = await messaging.send({
            token: clientToken,
            notification: {
                title: `${icon} Commande #${orderId}`,
                body:  `Votre commande est maintenant : ${newStatus}`,
            },
            data: {
                type: "status_changed", orderId: String(orderId), newStatus,
                title: `${icon} Commande #${orderId}`,
                body:  `Votre commande est maintenant : ${newStatus}`,
            },
            android: {
                priority: "high",
                notification: { sound: "default", channelId: "channel_status" },
            },
        });
        console.log(`✅ Client notifié — commande #${orderId} → ${newStatus} :`, msgId);
        res.json({ success: true, messageId: msgId });
    } catch (err) {
        console.error("❌ Erreur FCM client :", err.code, err.message);
        res.status(500).json({ error: err.message, code: err.code });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Serveur lancé sur port ${PORT}`));