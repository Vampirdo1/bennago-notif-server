// server.js — Backend BennaGO pour notifications FCM v1
// Déployé gratuitement sur Render.com

const express = require("express");
const admin   = require("firebase-admin");
const app     = express();

app.use(express.json());

// ── Initialisation Firebase Admin ─────────────────────────────────────────────
// La clé de service est lue depuis la variable d'environnement FIREBASE_SERVICE_KEY
// (définie dans Render.com → Environment)
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_KEY);

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});

const messaging = admin.messaging();

// ── Route santé (pour que Render sache que le serveur tourne) ─────────────────
app.get("/", (req, res) => {
    res.json({ status: "BennaGO Notification Server ✅", version: "1.0" });
});

// ── Route 1 : Nouvelle commande → notifie l'admin ─────────────────────────────
// POST /notify/admin
// Body: { orderId, clientName, total }
app.post("/notify/admin", async (req, res) => {
    const { orderId, clientName, total } = req.body;

    if (!orderId || !clientName || total === undefined) {
        return res.status(400).json({ error: "Champs manquants : orderId, clientName, total" });
    }

    const message = {
        topic: "admin",
        notification: {
            title: "🍽️ Nouvelle commande !",
            body:  `${clientName} — ${parseFloat(total).toFixed(3)} TND`,
        },
        data: {
            type:    "new_order",
            orderId: String(orderId),
            title:   "🍽️ Nouvelle commande !",
            body:    `${clientName} — ${parseFloat(total).toFixed(3)} TND`,
        },
        android: { priority: "high" },
    };

    try {
        const response = await messaging.send(message);
        console.log(`✅ Notif admin envoyée — commande #${orderId}`, response);
        res.json({ success: true, messageId: response });
    } catch (err) {
        console.error("❌ Erreur notif admin :", err);
        res.status(500).json({ error: err.message });
    }
});

// ── Route 2 : Statut changé → notifie le client ───────────────────────────────
// POST /notify/client
// Body: { clientToken, orderId, newStatus }
app.post("/notify/client", async (req, res) => {
    const { clientToken, orderId, newStatus } = req.body;

    if (!clientToken || !orderId || !newStatus) {
        return res.status(400).json({ error: "Champs manquants : clientToken, orderId, newStatus" });
    }

    const icons = {
        "Confirmée":    "✅",
        "En livraison": "🚚",
        "Livrée":       "🎉",
        "Annulée":      "❌",
    };
    const icon = icons[newStatus] || "⏳";

    const message = {
        token: clientToken,
        notification: {
            title: `${icon} Commande #${orderId}`,
            body:  `Votre commande est maintenant : ${newStatus}`,
        },
        data: {
            type:      "status_changed",
            orderId:   String(orderId),
            newStatus: newStatus,
            title:     `${icon} Commande #${orderId}`,
            body:      `Votre commande est maintenant : ${newStatus}`,
        },
        android: { priority: "high" },
    };

    try {
        const response = await messaging.send(message);
        console.log(`✅ Notif client envoyée — commande #${orderId} → ${newStatus}`);
        res.json({ success: true, messageId: response });
    } catch (err) {
        console.error("❌ Erreur notif client :", err);
        res.status(500).json({ error: err.message });
    }
});

// ── Démarrage serveur ─────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 BennaGO Notification Server lancé sur le port ${PORT}`);
});
