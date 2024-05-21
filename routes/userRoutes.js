const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const router = express.Router();
const { check, validationResult } = require("express-validator");
// Register User
router.post(
  "/register",
  [
    check("email", "Please include a valid email").isEmail(),
    check("firstName", "First name is required").not().isEmpty(),
    check("lastName", "Last name is required").not().isEmpty(),
    check(
      "password",
      "Please enter a password with 6 or more characters"
    ).isLength({ min: 3 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { firstName, lastName, email, phone, password, isSeller } = req.body;

    try {
      // Check if user already exists
      let existingUser = await User.findOne({ email });
      if (existingUser) {
        return res
          .status(400)
          .json({ message: "User already exists with this email" });
      }

      const user = new User({
        firstName,
        lastName,
        email,
        phone,
        password,
        isSeller,
      });

      await user.save();
      res.status(201).json({ message: "User registered successfully" });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

// User Login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  console.log("Attempting login for:", email); // Debug log

  try {
    const user = await User.findOne({ email });
    if (!user) {
      console.log("User not found for email:", email); // Debug log
      return res.status(404).json({ message: "User not found" });
    }

    if (user.password !== password) {
      console.log("Password does not match for user:", email); // Debug log
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      { userId: user._id, isSeller: user.isSeller },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.json({
      token,
      user: {
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        isSeller: user.isSeller,
      },
    });
  } catch (error) {
    console.error("Server error during login for:", email, error); // Debug log
    res.status(500).json({ error: error.message });
  }
});
module.exports = router;
