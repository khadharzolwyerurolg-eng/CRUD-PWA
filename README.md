# Gestor de utilizadores offline-first

Aplicação CRUD de utilizadores com React, API Express/MongoDB, PWA e sincronização offline através de IndexedDB.

## Requisitos

- Node.js 20 ou superior
- MongoDB acessível pela URI configurada em `MONGODB_URI`

## Configuração e execução

1. Instale as dependências na raiz:

   ```sh
   npm install
   ```

2. Inicie o MongoDB local. Por predefinição, a API liga-se a `mongodb://127.0.0.1:27017/users_offline_first`.
3. (Opcional) Copie `server/.env.example` para `server/.env` se quiser alterar a URI, porta ou origem CORS.
4. Inicie a API e o frontend:

   ```sh
   npm run dev
   ```

   A interface fica disponível em `http://localhost:5173` e a API em `http://localhost:3001`. Para iniciar os serviços separadamente, use `npm run dev --workspace server` e `npm run dev --workspace client`.

## Funcionalidades

- `POST`, `GET`, `PUT` e `DELETE` em `/api/usuarios`, com validação, email único e CORS configurável.
- A aplicação grava alterações em IndexedDB antes de tentar sincronizar; assim, criar, editar e apagar continuam disponíveis offline.
- A fila é processada por ordem e usa identificadores estáveis, tornando os pedidos repetidos seguros quando a ligação cai durante uma operação.
- Ao abrir, a lista local aparece primeiro; a resposta da API atualiza os dados sincronizados sem descartar alterações pendentes.
- O service worker precacheia os recursos da interface. A aplicação instalada abre sem rede e mostra os dados guardados neste dispositivo.

## Configuração

- `MONGODB_URI`: URI de ligação ao MongoDB (predefinição `mongodb://127.0.0.1:27017/users_offline_first`).
- `PORT`: porta da API (predefinição `3001`).
- `FRONTEND_ORIGIN`: origem ou lista de origens separadas por vírgula permitidas pelo CORS (predefinição `http://localhost:5173`).
- `VITE_API_URL`: URL base da API no frontend (predefinição `http://localhost:3001/api`).

Quando precisar de alterar `VITE_API_URL`, defina-a em `client/.env` antes de iniciar ou compilar o frontend.

## Verificação

```sh
npm test
npm run build
```
