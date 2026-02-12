const express = require("express");
const cors = require("cors");

const app = express();

// ✅ Allow all origins (for testing)
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  })
);

app.use(express.json());

// Handle preflight manually (important for Vercel)
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }

  next();
});

// ─── In-Memory Product Database ───
const products = {
  A1B2C3D4: { name: "Milk (1L)", price: 40, category: "Dairy" },
  11223344: { name: "Bread (White)", price: 30, category: "Bakery" },
  55667788: { name: "Rice (1kg)", price: 65, category: "Grains" },
  AABBCCDD: { name: "Eggs (6 pcs)", price: 48, category: "Dairy" },
  99887766: { name: "Butter (100g)", price: 55, category: "Dairy" },
  DEADBEEF: { name: "Apple Juice (500ml)", price: 80, category: "Beverages" },
  CAFEBABE: { name: "Biscuits (200g)", price: 25, category: "Snacks" },
  F00DCAFE: { name: "Chips (150g)", price: 35, category: "Snacks" },
};

const carts = {};

function getCart(cartId) {
  if (!carts[cartId]) {
    carts[cartId] = {
      id: cartId,
      items: [],
      total: 0,
      createdAt: new Date().toISOString(),
    };
  }
  return carts[cartId];
}

// ─── ROUTES ───

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.get("/api/products", (req, res) => {
  res.json({ products });
});

app.post("/api/scan", (req, res) => {
  const { tag_id, cart_id = "default" } = req.body;

  if (!tag_id) {
    return res.status(400).json({ error: "tag_id is required" });
  }

  const normalizedTag = tag_id.toUpperCase().replace(/\s+/g, "");
  const product = products[normalizedTag];

  if (!product) {
    return res.status(404).json({ error: "Unknown product" });
  }

  const cart = getCart(cart_id);

  const existingIndex = cart.items.findIndex(
    (item) => item.tag_id === normalizedTag
  );

  let action;

  if (existingIndex !== -1) {
    cart.items.splice(existingIndex, 1);
    cart.total -= product.price;
    action = "removed";
  } else {
    cart.items.push({
      tag_id: normalizedTag,
      name: product.name,
      price: product.price,
      category: product.category,
      scannedAt: new Date().toISOString(),
    });
    cart.total += product.price;
    action = "added";
  }

  res.json({
    action,
    product: product.name,
    price: product.price,
    cart_total: cart.total,
    cart_items: cart.items.length,
    cart,
  });
});

app.get("/api/cart/:cartId", (req, res) => {
  const cart = getCart(req.params.cartId);
  res.json({ cart });
});

app.post("/api/cart/:cartId/clear", (req, res) => {
  const cartId = req.params.cartId;

  carts[cartId] = {
    id: cartId,
    items: [],
    total: 0,
    createdAt: new Date().toISOString(),
  };

  res.json({ message: "Cart cleared", cart: carts[cartId] });
});

app.post("/api/cart/:cartId/checkout", (req, res) => {
  const cart = getCart(req.params.cartId);

  if (cart.items.length === 0) {
    return res.status(400).json({ error: "Cart is empty" });
  }

  const receipt = {
    receiptId: `RCP-${Date.now()}`,
    items: [...cart.items],
    total: cart.total,
    itemCount: cart.items.length,
    checkoutTime: new Date().toISOString(),
  };

  carts[req.params.cartId] = {
    id: req.params.cartId,
    items: [],
    total: 0,
    createdAt: new Date().toISOString(),
  };

  res.json({ receipt });
});

app.get("/api/simulate/:tagId", (req, res) => {
  const normalizedTag = req.params.tagId.toUpperCase().replace(/\s+/g, "");
  const product = products[normalizedTag];

  if (!product) {
    return res.status(404).json({ error: "Unknown product" });
  }

  const cart = getCart("default");

  const existingIndex = cart.items.findIndex(
    (item) => item.tag_id === normalizedTag
  );

  let action;

  if (existingIndex !== -1) {
    cart.items.splice(existingIndex, 1);
    cart.total -= product.price;
    action = "removed";
  } else {
    cart.items.push({
      tag_id: normalizedTag,
      name: product.name,
      price: product.price,
      category: product.category,
      scannedAt: new Date().toISOString(),
    });
    cart.total += product.price;
    action = "added";
  }
  

  res.json({
    action,
    product: product.name,
    price: product.price,
    cart_total: cart.total,
    cart_items: cart.items.length,
    cart,
  });
});

// ✅ EXPORT FOR VERCEL (IMPORTANT)
module.exports = app; 
