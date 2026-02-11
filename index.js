const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// ─── In-Memory Product Database ───
const products = {
  "A1B2C3D4": { name: "Milk (1L)", price: 40, category: "Dairy" },
  "11223344": { name: "Bread (White)", price: 30, category: "Bakery" },
  "55667788": { name: "Rice (1kg)", price: 65, category: "Grains" },
  "AABBCCDD": { name: "Eggs (6 pcs)", price: 48, category: "Dairy" },
  "99887766": { name: "Butter (100g)", price: 55, category: "Dairy" },
  "DEADBEEF": { name: "Apple Juice (500ml)", price: 80, category: "Beverages" },
  "CAFEBABE": { name: "Biscuits (200g)", price: 25, category: "Snacks" },
  "F00DCAFE": { name: "Chips (150g)", price: 35, category: "Snacks" },
};

// ─── Cart State (per cart_id) ───
// In production, use a database. This is a simple in-memory store.
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

// ─── API ROUTES ───

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Get all products (for admin/debug)
app.get("/api/products", (req, res) => {
  res.json({ products });
});

// ESP32 scans an RFID tag → POST /api/scan
app.post("/api/scan", (req, res) => {
  const { tag_id, cart_id = "default" } = req.body;

  if (!tag_id) {
    return res.status(400).json({ error: "tag_id is required" });
  }

  const normalizedTag = tag_id.toUpperCase().replace(/\s+/g, "");
  const product = products[normalizedTag];

  if (!product) {
    return res.status(404).json({
      error: "Unknown product",
      tag_id: normalizedTag,
    });
  }

  const cart = getCart(cart_id);

  // Check if item already in cart (toggle: add/remove)
  const existingIndex = cart.items.findIndex(
    (item) => item.tag_id === normalizedTag
  );

  let action;
  if (existingIndex !== -1) {
    // Remove item (scanned again = remove)
    cart.items.splice(existingIndex, 1);
    cart.total -= product.price;
    action = "removed";
  } else {
    // Add item
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

  const response = {
    action,
    product: product.name,
    price: product.price,
    cart_total: cart.total,
    cart_items: cart.items.length,
    cart: cart,
  };

  console.log(
    `[${action.toUpperCase()}] ${product.name} (₹${product.price}) → Cart Total: ₹${cart.total}`
  );

  res.json(response);
});

// Get cart details
app.get("/api/cart/:cartId", (req, res) => {
  const cart = getCart(req.params.cartId);
  res.json({ cart });
});

// Clear cart
app.post("/api/cart/:cartId/clear", (req, res) => {
  const cartId = req.params.cartId;
  carts[cartId] = {
    id: cartId,
    items: [],
    total: 0,
    createdAt: new Date().toISOString(),
  };
  console.log(`[CLEARED] Cart ${cartId}`);
  res.json({ message: "Cart cleared", cart: carts[cartId] });
});

// Checkout
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

  // Clear the cart after checkout
  carts[req.params.cartId] = {
    id: req.params.cartId,
    items: [],
    total: 0,
    createdAt: new Date().toISOString(),
  };

  console.log(
    `[CHECKOUT] Receipt ${receipt.receiptId} → ₹${receipt.total} (${receipt.itemCount} items)`
  );

  res.json({ receipt });
});

// Simulate RFID scan (for testing without ESP32)
app.get("/api/simulate/:tagId", (req, res) => {
  const tag_id = req.params.tagId;
  // Internally call the scan logic
  const normalizedTag = tag_id.toUpperCase().replace(/\s+/g, "");
  const product = products[normalizedTag];

  if (!product) {
    return res.status(404).json({ error: "Unknown product", tag_id: normalizedTag });
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
    cart: cart,
  });
});

// ─── START SERVER ───
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🛒 Smart Cart Server running on port ${PORT}`);
  console.log(`   Health:    http://localhost:${PORT}/api/health`);
  console.log(`   Products:  http://localhost:${PORT}/api/products`);
  console.log(`   Simulate:  http://localhost:${PORT}/api/simulate/A1B2C3D4`);
  console.log(`\n📡 Waiting for ESP32 scans...\n`);
});
