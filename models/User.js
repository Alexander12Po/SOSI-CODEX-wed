import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
    numero: { type: String, required: true, unique: true },
    nombre: { type: String, required: true, unique: true, trim: true }, // ✅ unique: true para evitar duplicados
    password: String,
    creditos: { type: Number, default: 0 },
    fecha: String,
});

export default mongoose.model('User', userSchema);
