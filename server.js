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
    console.log("Generated order ID:", orderId);

    const parameter = {
      transaction_details: {
        order_id: orderId,
        gross_amount: parseInt(total),
      },
      payment_type: "qris",
      qris: {},
      customer_details: {
        first_name: "Customer",
        email: "customer@example.com",
        phone: "081234567890",
      },
    };

    const transaction = await snap.createTransaction(parameter);
    console.log("Midtrans transaction response:", JSON.stringify(transaction, null, 2));

    const qrAction = transaction.actions?.find(action => action.name === "qr-code");
    const qrUrl = qrAction?.url || transaction.redirect_url;

    if (!qrUrl) {
      console.error("QRIS URL missing from Midtrans response.");
      return res.status(500).json({ error: "Failed to get QRIS URL from Midtrans response." });
    }

    // Return QR URL and order ID to frontend
    return res.json({ qrUrl, orderId });
  } catch (error) {
    console.error("Midtrans transaction error:", error.response?.data || error.message);
    return res.status(500).json({ error: error.message || "Server error" });
  }
});

// Check transaction status endpoint
app.get("/check-transaction", async (req, res) => {
  try {
    const { order_id } = req.query;

    if (!order_id) {
      return res.status(400).json({ error: "Missing order_id" });
    }

    console.log("Checking status for order ID:", order_id);
    const statusResponse = await core.transaction.status(order_id);
    console.log("Status response:", JSON.stringify(statusResponse, null, 2));

    return res.json(statusResponse);
  } catch (error) {
    console.error("Midtrans status check error:", error.response?.data || error.message);
    return res.status(500).json({ error: error.message || "Server error" });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
