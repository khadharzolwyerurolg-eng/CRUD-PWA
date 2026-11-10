import 'dotenv/config';
import mongoose from 'mongoose';
import { createApp } from './app.js';

const port = Number(process.env.PORT ?? 3001);
const mongoUri =
  process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/users_offline_first';

await mongoose.connect(mongoUri);
const server = createApp({
  frontendOrigin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:5174',
}).listen(port, () => {
  console.log(`API disponível em http://localhost:${port}`);
});

async function shutdown(signal) {
  console.log(`${signal} recebido; a encerrar a API.`);
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  await mongoose.disconnect();
}

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));
