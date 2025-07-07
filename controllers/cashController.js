const CashMovement = require("../models/CashMovement");
const Sale = require("../models/Sale");
const mongoose = require("mongoose");

// 📥 Apertura de caja
const openCash = async (req, res) => {
  try {
    const { sucursal, responsable, monto, comentario } = req.body;

    if (!sucursal || !responsable || typeof monto !== "number") {
  return res.status(400).json({ message: "Faltan datos para apertura de caja." });
}

    const apertura = new CashMovement({
      tipo: "apertura",
      concepto: "Apertura de caja",
      monto,
      sucursal,
      responsable,
      comentario
    });

    await apertura.save();

    res.status(201).json({ message: "✅ Caja abierta correctamente.", movimiento: apertura });
  } catch (error) {
    console.error("❌ Error en apertura de caja:", error.message);
    res.status(500).json({ message: "Error en apertura de caja", error: error.message });
  }
};

// 📤 Cierre de caja (incluye suma automática de ventas del día)
const closeCash = async (req, res) => {
  try {
    const { sucursal, responsable, comentario } = req.body;

    if (!sucursal || !responsable) {
      return res.status(400).json({ message: "Faltan datos para cierre de caja." });
    }

    const inicioDia = new Date();
    inicioDia.setHours(0, 0, 0, 0);
    const finDia = new Date();
    finDia.setHours(23, 59, 59, 999);

    // 🔢 Obtener ventas
    const ventasDelDia = await Sale.find({
      sucursal,
      fecha_venta: { $gte: inicioDia, $lte: finDia }
    });
    const totalVentas = ventasDelDia.reduce((sum, sale) => sum + parseFloat(sale.total), 0);

    // 💰 Obtener ingresos y egresos
    const movimientos = await CashMovement.find({
      sucursal,
      fecha_movimiento: { $gte: inicioDia, $lte: finDia },
      tipo: { $in: ["ingreso", "egreso"] }
    });

    const totalIngresos = movimientos
      .filter(m => m.tipo === "ingreso")
      .reduce((sum, m) => sum + parseFloat(m.monto), 0);

    const totalEgresos = movimientos
      .filter(m => m.tipo === "egreso")
      .reduce((sum, m) => sum + parseFloat(m.monto), 0);

    // 📊 Saldo final real
    const saldoFinal = totalVentas + totalIngresos - totalEgresos;

    const cierre = new CashMovement({
      tipo: "cierre",
      concepto: "Cierre de caja",
   monto: typeof req.body.monto === "number" ? req.body.monto : saldoFinal,
      sucursal,
      responsable,
      comentario: comentario || `Ventas: $${totalVentas.toFixed(2)} + Ingresos: $${totalIngresos.toFixed(2)} − Egresos: $${totalEgresos.toFixed(2)} = Saldo: $${saldoFinal.toFixed(2)}`
    });

    await cierre.save();

    res.status(201).json({ message: "✅ Caja cerrada correctamente.", movimiento: cierre });
  } catch (error) {
    console.error("❌ Error al cerrar caja:", error.message);
    res.status(500).json({ message: "Error al cerrar caja", error: error.message });
  }
};

// ➕ Registro manual de ingreso o egreso
const createCashMovement = async (req, res) => {
  try {
    const { tipo, concepto, monto, sucursal, responsable, metodo_pago, comentario } = req.body;

    if (!tipo || !concepto || !monto || !sucursal || !responsable) {
      return res.status(400).json({ message: "Faltan campos obligatorios." });
    }

    const movimiento = new CashMovement({
      tipo,
      concepto,
      monto,
      sucursal,
      responsable,
      metodo_pago: metodo_pago || "efectivo",
      comentario
    });

    await movimiento.save();

    res.status(201).json({ message: "✅ Movimiento de caja registrado.", movimiento });
  } catch (error) {
    console.error("❌ Error al crear movimiento de caja:", error.message);
    res.status(500).json({ message: "Error al crear movimiento", error: error.message });
  }
};

// 📅 Obtener movimientos por fecha
const getCashMovementsByDate = async (req, res) => {
  try {
    const { fechaInicio, fechaFin, sucursal } = req.query;

    const filtro = { activo: true };
    if (sucursal) filtro.sucursal = sucursal;
    if (fechaInicio && fechaFin) {
      filtro.fecha_movimiento = {
        $gte: new Date(fechaInicio),
        $lte: new Date(fechaFin)
      };
    }

    const movimientos = await CashMovement.find(filtro)
      .populate("responsable")
      .populate("sucursal")
      .sort({ fecha_movimiento: 1 });

    res.json(movimientos);
  } catch (error) {
    console.error("❌ Error al obtener movimientos:", error.message);
    res.status(500).json({ message: "Error al obtener movimientos", error: error.message });
  }
};

// 📊 Resumen diario: total ingresos, egresos, ventas
const getDailySummary = async (req, res) => {
  try {
    const { sucursal } = req.query;

    const inicioDia = new Date();
    inicioDia.setHours(0, 0, 0, 0);
    const finDia = new Date();
    finDia.setHours(23, 59, 59, 999);

    const [ventas, movimientos] = await Promise.all([
      Sale.find({ sucursal, fecha_venta: { $gte: inicioDia, $lte: finDia } }),
      CashMovement.find({ sucursal, fecha_movimiento: { $gte: inicioDia, $lte: finDia } })
    ]);

    const totalVentas = ventas.reduce((sum, v) => sum + parseFloat(v.total), 0);
    const ingresos = movimientos.filter(m => m.tipo === "ingreso").reduce((s, m) => s + m.monto, 0);
    const egresos = movimientos.filter(m => m.tipo === "egreso").reduce((s, m) => s + m.monto, 0);

    res.json({
      totalVentas: Number(totalVentas.toFixed(2)),
      ingresos,
      egresos,
      netoCaja: Number((totalVentas + ingresos - egresos).toFixed(2))
    });
  } catch (error) {
    console.error("❌ Error al obtener resumen de caja:", error.message);
    res.status(500).json({ message: "Error al obtener resumen", error: error.message });
  }
};

const updateCashMovement = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      tipo,
      concepto,
      monto,
      sucursal,
      responsable,
      metodo_pago,
      comentario
    } = req.body;

    const movimiento = await CashMovement.findById(id);
    if (!movimiento) {
      return res.status(404).json({ message: "Movimiento no encontrado." });
    }

    movimiento.tipo = tipo;
    movimiento.concepto = concepto;
    movimiento.monto = monto;
    movimiento.sucursal = sucursal;
    movimiento.responsable = responsable;
    movimiento.metodo_pago = metodo_pago;
    movimiento.comentario = comentario;

    await movimiento.save();

    res.json({ message: "Movimiento actualizado correctamente.", movimiento });
  } catch (error) {
    console.error("❌ Error al actualizar movimiento:", error.message);
    res.status(500).json({ message: "Error al actualizar movimiento", error: error.message });
  }
};

const getMovementsByTurn = async (req, res) => {
  try {
    const { sucursal } = req.query;
    if (!sucursal) return res.status(400).json({ message: "Sucursal requerida" });

    // 🔍 Buscar apertura más reciente
    const apertura = await CashMovement.findOne({ sucursal, tipo: "apertura" })
      .sort({ fecha_movimiento: -1 });

    if (!apertura) return res.status(404).json({ message: "No se encontró apertura de caja" });

    // 🔍 Buscar el primer cierre luego de la apertura
    const cierre = await CashMovement.findOne({
      sucursal,
      tipo: "cierre",
      fecha_movimiento: { $gt: apertura.fecha_movimiento }
    }).sort({ fecha_movimiento: 1 });

    const fechaFin = cierre?.fecha_movimiento || new Date();

    // 📦 Obtener movimientos del turno
    const movimientos = await CashMovement.find({
      sucursal,
      fecha_movimiento: {
        $gte: apertura.fecha_movimiento,
        $lte: fechaFin
      }
    })
      .populate("sucursal")
      .populate("responsable")
      .sort({ fecha_movimiento: 1 });

    res.json({ apertura, cierre, movimientos });
  } catch (error) {
    console.error("❌ Error al obtener movimientos del turno:", error.message);
    res.status(500).json({ message: "Error al obtener movimientos del turno", error: error.message });
  }
};

const getUltimoCierrePorSucursal = async (req, res) => {
  try {
    const { sucursal } = req.query;
    if (!sucursal) {
      return res.status(400).json({ message: "Sucursal requerida" });
    }

    const cierre = await CashMovement.findOne({
      sucursal,
      tipo: "cierre"
    }).sort({ fecha_movimiento: -1 });

    if (!cierre) {
      return res.status(404).json({ message: "No hay cierres previos" });
    }

    res.json({ monto: cierre.monto });
  } catch (error) {
    console.error("❌ Error al obtener último cierre:", error.message);
    res.status(500).json({ message: "Error interno", error: error.message });
  }
};

const deleteCashMovement = async (req, res) => {
  try {
    const { id } = req.params;

    const movimiento = await CashMovement.findById(id);
    if (!movimiento) {
      return res.status(404).json({ message: "Movimiento no encontrado." });
    }

    await movimiento.deleteOne();

    res.json({ message: "🗑️ Movimiento eliminado correctamente." });
  } catch (error) {
    console.error("❌ Error al eliminar movimiento:", error.message);
    res.status(500).json({ message: "Error al eliminar movimiento", error: error.message });
  }
};

module.exports = {
  openCash,
  closeCash,
  createCashMovement,
  getCashMovementsByDate,
  getDailySummary,
  updateCashMovement,
  getMovementsByTurn,
  getUltimoCierrePorSucursal,
  deleteCashMovement
};