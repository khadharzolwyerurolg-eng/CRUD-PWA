import { createUser, deleteUser, updateUser } from './api';
import { getOutbox, markOperationSynced } from './database';

let activeSync: Promise<void> | null = null;

export function syncOutbox(): Promise<void> {
  if (!navigator.onLine) return Promise.resolve();
  if (activeSync) return activeSync;

  activeSync = processOutbox().finally(() => {
    activeSync = null;
  });
  return activeSync;
}

async function processOutbox(): Promise<void> {
  while (navigator.onLine) {
    const [operation] = await getOutbox();
    if (!operation) return;

    switch (operation.type) {
      case 'create':
        await createUser(operation.userId, operation.payload);
        break;
      case 'update':
        await updateUser(operation.userId, operation.payload);
        break;
      case 'delete':
        await deleteUser(operation.userId);
        break;
    }

    await markOperationSynced(operation);
  }
}
