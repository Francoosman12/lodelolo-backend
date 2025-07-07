const mongoose = require('mongoose');

const cashMovementSchema = new mongoose.Schema({
  sucursal: { type: mongoose.Schema.Types.ObjectId, ref: 'Sucursal', required: true },
  responsable: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // quien registró el movimiento
  tipo: {
    type: String,
    enum: ['ingreso', 'egreso', 'apertura', 'cierre', 'venta'],
    required: true
  },
  concepto: { type: String, required: true }, // ejemplo: "Venta diaria", "Rendición", "Retiro de efectivo"
  monto: { type: Number, required: true },
  metodo_pago: {
    type: String,
    enum: ['efectivo', 'tarjeta', 'transferencia'],
    default: 'efectivo'
  },
  vinculada_a_venta: { type: mongoose.Schema.Types.ObjectId, ref: 'Sale' }, // opcional
  comentario: { type: String, default: "" },
  fecha_movimiento: { type: Date, default: Date.now },
  activo: { type: Boolean, default: true }
});

module.exports = mongoose.model('CashMovement', cashMovementSchema);