const express = require("express");
const Property = require("../models/Property");
const User = require("../models/User");
const auth = require("../middleware/auth");
const router = express.Router();
const sendEmail = require("../utils/mailer");

// Create a new property
router.post("/", auth, async (req, res) => {
  const {
    title,
    description,
    price,
    bedrooms,
    bathrooms,
    location,
    amenities,
  } = req.body;
  try {
    const property = new Property({
      title,
      description,
      price,
      bedrooms,
      bathrooms,
      location,
      amenities,
      owner: req.user,
    });
    await property.save();
    res.status(201).json(property);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get all properties with optional filtering, pagination, and sorting
router.get("/", async (req, res) => {
  const {
    page = 1,
    limit = 10,
    search = "",
    bedrooms,
    priceMin,
    priceMax,
    sort = "date",
  } = req.query;
  const query = {
    title: { $regex: search, $options: "i" },
    price: { $gte: priceMin || 0, $lte: priceMax || 10000000 },
    bedrooms: { $gte: bedrooms || 1 },
  };

  try {
    const properties = await Property.find(query)
      .sort(sort === "price" ? { price: 1 } : { createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();
    const count = await Property.countDocuments(query);
    res.status(200).json({
      properties,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router.get("/:propertyId/owner", auth, async (req, res) => {
  try {
    const property = await Property.findById(req.params.propertyId).populate({
      path: "owner",
      select: "firstName lastName email phone", // Specify the fields you want to return
    });

    if (!property) {
      return res.status(404).json({ message: "Property not found" });
    }

    if (!property.owner) {
      return res.status(404).json({ message: "Owner details not found" });
    }

    res.json({
      owner: {
        firstName: property.owner.firstName,
        lastName: property.owner.lastName,
        email: property.owner.email,
        phone: property.owner.phone,
        // Add more fields as needed
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

router.patch("/:id", auth, async (req, res) => {
  const updates = req.body;
  try {
    const property = await Property.findOneAndUpdate(
      { _id: req.params.id, owner: req.user },
      updates,
      { new: true }
    );
    if (!property) {
      return res.status(404).json({
        message: "Property not found or user not authorized to update",
      });
    }
    res.status(200).json(property);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Delete a property
router.delete("/:id", auth, async (req, res) => {
  try {
    const property = await Property.findOneAndDelete({
      _id: req.params.id,
      owner: req.user,
    });
    if (!property) {
      return res.status(404).json({
        message: "Property not found or user not authorized to delete",
      });
    }
    res.status(200).json({ message: "Property deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Express interest in a property
router.post("/:id/interest", auth, async (req, res) => {
  const propertyId = req.params.id;
  const userId = req.user;
  try {
    const property = await Property.findById(propertyId);
    const user = await User.findById(userId);
    if (!property) {
      return res.status(404).json({ message: "Property not found" });
    }
    if (property.interestedBuyers.includes(userId)) {
      return res.status(400).json({
        message: "You have already expressed interest in this property",
      });
    }
    property.interestedBuyers.push(userId);
    await property.save();

    // Send email to seller
    const ownerDetails = await User.findById(property.owner);
    sendEmail({
      to: ownerDetails.email,
      subject: "Someone is interested in your property",
      text: `Hi ${ownerDetails.firstName},\n\n${user.firstName} ${user.lastName} is interested in your property located at ${property.location}. You can contact them at ${user.email}.`,
    });

    // Optionally, confirm interest to the buyer
    sendEmail({
      to: user.email,
      subject: "You expressed interest in a property",
      text: `Hi ${user.firstName},\n\nYou expressed interest in the property located at ${property.location}. The seller's contact details are ${ownerDetails.email}.`,
    });

    res
      .status(200)
      .json({ message: "Interest registered successfully", ownerDetails });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router.get("/myproperties", auth, async (req, res) => {
  try {
    const properties = await Property.find({ owner: req.user }).populate(
      "likedBy",
      "firstName lastName email"
    );
    res.json(properties);
  } catch (error) {
    res.status(500).send(error.message);
  }
});
// Get interested buyers for a property
router.get("/:id/interest", auth, async (req, res) => {
  try {
    const property = await Property.findById(req.params.id).populate(
      "interestedBuyers",
      "firstName lastName email phone"
    );
    if (!property) {
      return res.status(404).json({ message: "Property not found" });
    }

    console.log("req.user:", req.user); // Check if req.user is defined
    console.log("Property owner:", property.owner); // Check property owner

    res.status(200).json({ interestedBuyers: property.interestedBuyers });
  } catch (error) {
    console.error(error); // Log the full error
    res.status(500).json({ error: error.message });
  }
});

// Like a property
router.post("/:id/like", auth, async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);
    if (!property) {
      return res.status(404).json({ message: "Property not found" });
    }

    // Check if the user has already liked the property
    if (!property.likedBy.includes(req.user)) {
      property.likedBy.push(req.user);
      property.likes += 1; // Increment the likes count
      await property.save();
    }

    res.status(200).json({
      message: "Property liked successfully",
      likes: property.likes,
      likedBy: property.likedBy.length, // Optionally send back the number of likes
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
