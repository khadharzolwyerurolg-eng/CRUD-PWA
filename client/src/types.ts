export interface User {
  id: string;
  nome: string;
  email: string;
  criadoEm: string;
}

export interface UserInput {
  nome: string;
  email: string;
}

export interface LocalUser extends User {
  syncStatus: 'synced' | 'pending';
}

export type PendingOperation =
  | {
      id: string;
      type: 'create';
      userId: string;
      payload: UserInput;
      createdAt: number;
    }
  | {
      id: string;
      type: 'update';
      userId: string;
      payload: UserInput;
      createdAt: number;
    }
  | {
      id: string;
      type: 'delete';
      userId: string;
      createdAt: number;
    };
