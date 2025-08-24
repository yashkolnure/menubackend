const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const Restaurant = require("../models/Restaurant");
const MenuItem = require("../models/MenuItem");
const Order = require("../models/Order");  
const { verifyAdmin } = require("../middleware/verifyAdmin");
const { generateJWT } = require("../utils/generateJWT");
const auth = require("../middleware/auth");
const Agency = require("../models/Agency");
const OrderHistory = require("../models/OrderHistory");
const { route } = require("./public");
const Offer = require("../models/Offer");   
const verifySuperAdmin = require("../middleware/verifySuperAdmin");

const router = express.Router();


router.get('/pro-features', async (req, res) => {
  try {
    const data = await Restaurant.find({}, { proFeatures: 1, _id: 0 }); // only proFeatures field
    res.json(data); // returns an array of objects: [{ proFeatures: true }, { proFeatures: false }, ...]
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch data' });
  }
});


// GET all restaurants
router.get("/restaurants", async (req, res) => {
  try {
    const data = await Restaurant.find().sort({ createdAt: -1 });
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch restaurants" });
  }
});

// ADD new restaurant
router.post("/restaurants", async (req, res) => {
  try {
    const { name, email, password, address, logo, contact, membership_level } = req.body;

    // ✅ Validate required fields
    if (!name || !email || !password || !address || !logo || !contact || !membership_level) {
      return res.status(400).json({ message: "All fields including are required" });
    }
 
    // ✅ Check if email already exists
    const existing = await Restaurant.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: "Email already exists" });
    }

    // ✅ Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // ✅ Create restaurant with provided membership_level
    const restaurant = new Restaurant({
      name,
      email,
      passwordHash,
      address,
      logo,
      contact,
      membership_level
    });

    await restaurant.save();

    res.status(201).json(restaurant);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error creating restaurant" });
  }
});

// Backend route example
router.get("/restaurants/check-email", async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ message: "Email is required" });

    const existing = await Restaurant.findOne({ email });
    res.json({ exists: !!existing });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});
// UPDATE restaurant
router.put("/restaurants/:id", async (req, res) => {
  try {
    const updates = { ...req.body };
    if (updates.password) {
      updates.passwordHash = await bcrypt.hash(updates.password, 10);
      delete updates.password;
    }
    const updated = await Restaurant.findByIdAndUpdate(req.params.id, updates, { new: true });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: "Update failed" });
  }
});

// DELETE restaurant
router.delete("/restaurants/:id", async (req, res) => {
  try {
    await Restaurant.findByIdAndDelete(req.params.id);
    res.json({ message: "Deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Delete failed" });
  }
});

router.get("/:restaurantId/details", async (req, res) => {
  try {
    const restaurant = await Restaurant.findById(req.params.restaurantId);
    if (!restaurant) {
      return res.status(404).json({ message: "Restaurant not found" });
    }
    res.json(restaurant);
  } catch (error) {
    console.error("Error fetching restaurant details:", error);
    res.status(500).json({ message: "Server error" });
  }
});
router.post('/order-history', async (req, res) => {
  const { orderItems, totalAmount, tableNumber, restaurantId, invoiceNumber } = req.body;

  console.log("Received Order Data:", req.body);  // Debugging log

  try {
    // Validate incoming data
    if (!orderItems || orderItems.length === 0) {
      return res.status(400).json({ message: 'No items in the order' });
    }
    if (!totalAmount || !tableNumber || !restaurantId || !invoiceNumber) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // No need to fetch MenuItem data as the frontend is sending name, quantity, price directly
    const formattedOrderItems = orderItems.map(item => ({
      name: item.name,
      quantity: item.quantity,
      price: item.price,
    }));

    // Create a new order history entry
    const orderHistory = new OrderHistory({
      restaurantId,
      invoiceNumber,
      totalAmount,
      orderItems: formattedOrderItems,
      tableNumber,
    });

    // Save the order to the database
    await orderHistory.save();

    res.status(200).json({
      message: 'Order history saved successfully',
      orderHistory,
    });
  } catch (error) {
    console.error("Error saving order history:", error);
    res.status(500).json({ message: 'Error saving order history', error: error.message });
  }
});


// Update Menu Item
router.put("/:restaurantId/menu/:itemId", auth, async (req, res) => {
  try {
    const { restaurantId, itemId } = req.params;
    const updatedItem = await MenuItem.findOneAndUpdate(
      { _id: itemId, restaurantId },
      req.body,
      { new: true }
    );

    if (!updatedItem) {
      return res.status(404).json({ message: "Item not found" });
    }

    res.json(updatedItem);
  } catch (err) {
    console.error("Error updating item:", err);
    res.status(500).json({ message: "Update failed" });
  }
});


// GET all offers for a restaurant
router.get("/:restaurantId/offers", async (req, res) => {
  try {
    const offers = await Offer.find({ restaurant: req.params.restaurantId })
      .sort({ createdAt: -1 });
    res.json(offers);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST a new offer
router.post("/:restaurantId/offers", async (req, res) => {
  const { image } = req.body;
  if (!image) return res.status(400).json({ message: "Image is required" });
  try {
    const newOffer = new Offer({
      restaurant: req.params.restaurantId,
      image,
    });
    await newOffer.save();
    res.status(201).json(newOffer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error saving offer" });
  }
});

router.delete(
  "/:restaurantId/offers/:offerId",
  auth,
  async (req, res) => {
    try {
      const { restaurantId, offerId } = req.params;

      // Attempt to find & delete the offer that matches both IDs
      const deleted = await Offer.findOneAndDelete({
        _id: offerId,
        restaurant: restaurantId,
      });

      if (!deleted) {
        // No matching document
        return res.status(404).json({ message: "Offer not found" });
      }

      // Success
      res.json({ message: "Offer deleted successfully" });
    } catch (err) {
      console.error("Error deleting offer:", err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// Register a new restaurant
router.post("/restaurant/register", async (req, res) => {
  try {
    const { name, email, password, logo, address, proFeatures, contact, subadmin_id, membership_level } = req.body;

    // Check if email is already registered
    const existingRestaurant = await Restaurant.findOne({ email });
    if (existingRestaurant) {
      return res.status(400).json({ message: "Email already in use" });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Build restaurant object
    const newRestaurantData = {
      name,
      email,
      passwordHash,
      logo,
      address,
      contact,
      proFeatures: proFeatures || false,
      membership_level,
    };

    // Conditionally include subadmin_id if provided
    if (subadmin_id) {
      newRestaurantData.subadmin_id = subadmin_id;
    }

    // Create and save restaurant
    const newRestaurant = new Restaurant(newRestaurantData);
    await newRestaurant.save();

    res.status(201).json({
      message: "Restaurant registered successfully",
      restaurant: newRestaurant,
    });

  } catch (error) {
    console.error("Error registering restaurant:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// GET all restaurants for a specific subadmin
router.get("/restaurant/all", async (req, res) => {
  try {
    const { subadmin_id } = req.query;

    if (!subadmin_id) {
      return res.status(400).json({ message: "Missing subadmin_id" });
    }

    const restaurants = await Restaurant.find({ subadmin_id });

    res.status(200).json(restaurants);
  } catch (err) {
    console.error("Error fetching restaurants:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Bulk Insert Route
router.post('/bulk', async (req, res) => {
  try {
    const menuItems = req.body;

    if (!Array.isArray(menuItems)) {
      return res.status(400).json({ message: "Invalid data format. Expected an array." });
    }

    await MenuItem.insertMany(menuItems);
    res.status(200).json({ message: "Menu items uploaded successfully!" });
  } catch (error) {
    console.error("Bulk upload error:", error);
    res.status(500).json({ message: "Server error during bulk upload" });
  }
});

// Route to fetch all categories (static list)
router.get("/:restaurantId/categories", (req, res) => {
    res.json(categories); // Return static categories list
  });
  
  // Route to add a new menu item
  router.post("/:restaurantId/menu", async (req, res) => {
    const { name, category, description, price, image } = req.body;
  
    const newMenuItem = new MenuItem({
      name,
      category,
      description,
      price,
      image,
      restaurantId: req.params.restaurantId,
    });
  
    await newMenuItem.save();
    res.status(201).json(newMenuItem); // Return the newly added menu item
  });
  

  router.get("/billing", async (req, res) => {
    try {
      const billingData = await Billing.find().populate("restaurant"); // Ensure restaurant details are populated
      res.json(billingData);
    } catch (error) {
      console.error("Billing Fetch Error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });


  // Route to fetch menu items for the restaurant
  router.get("/:restaurantId/menu", async (req, res) => {
    try {
      const menuItems = await MenuItem.find({ restaurantId: req.params.restaurantId });
      res.json(menuItems); // Return all menu items for the restaurant
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch menu items" });
    }
  });
  
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log("Incoming login:", email, password);

    if (!email || !password) {
      console.log("Missing email or password");
      return res.status(400).json({ message: "Email and password are required" });
    }

    const restaurant = await Restaurant.findOne({ email });
    console.log("Restaurant found:", restaurant);

    if (!restaurant) {
      console.log("Restaurant not found");
      return res.status(400).json({ message: "Restaurant not found" });
    }

    if (!restaurant.passwordHash) {
      console.log("No passwordHash found");
      return res.status(500).json({ message: "Password is missing in database" });
    }

    console.log("Comparing passwords...");
    const isMatch = await bcrypt.compare(password, restaurant.passwordHash);
    console.log("Password match result:", isMatch);

    if (!isMatch) {
      console.log("Password mismatch");
      return res.status(400).json({ message: "Incorrect password" });
    }

    console.log("Creating token...");
    const token = jwt.sign(
      { restaurantId: restaurant._id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    console.log("Login successful");
    res.json({ token, restaurant });

  } catch (error) {
    console.error("Unexpected error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});



router.delete("/orders/:id", auth, async (req, res) => {
  try {
    const deletedOrder = await Order.findByIdAndDelete(req.params.id);
    if (!deletedOrder) {
      return res.status(404).json({ message: "Order not found" });
    }
    res.json({ message: "Order deleted successfully" });
  } catch (error) {
    console.error("Error deleting order:", error);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/:id/menu", auth, async (req, res) => {
    if (req.params.id !== req.restaurantId)
      return res.status(403).json({ message: "Forbidden" });
  
    const items = await MenuItem.find({ restaurantId: req.restaurantId });
    res.json(items);
  });
  
// Add Menu Item for Restaurant
router.post("/:id/menu", auth, async (req, res) => {
  if (req.params.id !== req.restaurantId)
    return res.status(403).json({ message: "Forbidden" });

  try {
    const newItem = new MenuItem({ ...req.body, restaurantId: req.restaurantId });
    await newItem.save();
    res.status(201).json(newItem);  // Return the newly added item
  } catch (err) {
    console.error("Error adding menu item:", err);
    res.status(500).json({ message: "Error adding menu item" });
  }
});

// Delete Menu Item
router.delete("/:id/menu/:itemId", auth, async (req, res) => {
  if (req.params.id !== req.restaurantId)
    return res.status(403).json({ message: "Forbidden" });

  try {
    await MenuItem.findOneAndDelete({ _id: req.params.itemId, restaurantId: req.restaurantId });
    res.json({ message: "Item deleted" });
  } catch (err) {
    console.error("Error deleting menu item:", err);
    res.status(500).json({ message: "Error deleting menu item" });
  }
});

// Get Orders for Admin Restaurant
router.get("/:id/orders", auth, async (req, res) => {
  if (req.params.id !== req.restaurantId)
    return res.status(403).json({ message: "Forbidden" });

  try {
    const orders = await Order.find({ restaurantId: req.restaurantId }).populate("items.itemId");
    res.json(orders);
  } catch (err) {
    console.error("Error fetching orders:", err);
    res.status(500).json({ message: "Failed to fetch orders", error: err.message });
  }
});

// ✅ Correct API Route
router.post("/clearTable/:tableNumber", async (req, res) => {
  try {
    console.log("🛠️ Clearing table:", req.params.tableNumber);
    res.json({ message: `Table ${req.params.tableNumber} cleared successfully!` });
  } catch (error) {
    console.error("❌ Error clearing table:", error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

router.get("/:restaurantId/order-history", auth, async (req, res) => {
  try {
    const { restaurantId } = req.params;
    
    // ✅ Validate restaurantId
    if (!mongoose.Types.ObjectId.isValid(restaurantId)) {
      return res.status(400).json({ message: "Invalid restaurant ID format" });
    }

    const objectId = new mongoose.Types.ObjectId(restaurantId);
    const orders = await OrderHistory.find({ restaurantId: objectId }).sort({ timestamp: -1 });

    // Optional: Some prefer returning 200 with empty array instead of 404
    if (orders.length === 0) {
      return res.status(200).json([]); // or keep 404 if that's your design
    }

    res.status(200).json(orders); // ✅ Always return JSON
  } catch (err) {
    console.error("❌ Error fetching order history:", err);

    // Optional: return error as JSON too
    res.status(500).json({ message: "Error fetching order history", error: err.message });
  }
});

router.post("/register-agency", async (req, res) => {
  try {
    const { agencyName, email, password, contactNumber, address, agencyLevel } = req.body;

    console.log("📩 Register Agency Request:", req.body);

    const existing = await Agency.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: "Agency already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const agency = new Agency({
      agencyName,
      email,
      password: hashedPassword,
      contactNumber,
      address,
      agencyLevel, // now this is defined
    });

    await agency.save();

    console.log("✅ Agency Saved:", agency);

    res.status(201).json({ message: "Agency registered successfully" });
  } catch (err) {
    console.error("❌ Register Error:", err);
    res.status(500).json({ message: "Error registering agency", error: err.message });
  }
});

router.post("/agency-login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const agency = await Agency.findOne({ email });
    if (!agency) {
      return res.status(404).json({ message: "Agency not found" });
    }

    const isMatch = await bcrypt.compare(password, agency.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    res.status(200).json({
      message: "Login successful",
      agency: {
        id: agency._id,
        name: agency.agencyName,
        email: agency.email,
        agencyLevel: agency.agencyLevel, // <-- add this
      },
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});
// ✅ Check if agency email exists
router.get("/agency/check-email", async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ message: "Email is required" });

    const existing = await Agency.findOne({ email });
    res.json({ exists: !!existing });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error checking email" });
  }
});



// Agency/Admin impersonates a restaurant
router.post("/agency-login-restaurant/:restaurantId", verifyAdmin, async (req, res) => {
  try {
    const { restaurantId } = req.params;

    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) return res.status(404).json({ message: "Restaurant not found" });

    // Generate impersonation JWT
    const token = generateJWT({
      id: restaurant._id,
      email: restaurant.email,
      name: restaurant.name,
      role: "restaurant",
      impersonatedBy: req.user._id, // which admin/agency triggered this
    });

    res.status(200).json({
      message: "Impersonation login successful",
      token,
      restaurant: {
        _id: restaurant._id,
        name: restaurant.name,
        email: restaurant.email,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// ⚠️ Not secure, but works if your page is already server-protected
router.post("/superadmin-login-restaurant/:restaurantId", async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) return res.status(404).json({ message: "Restaurant not found" });

    const token = generateJWT({
      id: restaurant._id,
      email: restaurant.email,
      name: restaurant.name,
      role: "restaurant",
      impersonatedBy: "superadmin",
    });

    res.status(200).json({
      message: "Superadmin impersonation successful",
      token,
      restaurant: {
        _id: restaurant._id,
        name: restaurant.name,
        email: restaurant.email,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});


module.exports = router;
