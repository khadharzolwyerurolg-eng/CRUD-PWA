import { openDB, type DBSchema } from 'idb';
import type {
  LocalUser,
  PendingOperation,
  User,
  UserInput,
} from './types';

interface UsersDatabase extends DBSchema {
  users: {
    key: string;
    value: LocalUser;
  };
  outbox: {
    key: string;
    value: PendingOperation;
    indexes: { 'by-created-at': number };
  };
}

const databasePromise = openDB<UsersDatabase>('users-offline-first', 1, {
  upgrade(database) {
    database.createObjectStore('users', { keyPath: 'id' });
    const outbox = database.createObjectStore('outbox', { keyPath: 'id' });
    outbox.createIndex('by-created-at', 'createdAt');
  },
});

async function nextCreatedAt(
  getOperations: () => Promise<PendingOperation[]>,
): Promise<number> {
  const operations = await getOperations();
  const lastTimestamp = operations.at(-1)?.createdAt ?? 0;
  return Math.max(Date.now(), lastTimestamp + 1);
}

export async function getUsers(): Promise<LocalUser[]> {
  const database = await databasePromise;
  const users = await database.getAll('users');
  return users.sort((first, second) => first.nome.localeCompare(second.nome));
}

export async function getPendingCount(): Promise<number> {
  const database = await databasePromise;
  return database.count('outbox');
}

export async function getOutbox(): Promise<PendingOperation[]> {
  const database = await databasePromise;
  return database.getAllFromIndex('outbox', 'by-created-at');
}

export async function saveNewUser(
  user: User,
  payload: UserInput,
): Promise<void> {
  const database = await databasePromise;
  const transaction = database.transaction(['users', 'outbox'], 'readwrite');
  const createdAt = await nextCreatedAt(() =>
    transaction.objectStore('outbox').index('by-created-at').getAll(),
  );
  await transaction.objectStore('users').put({ ...user, syncStatus: 'pending' });
  await transaction.objectStore('outbox').put({
    id: crypto.randomUUID(),
    type: 'create',
    userId: user.id,
    payload,
    createdAt,
  });
  await transaction.done;
}

export async function saveUpdatedUser(
  user: LocalUser,
  payload: UserInput,
): Promise<void> {
  const database = await databasePromise;
  const transaction = database.transaction(['users', 'outbox'], 'readwrite');
  const createdAt = await nextCreatedAt(() =>
    transaction.objectStore('outbox').index('by-created-at').getAll(),
  );
  await transaction.objectStore('users').put({ ...user, syncStatus: 'pending' });
  await transaction.objectStore('outbox').put({
    id: crypto.randomUUID(),
    type: 'update',
    userId: user.id,
    payload,
    createdAt,
  });
  await transaction.done;
}

export async function saveDeletedUser(userId: string): Promise<void> {
  const database = await databasePromise;
  const transaction = database.transaction(['users', 'outbox'], 'readwrite');
  const createdAt = await nextCreatedAt(() =>
    transaction.objectStore('outbox').index('by-created-at').getAll(),
  );
  await transaction.objectStore('users').delete(userId);
  await transaction.objectStore('outbox').put({
    id: crypto.randomUUID(),
    type: 'delete',
    userId,
    createdAt,
  });
  await transaction.done;
}

export async function markOperationSynced(
  operation: PendingOperation,
): Promise<void> {
  const database = await databasePromise;
  const transaction = database.transaction(['users', 'outbox'], 'readwrite');
  await transaction.objectStore('outbox').delete(operation.id);

  const remaining = await transaction.objectStore('outbox').getAll();
  const stillPending = remaining.some((item) => item.userId === operation.userId);
  if (!stillPending && operation.type !== 'delete') {
    const user = await transaction.objectStore('users').get(operation.userId);
    if (user) {
      await transaction.objectStore('users').put({
        ...user,
        syncStatus: 'synced',
      });
    }
  }

  await transaction.done;
}

export async function reconcileUsers(remoteUsers: User[]): Promise<void> {
  const database = await databasePromise;
  const transaction = database.transaction(['users', 'outbox'], 'readwrite');
  const userStore = transaction.objectStore('users');
  const operations = await transaction.objectStore('outbox').getAll();
  const pendingIds = new Set(operations.map((operation) => operation.userId));
  const pendingDeletes = new Set(
    operations
      .filter((operation) => operation.type === 'delete')
      .map((operation) => operation.userId),
  );
  const currentUsers = await userStore.getAll();
  const locallyPending = currentUsers.filter((user) => pendingIds.has(user.id));

  await userStore.clear();
  for (const user of remoteUsers) {
    if (!pendingIds.has(user.id) && !pendingDeletes.has(user.id)) {
      await userStore.put({ ...user, syncStatus: 'synced' });
    }
  }
  for (const user of locallyPending) {
    if (!pendingDeletes.has(user.id)) {
      await userStore.put({ ...user, syncStatus: 'pending' });
    }
  }

  await transaction.done;
}
