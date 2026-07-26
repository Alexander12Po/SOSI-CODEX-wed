import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  numero: { type: String, required: true, unique: true },
  nombre: String,
  password: String,
  creditos: { type: Number, default: 0 },
  fecha: String,
});

export default mongoose.model('User', userSchema);
