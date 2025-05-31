require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const midtransClient = require("midtrans-client");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

// Midtrans Snap client for creating QRIS transactions
const snap = new midtransClient.Snap({
  isProduction: false,
  serverKey: process.env.MIDTRANS_SERVER_KEY,
  clientKey: process.env.MIDTRANS_CLIENT_KEY,
});

// Midtrans Core API client for checking transaction status
const core = new midtransClient.CoreApi({
  isProduction: false,
  serverKey: process.env.MIDTRANS_SERVER_KEY,
  clientKey: process.env.MIDTRANS_CLIENT_KEY,
});

// Create transaction endpoint
app.post("/create-transaction", async (req, res) => {
  try {
    const { total } = req.body;

    if (!total || isNaN(total)) {
      return res.status(400).json({ error: "Invalid total amount" });
    }

    const orderId = "order-" + Date.now();
    console.log("🆕 Creating QRIS for order:", orderId);

    const chargeParams = {
      payment_type: "qris",
      transaction_details: {
        order_id: orderId,
        gross_amount: parseInt(total),
      },
      qris: {},
      customer_details: {
        first_name: "Customer",
        email: "customer@example.com",
        phone: "081234567890",
      },
    };

    const transaction = await core.charge(chargeParams);

    console.log("✅ Midtrans charge response:", JSON.stringify(transaction, null, 2));

    const qrUrl = transaction.actions?.find(a => a.name === "qr-code")?.url;

    if (!qrUrl) {
      console.error("❌ QR code URL not found in response.");
      return res.status(500).json({ error: "QRIS URL not found in Midtrans response." });
    }

    return res.json({ qrUrl, orderId });
  } catch (error) {
    console.error("❌ Error creating transaction:", error.response?.data || error.message || error);
    return res.status(500).json({ error: "Failed to create QRIS transaction" });
  }
});

// Check transaction status endpoint
app.get("/check-transaction", async (req, res) => {
  try {
    const { order_id } = req.query;

    if (!order_id) {
      return res.status(400).json({ error: "Missing order_id" });
    }

    console.log("🔍 Checking status for order ID:", order_id);

    const statusResponse = await core.transaction.status(order_id);
    console.log("✅ Status response:", JSON.stringify(statusResponse, null, 2));

    return res.json(statusResponse);
  } catch (error) {
    console.error("❌ Midtrans status check error:");
    console.error(error); // <-- Log full error object
    return res.status(500).json({ error: error.message || "Server error" });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});

console.log("🔧 Starting server, importing firebase-admin...");
const admin = require('firebase-admin');

const serviceAccount = JSON.parse(process.env.FIREBASE_ADMIN);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://sscos-f6774-default-rtdb.asia-southeast1.firebasedatabase.app"
});

const rtdb = admin.database();

function monitorDeviceHeartbeat(deviceId, thresholdSeconds = 7) {
  setInterval(async () => {
    try {
      const snapshot = await rtdb.ref(`${deviceId}/last_seen`).once("value");
      const lastSeen = snapshot.val();

      if (!lastSeen) return;

      const now = Math.floor(Date.now() / 1000);
      const diff = now - lastSeen;

      const powerRef = rtdb.ref(`${deviceId}/power`);

      if (diff > thresholdSeconds) {
        // Mark as offline
        await powerRef.set("offline");
        console.log(`[${deviceId}] Device offline (last seen ${diff}s ago)`);
      } else {
        // Mark as online
        await powerRef.set("online");
        console.log(`[${deviceId}] Device online`);
      }
    } catch (error) {
      console.error(`Error monitoring ${deviceId}:`, error);
    }
  }, 10000); // Check every 10 seconds
}

// Start monitoring
monitorDeviceHeartbeat("Device1");
// monitorDeviceHeartbeat("Device2"); // Add more if needed
