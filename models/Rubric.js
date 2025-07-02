const mongoose = require("mongoose");

// Attribute schema: nested inside categories
const attributeSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: {
    type: String,
    enum: ["list", "text"],
    required: true,
  },
  values: [String],
});

// Category schema: nested inside rubric
const categorySchema = new mongoose.Schema({
  name: { type: String, required: true },
  attributes: [attributeSchema],
});

// Rubric schema: top-level structure
const rubricSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  categories: [categorySchema],
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Rubric", rubricSchema);