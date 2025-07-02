const Rubric = require("../models/Rubric");

// Create a new rubric
const createRubric = async (req, res) => {
  try {
    const { name, categories } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Rubric name is required." });
    }

    const existing = await Rubric.findOne({ name });
    if (existing) {
      return res.status(400).json({ message: "This rubric already exists." });
    }

    const newRubric = new Rubric({ name, categories });
    const savedRubric = await newRubric.save();

    res.status(201).json(savedRubric);
  } catch (error) {
    res.status(500).json({ message: "Error creating rubric.", error: error.message });
  }
};

// Get all rubrics
const getRubrics = async (req, res) => {
  try {
    const rubrics = await Rubric.find();
    res.json(rubrics);
  } catch (error) {
    res.status(500).json({ message: "Error retrieving rubrics.", error: error.message });
  }
};

const deleteRubric = async (req, res) => {
  try {
    const { id } = req.params;

    const deletedRubric = await Rubric.findByIdAndDelete(id);

    if (!deletedRubric) {
      return res.status(404).json({ message: "Rubric not found." });
    }

    res.status(200).json({ message: "Rubric deleted successfully." });
  } catch (error) {
    res.status(500).json({ message: "Error deleting rubric.", error: error.message });
  }
};

const updateRubric = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, categories } = req.body;

    const updatedRubric = await Rubric.findByIdAndUpdate(
      id,
      { name, categories },
      { new: true, runValidators: true }
    );

    if (!updatedRubric) {
      return res.status(404).json({ message: "Rubric not found." });
    }

    res.json(updatedRubric);
  } catch (error) {
  console.error("❌ Update rubric error:", error);
  res.status(500).json({ message: "Error updating rubric.", error: error.message });
}
};

const removeCategoryFromRubric = async (req, res) => {
  try {
    const { rubricId, categoryName } = req.params;

    const updatedRubric = await Rubric.findByIdAndUpdate(
      rubricId,
      { $pull: { categories: { name: categoryName } } },
      { new: true }
    );

    if (!updatedRubric) {
      return res.status(404).json({ message: "Rubric not found." });
    }

    res.json(updatedRubric);
  } catch (error) {
    res.status(500).json({
      message: "Error removing category from rubric.",
      error: error.message,
    });
  }
};

module.exports = {
  createRubric,
  getRubrics,
  deleteRubric,
  updateRubric,
  removeCategoryFromRubric,
};