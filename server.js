
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const nodemailer = require("nodemailer");

const app = express();
const PORT = process.env.PORT || 3000;

const allowedOrigin = process.env.FRONTEND_ORIGIN;
const ownerEmail = process.env.OWNER_EMAIL;
const discordWebhook = process.env.DISCORD_WEBHOOK_URL;

const products = {
  pc: { name: "PC / Laptop Tweaks", price: "8.99" },
  ps: { name: "PlayStation Tweaks", price: "8.99" },
  xbox: { name: "Xbox Tweaks", price: "8.99" }
};

app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    // Permit server-to-server health checks with no Origin header.
    if (!origin || origin === allowedOrigin) return callback(null, true);
    return callback(new Error("Origin not allowed"));
  },
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type"]
}));
app.use(express.json({ limit: "10kb" }));

app.use("/api/", rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many requests. Please wait and try again." }
}));

function clean(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));
}

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.post("/api/orders", async (req, res) => {
  try {
    const name = clean(req.body.name, 80);
    const email = clean(req.body.email, 254);
    const discord = clean(req.body.discord, 80);
    const phone = clean(req.body.phone, 30);
    const paymentMethod = clean(req.body.paymentMethod, 80);
    const notes = clean(req.body.notes, 500);
    const productKey = clean(req.body.product, 20);

    const product = products[productKey];

    const allowedPaymentMethods = [
      "PayPal",
      "Card through payment provider",
      "Apple Pay through payment provider",
      "Discuss payment options"
    ];

    if (!name || !email || !validEmail(email) || !product) {
      return res.status(400).json({ error: "Please check your name, email, and selected package." });
    }

    if (!allowedPaymentMethods.includes(paymentMethod)) {
      return res.status(400).json({ error: "Please choose a valid payment preference." });
    }

    if (!ownerEmail || !process.env.SMTP_HOST || !process.env.SMTP_USER ||
        !process.env.SMTP_PASS || !process.env.SMTP_PORT) {
      console.error("Email environment variables are missing.");
      return res.status(503).json({ error: "The order system is not configured yet." });
    }

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    const orderId = `RYVX-${Date.now()}`;
    const safeName = escapeHtml(name);
    const safeEmail = escapeHtml(email);
    const safeDiscord = escapeHtml(discord || "Not provided");
    const safePhone = escapeHtml(phone || "Not provided");
    const safePayment = escapeHtml(paymentMethod);
    const safeNotes = escapeHtml(notes || "None");

    const emailText = [
      `New Ryvx Tweaks order request`,
      `Order ID: ${orderId}`,
      `Package: ${product.name}`,
      `Request total: $${product.price}`,
      `Name: ${name}`,
      `Email: ${email}`,
      `Discord: ${discord || "Not provided"}`,
      `Phone: ${phone || "Not provided"}`,
      `Preferred payment: ${paymentMethod}`,
      `Notes: ${notes || "None"}`,
      ``,
      `This is an order request only. No payment was collected.`
    ].join("\n");

    await transporter.sendMail({
      from: `"Ryvx Tweaks Orders" <${process.env.SMTP_USER}>`,
      to: ownerEmail,
      replyTo: email,
      subject: `New order request: ${product.name} (${orderId})`,
      text: emailText,
      html: `
        <h2>New Ryvx Tweaks order request</h2>
        <p><strong>Order ID:</strong> ${orderId}</p>
        <p><strong>Package:</strong> ${escapeHtml(product.name)}</p>
        <p><strong>Request total:</strong> $${product.price}</p>
        <p><strong>Name:</strong> ${safeName}</p>
        <p><strong>Email:</strong> ${safeEmail}</p>
        <p><strong>Discord:</strong> ${safeDiscord}</p>
        <p><strong>Phone:</strong> ${safePhone}</p>
        <p><strong>Preferred payment:</strong> ${safePayment}</p>
        <p><strong>Notes:</strong> ${safeNotes}</p>
        <hr>
        <p>This is an order request only. No payment was collected.</p>
      `
    });

    if (discordWebhook) {
      const discordMessage = {
        content: `**New Ryvx Tweaks order request**\n**Order:** ${orderId}\n**Package:** ${product.name}\n**Request total:** $${product.price}\n**Name:** ${name}\n**Email:** ${email}\n**Discord:** ${discord || "Not provided"}\n**Phone:** ${phone || "Not provided"}\n**Preferred payment:** ${paymentMethod}\n**Notes:** ${notes || "None"}\n\n_No payment was collected._`,
        allowed_mentions: { parse: [] }
      };

      const discordResponse = await fetch(discordWebhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(discordMessage)
      });

      if (!discordResponse.ok) {
        // The email was already sent; log the issue without exposing webhook details.
        console.error("Discord notification failed with status:", discordResponse.status);
      }
    }

    return res.status(201).json({
      success: true,
      orderId,
      message: "Order request received."
    });
  } catch (error) {
    console.error("Order request error:", error.message);
    return res.status(500).json({ error: "Could not send your request. Please try again later." });
  }
});

app.listen(PORT, () => {
  console.log(`Ryvx order server listening on port ${PORT}`);
});
