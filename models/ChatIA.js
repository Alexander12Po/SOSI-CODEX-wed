import mongoose from 'mongoose';

const chatIASchema = new mongoose.Schema({
  jid: { type: String, required: true, unique: true },
  activo: { type: Boolean, default: false },
  historial: [
    {
      role: { type: String, enum: ['user', 'assistant'], required: true },
      content: { type: String, required: true }
    }
  ]
});

export default mongoose.model('ChatIA', chatIASchema);
