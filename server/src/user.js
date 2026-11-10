import mongoose from 'mongoose';
import { z } from 'zod';

const userInputSchema = z.object({
  nome: z.string().trim().min(1, 'O nome é obrigatório.').max(100),
  email: z
    .string()
    .trim()
    .email('Introduza um endereço de email válido.')
    .max(254)
    .transform((email) => email.toLowerCase()),
});

export const createUserSchema = userInputSchema.extend({
  clientId: z.string().uuid('O identificador do utilizador é inválido.'),
});

export const updateUserSchema = userInputSchema;

const userSchema = new mongoose.Schema(
  {
    clientId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    nome: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
    criadoEm: { type: Date, required: true, default: Date.now },
  },
  { versionKey: false },
);

userSchema.index({ email: 1 }, { unique: true });

export const UserModel = mongoose.model('User', userSchema);

export function serializeUser(user) {
  return {
    id: user.clientId,
    nome: user.nome,
    email: user.email,
    criadoEm: user.criadoEm.toISOString(),
  };
}
