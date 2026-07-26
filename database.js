import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

export async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado a MongoDB');
  } catch (err) {
    console.error('❌ Error al conectar a MongoDB:', err.message);
    console.error('⚠️ El bot va a seguir intentando conectar en segundo plano...');
  }

  // --- Blindaje: reaccionar a caídas de conexión sin tumbar el proceso ---
  mongoose.connection.on('error', (err) => {
    console.error('⚠️ Error en la conexión de MongoDB:', err.message);
  });

  mongoose.connection.on('disconnected', () => {
    console.log('⚠️ MongoDB desconectado. Intentando reconectar...');
    setTimeout(() => {
      mongoose.connect(process.env.MONGODB_URI).catch((err) => {
        console.error('❌ Falló el intento de reconexión a MongoDB:', err.message);
      });
    }, 5000); // reintenta cada 5 segundos
  });

  mongoose.connection.on('reconnected', () => {
    console.log('✅ MongoDB reconectado correctamente');
  });
}
