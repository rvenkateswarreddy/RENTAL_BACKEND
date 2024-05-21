// models/Property.js
const mongoose = require("mongoose");

const propertySchema = new mongoose.Schema({
  title: String,
  description: String,
  price: Number,
  bedrooms: Number,
  bathrooms: Number,
  location: String,
  amenities: [String],
  owner: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  likes: { type: Number, default: 0 },
  likedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  interestedBuyers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
});

module.exports = mongoose.model("Property", propertySchema);
