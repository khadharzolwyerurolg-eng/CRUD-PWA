import cors from 'cors';
import express from 'express';
import { ZodError } from 'zod';
import {
  createUserSchema,
  serializeUser,
  updateUserSchema,
  UserModel,
} from './user.js';

export function createApp({ frontendOrigin = 'http://localhost:5173' } = {}) {
  const app = express();

  app.use(
    cors({
      origin: frontendOrigin.split(',').map((origin) => origin.trim()),
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      allowedHeaders: ['Content-Type'],
    }),
  );
  app.use(express.json({ limit: '16kb' }));

  app.get('/api/health', (_request, response) => {
    response.json({ status: 'ok' });
  });

  app.get('/api/usuarios', async (_request, response, next) => {
    try {
      const users = await UserModel.find().sort({ nome: 1 }).lean();
      response.json(users.map(serializeUser));
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/usuarios', async (request, response, next) => {
    try {
      const input = createUserSchema.parse(request.body);
      const user = await UserModel.findOneAndUpdate(
        { clientId: input.clientId },
        {
          $setOnInsert: {
            clientId: input.clientId,
            nome: input.nome,
            email: input.email,
          },
        },
        { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
      ).lean();
      response.status(201).json(serializeUser(user));
    } catch (error) {
      next(error);
    }
  });

  app.put('/api/usuarios/:id', async (request, response, next) => {
    try {
      const input = updateUserSchema.parse(request.body);
      const user = await UserModel.findOneAndUpdate(
        { clientId: request.params.id },
        { $set: input },
        { new: true, runValidators: true },
      ).lean();
      if (!user) {
        response.status(404).json({ error: 'Utilizador não encontrado.' });
        return;
      }
      response.json(serializeUser(user));
    } catch (error) {
      next(error);
    }
  });

  app.delete('/api/usuarios/:id', async (request, response, next) => {
    try {
      await UserModel.findOneAndDelete({ clientId: request.params.id });
      response.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  app.use((error, _request, response, _next) => {
    if (error instanceof ZodError) {
      response.status(400).json({
        error: error.issues[0]?.message ?? 'Os dados enviados são inválidos.',
      });
      return;
    }
    if (error?.code === 11000) {
      response.status(409).json({ error: 'Já existe um utilizador com este email.' });
      return;
    }
    if (error instanceof SyntaxError && 'body' in error) {
      response.status(400).json({ error: 'O corpo do pedido não contém JSON válido.' });
      return;
    }
    console.error('Erro ao processar o pedido:', error);
    response.status(500).json({ error: 'Ocorreu um erro interno no servidor.' });
  });

  return app;
}
