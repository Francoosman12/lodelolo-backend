const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const multer = require("multer"); // ✅ Manejo de imágenes
const connectDB = require("./config/db"); 

// Cargar variables de entorno
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const FRONTEND_URL = process.env.FRONTEND_URL || "*"; 

// ✅ Middleware para procesar JSON y datos de formulario
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // ✅ Importante para `multipart/form-data`

// ✅ Configurar CORS
app.use(cors({ origin: FRONTEND_URL }));

// Conectar a MongoDB
connectDB();

// ✅ Configurar multer para procesar imágenes
const storage = multer.memoryStorage();
const upload = multer({ storage });

// ✅ Importar rutas
const authRoutes = require("./routes/authRoutes"); // ✅ Nueva ruta
const userRoutes = require("./routes/userRoutes");
const productRoutes = require("./routes/productRoutes");
const saleRoutes = require("./routes/saleRoutes");
const sucursalRoutes = require("./routes/sucursalRoutes");
const inventoryRoutes = require("./routes/inventoryRoutes");
const expenseRoutes = require("./routes/expenseRoutes");
const orderRoutes = require("./routes/orderRoutes");
const reportRoutes = require("./routes/reportRoutes");
const supplierRoutes = require("./routes/supplierRoutes");
const attributeRoutes = require("./routes/attributeRoutes");
const scheduleRoutes = require("./routes/schedulesRoutes"); // ✅ Nueva ruta para horarios
const rubricRoutes = require("./routes/rubricRoutes");

// ✅ Rutas
app.use("/api/auth", authRoutes); // ✅ Activar autenticación
app.use("/api/users", userRoutes);
app.use("/api/products", productRoutes);
app.use("/api/sales", saleRoutes);
app.use("/api/sucursales", sucursalRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/expenses", expenseRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/suppliers", supplierRoutes);
app.use("/api/attributes", attributeRoutes);
app.use("/api/schedules", scheduleRoutes); // ✅ Agregar ruta de horarios
app.use("/api/rubrics", rubricRoutes);

// ✅ Iniciar servidor
app.listen(PORT, () => {
  console.log(`✅ Servidor corriendo en http://localhost:${PORT}`);
});