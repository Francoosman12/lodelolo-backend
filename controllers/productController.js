const mongoose = require('mongoose');
const Product = require('../models/Product');
const Sucursal = require('../models/Sucursal');
const xlsx = require('xlsx');
const cloudinary = require("../config/cloudinaryConfig");
const Settings = require("../models/Settings");

// Obtener todos los productos
const getProducts = async (req, res) => {
  try {
    const products = await Product.find().populate('sucursal');
    // Convertir precios a formato numérico con separadores de miles
    const formattedProducts = products.map(product => ({
      ...product._doc,
      precio_costo: new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'ARS' })
                        .format(parseFloat(product.precio_costo.toString())),
      precio_publico: new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'ARS' })
                        .format(parseFloat(product.precio_publico.toString())),
    }));
    res.json(formattedProducts);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener productos', error: error.message });
  }
};

// Obtener productos por sucursal
const getProductsBySucursal = async (req, res) => {
  try {
    const { sucursal } = req.params;

    // Verificar que la sucursal exista
    const sucursalExistente = await Sucursal.findById(sucursal);
    if (!sucursalExistente) {
      return res.status(400).json({ message: 'La sucursal proporcionada no existe' });
    }

    const products = await Product.find({ sucursal }).populate('sucursal');
    if (products.length === 0) {
      return res.status(404).json({ message: 'No se encontraron productos para esta sucursal' });
    }

    const formattedProducts = products.map(product => ({
      ...product._doc,
      precio_costo: new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'ARS' })
                        .format(parseFloat(product.precio_costo.toString())),
      precio_publico: new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'ARS' })
                        .format(parseFloat(product.precio_publico.toString())),
    }));

    res.json(formattedProducts);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener productos por sucursal', error: error.message });
  }
};

// Crear un nuevo producto
const createProduct = async (req, res) => {
  try {
    console.log("✅ req.body recibido:", req.body);
    console.log("✅ req.file recibido:", req.file);

    if (!req.body.nombre || !req.body.rubro || !req.body.categoria) {
      return res.status(400).json({ message: "Faltan datos obligatorios (nombre, rubro, categoría)." });
    }

const fechaVencimientoRaw = req.body.fecha_vencimiento;

// ✅ Si llega como array, tomar solo el primer valor
const fechaVencimientoStr = Array.isArray(fechaVencimientoRaw)
  ? fechaVencimientoRaw[0]
  : fechaVencimientoRaw;

console.log("📅 Fecha recibida en backend:", fechaVencimientoStr);

// ✅ Convertir solo si es un string con formato adecuado
const fechaFinal = fechaVencimientoStr ? new Date(fechaVencimientoStr) : null;

if (!fechaFinal || isNaN(fechaFinal.getTime())) {
  return res.status(400).json({ message: "⚠️ Fecha de vencimiento inválida." });
}

    const atributosFinales = typeof req.body.atributos === "string"
      ? JSON.parse(req.body.atributos)
      : req.body.atributos;

    let imagen_url = "";
    if (req.file) {
      const result = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: "products" },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        stream.end(req.file.buffer);
      });
      imagen_url = result.secure_url;
      console.log("✅ Imagen subida a Cloudinary:", imagen_url);
    }

    // ✅ Si el SKU es enviado manualmente, usarlo. Si no, generar uno automáticamente.
    let skuFinal = req.body.sku && req.body.sku.trim() !== "" ? req.body.sku : null;

    if (!skuFinal) {
      const settings = await Settings.findOne();
      if (settings && settings.autoGenerateSKU) {
        let skuGenerado;
        let skuExiste = true;

        while (skuExiste) {
          skuGenerado = Math.floor(1000000000000 + Math.random() * 9000000000000).toString(); // ✅ Generar un número de 13 dígitos
          skuExiste = await Product.exists({ sku: skuGenerado }); // ✅ Verificar que el SKU generado sea único
        }

        skuFinal = skuGenerado;
      }
    }

    // ✅ Asegurar que el SKU nunca sea `null` o vacío
    if (!skuFinal) {
      skuFinal = Math.floor(1000000000000 + Math.random() * 9000000000000).toString(); // 🔄 Generar un SKU único como último recurso
    }

    const newProduct = new Product({
      nombre: req.body.nombre,
      rubro: req.body.rubro,
      categoria: req.body.categoria,
      atributos: atributosFinales,
      precio_costo: parseFloat(req.body.precio_costo).toFixed(2),
      precio_publico: parseFloat(req.body.precio_publico).toFixed(2),
      cantidad_stock: req.body.cantidad_stock,
      sku: skuFinal, // ✅ Ahora el SKU siempre tendrá 13 dígitos únicos
      fabricante: req.body.fabricante || "Desconocido",
      sucursal: req.body.sucursal,
      imagen_url,
      fecha_utima_actualizacion: new Date(),
      fecha_vencimiento: fechaFinal, // ✅ Guardar la fecha de vencimiento
    });

    const savedProduct = await newProduct.save();
    console.log("✅ Producto guardado correctamente:", savedProduct);

    res.status(201).json(savedProduct);
  } catch (error) {
    console.error("❌ Error al crear producto:", error.message);
    res.status(400).json({ message: "Error al crear producto", error: error.message });
  }
};

const parsePrecio = (valor) => {
  if (!valor) return 0;
  return parseFloat(valor.replace(/[^\d,]/g, "").replace(/\./g, "").replace(",", "."));
};

// Actualizar un producto existente
const updateProduct = async (req, res) => {
  try {
    const { sucursal, precio_costo, precio_publico } = req.body;
    let imagen_url = req.body.imagen_url; // ✅ Mantener imagen anterior si no se actualiza

console.log("📝 req.body recibido:", req.body);

if (typeof req.body.atributos === "string") {
  try {
    req.body.atributos = JSON.parse(req.body.atributos);
  } catch (err) {
    return res.status(400).json({ message: "⚠️ Atributos mal formateados" });
  }
}

console.log("📷 req.file recibido:", req.file); // 🔍 Ver si la imagen llega correctamente

    // ✅ Verificar que la sucursal existe antes de actualizar
    if (sucursal) {
      const sucursalExistente = await Sucursal.findById(sucursal);
      if (!sucursalExistente) {
        return res.status(400).json({ message: "La sucursal proporcionada no existe" });
      }
    }

    // ✅ Procesar imagen si hay una nueva subida
    if (req.file) {
      const result = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: "products" },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        stream.end(req.file.buffer);
      });

      imagen_url = result.secure_url;
      console.log("✅ Imagen subida a Cloudinary:", imagen_url);
    }

    // ✅ Convertir precios a formato numérico válido si se proporcionan
   req.body.precio_costo = mongoose.Types.Decimal128.fromString(parsePrecio(precio_costo).toFixed(2));
req.body.precio_publico = mongoose.Types.Decimal128.fromString(parsePrecio(precio_publico).toFixed(2));

    // ✅ Actualizar fecha de última modificación automáticamente
    req.body.fecha_ultima_actualizacion = new Date();
    req.body.imagen_url = imagen_url; // ✅ Guardar la imagen nueva si se subió

    const updatedProduct = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true }).populate("sucursal");

    res.json(updatedProduct);
  } catch (error) {
    res.status(400).json({ message: "Error al actualizar producto", error: error.message });
  }
};

// Eliminar un producto
const deleteProduct = async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ message: 'Producto eliminado con éxito' });
  } catch (error) {
    res.status(500).json({ message: 'Error al eliminar producto', error: error.message });
  }
};

// Cargar productos desde Excel
const uploadProductsFromExcel = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No se ha subido ningún archivo' });
    }
    // Leer el archivo Excel
    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0]; // Usar la primera hoja
    const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]); // Convertir a JSON

    // Columnas obligatorias (las que no son atributos dinámicos)
    const columnasObligatorias = ['nombre', 'categoria', 'precio_costo', 'precio_publico', 'cantidad_stock', 'fabricante', 'sucursal'];
    const productosProcesados = [];
    for (const item of data) {
      const { nombre, categoria, precio_costo, precio_publico, cantidad_stock, fabricante, sucursal } = item;

      // Verificar que la sucursal exista en la base de datos (buscando por nombre)
      const sucursalExistente = await Sucursal.findOne({ nombre: sucursal });
      if (!sucursalExistente) {
        return res.status(400).json({ message: `La sucursal ${sucursal} no existe` });
      }

      // Detectar atributos dinámicos y construirlos como arreglo de objetos
      const atributos = [];
      Object.keys(item).forEach(columna => {
        if (!columnasObligatorias.includes(columna)) {
          atributos.push({ nombre: columna, tipo: "texto", valor: item[columna] });
        }
      });

      // Crear el producto sin imagen (la imagen se puede agregar posteriormente)
      const newProduct = new Product({
        nombre,
        categoria,
        atributos, // Guardar el arreglo de atributos
        precio_costo: mongoose.Types.Decimal128.fromString(parseFloat(precio_costo).toFixed(2)),
        precio_publico: mongoose.Types.Decimal128.fromString(parseFloat(precio_publico).toFixed(2)),
        cantidad_stock,
        fabricante,
        sucursal: sucursalExistente._id,
      });

      productosProcesados.push(newProduct);
    }

    // Guardar los productos procesados en la base de datos
    await Product.insertMany(productosProcesados);
    res.status(201).json({ message: 'Productos cargados exitosamente', productos: productosProcesados });
  } catch (error) {
    res.status(500).json({ message: 'Error al procesar el archivo', error: error.message });
  }
};

// Subir imagen del producto a Cloudinary
const uploadImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No se ha subido ninguna imagen" });
    }
    const imageUrl = req.file.path; // Cloudinary genera la URL automáticamente
    res.json({ imageUrl });
  } catch (error) {
    res.status(500).json({ message: "Error al subir imagen", error: error.message });
  }
};

// Alternar el estado activo/inactivo de un producto
const toggleProductStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { activo } = req.body; // Se recibe el nuevo estado desde el frontend

    const updatedProduct = await Product.findByIdAndUpdate(id, { activo }, { new: true });
    res.json(updatedProduct);
  } catch (error) {
    res.status(500).json({ message: "Error al actualizar el estado del producto", error: error.message });
  }
};

module.exports = {
  getProducts,
  getProductsBySucursal,
  createProduct,
  updateProduct,
  deleteProduct,
  uploadProductsFromExcel,
  uploadImage,
  toggleProductStatus
};