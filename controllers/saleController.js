const mongoose = require('mongoose');
const Sale = require('../models/Sale');
const Product = require('../models/Product');
const User = require('../models/User');
const Sucursal = require('../models/Sucursal');

// Obtener todas las ventas
const getSales = async (req, res) => {
  try {
    const { fechaInicio, fechaFin } = req.query;

    const filtro = {};
    if (fechaInicio && fechaFin) {
      filtro.fecha_venta = { $gte: new Date(fechaInicio), $lte: new Date(fechaFin) };
    }

    const sales = await Sale.find(filtro)
      .populate("id_vendedor")
      .populate("sucursal")
      .populate("productos.id_producto");

    // ✅ Convertir `total` correctamente para evitar NaN
    const formattedSales = sales.map(sale => ({
      ...sale._doc,
      total: sale.total instanceof mongoose.Types.Decimal128
        ? parseFloat(sale.total.toString()) // ✅ Convertir Decimal128 a número correctamente
        : parseFloat(sale.total) || 0, // ✅ Evita valores `undefined`
    }));

    res.json(formattedSales);
  } catch (error) {
    console.error("❌ Error al obtener ventas:", error);
    res.status(500).json({ message: "Error al obtener ventas", error: error.message });
  }
};

const getSalesReport = async (req, res) => {
  try {
    const { fechaInicio, fechaFin } = req.query;

    console.log("📌 Buscando ventas entre:", fechaInicio, "y", fechaFin);

    const ventas = await Sale.find({
      fecha_venta: {
        $gte: new Date(fechaInicio), // ✅ Convierte correctamente a `Date`
        $lte: new Date(fechaFin)
      }
    }).populate("id_vendedor").populate("sucursal").populate("productos.id_producto");

    console.log("📌 Ventas encontradas:", ventas);

    res.json(ventas);
  } catch (error) {
    console.error("❌ Error al obtener ventas:", error);
    res.status(500).json({ message: "Error en el reporte de ventas", error: error.message });
  }
};

// Crear una nueva venta
const createSale = async (req, res) => {
  try {
    console.log("🛒 Datos recibidos en el backend:", req.body);

    const {
  id_vendedor,
  sucursal,
  productos,
  total,
  metodo_pago,
  comentario,
  direccion_entrega,
  cliente
} = req.body;

    if (!id_vendedor || !sucursal || !productos || productos.length === 0 || !total || !metodo_pago) {
      return res.status(400).json({ message: "Faltan datos en la solicitud de venta." });
    }

    // ✅ Verificar existencia y stock de productos antes de procesar la venta
    const productosValidos = [];
    for (const item of productos) {
      const productoExistente = await Product.findById(item.id_producto);

      if (!productoExistente) {
        return res.status(400).json({ message: `❌ El producto con ID ${item.id_producto} no existe.` });
      }

      if (productoExistente.cantidad_stock < item.cantidad_vendida) {
        return res.status(400).json({
          message: `⚠️ Stock insuficiente para "${productoExistente.nombre}". Solo quedan ${productoExistente.cantidad_stock} unidades.`,
        });
      }

      productosValidos.push({ producto: productoExistente, cantidad_vendida: item.cantidad_vendida });
    }

    // ✅ Si pasó la validación, proceder con la venta
    const newSale = new Sale({
  id_vendedor,
  sucursal,
  productos,
  cantidad_vendida: productos.reduce((sum, item) => sum + item.cantidad_vendida, 0),
  total: mongoose.Types.Decimal128.fromString(total.toString()),
  metodo_pago,
  comentario: comentario || "",
  direccion_entrega: direccion_entrega || "",
  cliente: cliente || ""
});

    const savedSale = await newSale.save();

    // 📥 Registrar movimiento de caja por venta
const CashMovement = require("../models/CashMovement"); // Asegurate de importar el modelo

const movimientoVenta = new CashMovement({
  tipo: "venta",
  concepto: `Venta a ${cliente || "cliente sin nombre"}`,
  monto: parseFloat(total),
  sucursal,
  responsable: id_vendedor,
  metodo_pago: metodo_pago.tipo || "efectivo",
  comentario: comentario || `Venta registrada automáticamente`,
  fecha_movimiento: new Date()
});

await movimientoVenta.save();

    // ✅ Restar stock a los productos vendidos
    for (const { producto, cantidad_vendida } of productosValidos) {
      await Product.findByIdAndUpdate(producto._id, {
        $inc: { cantidad_stock: -cantidad_vendida },
      });
    }

    res.status(201).json({ message: "✅ Venta registrada correctamente.", sale: savedSale });
  } catch (error) {
    console.error("❌ Error al registrar la venta:", error.message);
    res.status(500).json({ message: "Error al registrar la venta", error: error.message });
  }
};

const getSalesByCategory = async (req, res) => {
  try {
    const fechaInicio = new Date();
    fechaInicio.setHours(0, 0, 0, 0); // ✅ Establece el inicio del día
    const fechaFin = new Date();
    fechaFin.setHours(23, 59, 59, 999); // ✅ Establece el final del día

    console.log("📌 Buscando ventas entre:", fechaInicio, "y", fechaFin);

    const ventas = await Sale.find({
      fecha_venta: { $gte: fechaInicio, $lte: fechaFin }
    }).populate("productos.id_producto");

    console.log("📌 Ventas encontradas:", ventas);

    // ✅ Agrupar ventas por categoría
    const salesByCategory = {};
    ventas.forEach(sale => {
      sale.productos.forEach(prod => {
        const categoria = prod.id_producto.categoria || "Sin categoría";
        if (!salesByCategory[categoria]) {
          salesByCategory[categoria] = 0;
        }
        salesByCategory[categoria] += prod.cantidad_vendida * prod.subtotal;
      });
    });

    console.log("📌 Agrupación por categoría:", salesByCategory);

    res.json(Object.entries(salesByCategory).map(([categoria, totalVentas]) => ({ categoria, totalVentas })));
  } catch (error) {
    console.error("❌ Error al obtener ventas por categoría:", error);
    res.status(500).json({ message: "Error al obtener ventas por categoría", error: error.message });
  }
};

const getKPI = async (req, res) => {
  try {
    const fechaInicio = new Date();
    fechaInicio.setHours(0, 0, 0, 0);
    const fechaFin = new Date();
    fechaFin.setHours(23, 59, 59, 999);

    console.log("📌 Buscando ventas entre:", fechaInicio, "y", fechaFin);

    const ventas = await Sale.find({
      fecha_venta: { $gte: fechaInicio, $lte: fechaFin }
    });

    const totalVentas = ventas.reduce((sum, sale) => sum + sale.total, 0);
    const numTransacciones = ventas.length;
    const ticketPromedio = numTransacciones > 0 ? totalVentas / numTransacciones : 0;

    console.log("📌 KPI calculado:", { totalVentas, ticketPromedio, numTransacciones });

    res.json({ totalVentas, ticketPromedio, numTransacciones });
  } catch (error) {
    console.error("❌ Error al calcular KPI:", error);
    res.status(500).json({ message: "Error al calcular KPI", error: error.message });
  }
};

const getSalesBySeller = async (req, res) => {
  try {
    const ventas = await Sale.find().populate("id_vendedor");

    console.log("📌 Ventas encontradas:", ventas);

    // ✅ Agrupar ventas por vendedor
    const salesBySeller = {};
    ventas.forEach(sale => {
      const vendedor = sale.id_vendedor.nombre || "Desconocido";
      if (!salesBySeller[vendedor]) {
        salesBySeller[vendedor] = 0;
      }
      salesBySeller[vendedor] += sale.total;
    });

    console.log("📌 Agrupación por vendedor:", salesBySeller);

    res.json(Object.entries(salesBySeller).map(([vendedor, totalVentas]) => ({ vendedor, totalVentas })));
  } catch (error) {
    console.error("❌ Error al obtener ventas por vendedor:", error);
    res.status(500).json({ message: "Error al obtener ventas por vendedor", error: error.message });
  }
};

module.exports = { getSales, getSalesReport, getSalesByCategory, createSale, getKPI, getSalesBySeller };
