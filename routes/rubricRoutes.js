const express = require("express");
const router = express.Router();
const {
  createRubric,
  getRubrics,
  updateRubric,
  deleteRubric,
  removeCategoryFromRubric,
} = require("../controllers/rubricController");

// Crear y listar rubros
router.post("/", createRubric);
router.get("/", getRubrics);

// 🔧 Editar y eliminar por ID
router.put("/:id", updateRubric);
router.delete("/:id", deleteRubric);
router.delete("/:rubricId/categories/:categoryName", removeCategoryFromRubric);

module.exports = router;