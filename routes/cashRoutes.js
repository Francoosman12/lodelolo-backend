const express = require("express");
const router = express.Router();
const {
  createCashMovement,
  openCash,
  closeCash,
  getCashMovementsByDate,
  getDailySummary,
  updateCashMovement,
  getMovementsByTurn,
  getUltimoCierrePorSucursal,
  deleteCashMovement
} = require("../controllers/cashController");

// 📥 Registrar apertura de caja
router.post("/open", openCash);

// 📤 Registrar cierre de caja (con cálculo automático de ventas)
router.post("/close", closeCash);

// ➕ Registrar ingreso o egreso manual
router.post("/", createCashMovement);

// 📅 Obtener movimientos por fecha
router.get("/", getCashMovementsByDate);

// 📊 Obtener resumen del día: total ingresos, egresos, ventas
router.get("/summary", getDailySummary);

router.put("/:id", updateCashMovement);

router.get("/turno", getMovementsByTurn);

router.get("/ultimo-cierre", getUltimoCierrePorSucursal);

router.delete("/:id", deleteCashMovement);

module.exports = router;