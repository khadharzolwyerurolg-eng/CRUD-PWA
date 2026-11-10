import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { listUsers } from './api';
import {
  getPendingCount,
  getUsers,
  reconcileUsers,
  saveDeletedUser,
  saveNewUser,
  saveUpdatedUser,
} from './database';
import { syncOutbox } from './sync';
import type { LocalUser, User, UserInput } from './types';

const emptyForm: UserInput = { nome: '', email: '' };

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('pt-PT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Ocorreu um erro inesperado.';
}

export default function App() {
  const [users, setUsers] = useState<LocalUser[]>([]);
  const [form, setForm] = useState<UserInput>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadLocalData = useCallback(async () => {
    const [localUsers, count] = await Promise.all([getUsers(), getPendingCount()]);
    setUsers(localUsers);
    setPendingCount(count);
  }, []);

  const refreshFromServer = useCallback(async () => {
    if (!navigator.onLine) return;
    const remoteUsers = await listUsers();
    await reconcileUsers(remoteUsers);
    await loadLocalData();
  }, [loadLocalData]);

  const synchronize = useCallback(async () => {
    if (!navigator.onLine) return;
    setIsSyncing(true);
    setError(null);
    try {
      await syncOutbox();
      await refreshFromServer();
    } catch (syncError) {
      setError(`A sincronização falhou: ${errorMessage(syncError)}`);
    } finally {
      await loadLocalData();
      setIsSyncing(false);
    }
  }, [loadLocalData, refreshFromServer]);

  useEffect(() => {
    let active = true;

    const initialize = async () => {
      try {
        await loadLocalData();
        if (navigator.onLine) {
          await syncOutbox();
          await refreshFromServer();
        }
      } catch (loadError) {
        if (active) {
          setError(
            navigator.onLine
              ? `Não foi possível atualizar os dados: ${errorMessage(loadError)}`
              : `Não foi possível abrir os dados locais: ${errorMessage(loadError)}`,
          );
        }
      } finally {
        if (active) setIsLoading(false);
      }
    };

    const handleOnline = () => {
      setIsOnline(true);
      void synchronize();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    void initialize();

    return () => {
      active = false;
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [loadLocalData, refreshFromServer, synchronize]);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const payload = {
      nome: form.nome.trim(),
      email: form.email.trim().toLowerCase(),
    };
    if (!payload.nome || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
      setError('Introduza um nome e um endereço de email válido.');
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      if (editingId) {
        const existing = users.find((user) => user.id === editingId);
        if (!existing) throw new Error('O utilizador selecionado já não existe.');
        await saveUpdatedUser({ ...existing, ...payload }, payload);
      } else {
        const user: User = {
          id: crypto.randomUUID(),
          ...payload,
          criadoEm: new Date().toISOString(),
        };
        await saveNewUser(user, payload);
      }
      resetForm();
      await loadLocalData();
      if (navigator.onLine) void synchronize();
    } catch (saveError) {
      setError(`Não foi possível guardar o utilizador: ${errorMessage(saveError)}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (user: LocalUser) => {
    setForm({ nome: user.nome, email: user.email });
    setEditingId(user.id);
    setError(null);
  };

  const handleDelete = async (user: LocalUser) => {
    if (!window.confirm(`Apagar o utilizador ${user.nome}?`)) return;
    setError(null);
    try {
      await saveDeletedUser(user.id);
      if (editingId === user.id) resetForm();
      await loadLocalData();
      if (navigator.onLine) void synchronize();
    } catch (deleteError) {
      setError(`Não foi possível apagar o utilizador: ${errorMessage(deleteError)}`);
    }
  };

  return (
    <main className="page-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Gestor de utilizadores">
          <span className="brand-mark" aria-hidden="true">u.</span>
          <span>pessoas<span className="brand-dot">.</span></span>
        </a>
        <div className={`connection-pill ${isOnline ? 'online' : 'offline'}`}>
          <span className="connection-dot" />
          {isOnline ? 'Ligado' : 'Offline'}
        </div>
      </header>

      <section className="intro">
        <p className="eyebrow">GESTÃO DE EQUIPA</p>
        <h1>As pessoas<br />em primeiro lugar.</h1>
        <p className="intro-copy">
          Uma lista simples, sempre disponível — com ou sem ligação.
        </p>
      </section>

      <section className="workspace" aria-label="Gestão de utilizadores">
        <div className="list-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">DIRETÓRIO</p>
              <h2>Utilizadores <span className="count">{users.length}</span></h2>
            </div>
            <button
              className="sync-button"
              type="button"
              onClick={() => void synchronize()}
              disabled={!isOnline || isSyncing}
              aria-label="Sincronizar agora"
              title={isOnline ? 'Sincronizar agora' : 'Disponível quando voltar a estar online'}
            >
              <span className={isSyncing ? 'sync-icon spinning' : 'sync-icon'} aria-hidden="true">↻</span>
              <span>{isSyncing ? 'A sincronizar' : 'Sincronizar'}</span>
            </button>
          </div>

          {pendingCount > 0 && (
            <div className="pending-banner" role="status">
              <span className="pending-icon" aria-hidden="true">◷</span>
              {pendingCount} {pendingCount === 1 ? 'alteração pendente' : 'alterações pendentes'}
              {!isOnline && <span> — será sincronizada quando voltar a estar online</span>}
            </div>
          )}

          {error && (
            <div className="error-banner" role="alert">
              <span>{error}</span>
              <button type="button" onClick={() => setError(null)} aria-label="Fechar aviso">×</button>
            </div>
          )}

          {isLoading ? (
            <div className="empty-state"><span className="loader" />A carregar utilizadores…</div>
          ) : users.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon" aria-hidden="true">◎</span>
              <strong>A lista ainda está vazia</strong>
              <span>Adicione o primeiro utilizador no formulário.</span>
            </div>
          ) : (
            <div className="user-list">
              {users.map((user) => (
                <article className="user-row" key={user.id}>
                  <div className="avatar" aria-hidden="true">{user.nome.trim().charAt(0).toUpperCase()}</div>
                  <div className="user-details">
                    <strong>{user.nome}</strong>
                    <span>{user.email}</span>
                  </div>
                  <div className="user-meta">
                    {user.syncStatus === 'pending' ? (
                      <span className="row-status pending-status">Pendente</span>
                    ) : (
                      <span className="row-date">{formatDate(user.criadoEm)}</span>
                    )}
                  </div>
                  <div className="row-actions">
                    <button type="button" onClick={() => handleEdit(user)} aria-label={`Editar ${user.nome}`} title="Editar">Editar</button>
                    <button className="delete-action" type="button" onClick={() => void handleDelete(user)} aria-label={`Apagar ${user.nome}`} title="Apagar">Apagar</button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        <aside className="form-panel">
          <div className="form-heading">
            <span className="form-icon" aria-hidden="true">{editingId ? '✎' : '+'}</span>
            <div>
              <p className="eyebrow">{editingId ? 'ATUALIZAÇÃO' : 'NOVO REGISTO'}</p>
              <h2>{editingId ? 'Editar utilizador' : 'Adicionar alguém'}</h2>
            </div>
          </div>
          <form onSubmit={handleSubmit}>
            <label htmlFor="nome">Nome</label>
            <input
              id="nome"
              name="nome"
              autoComplete="name"
              placeholder="Ex.: Joana Silva"
              value={form.nome}
              onChange={(event) => setForm({ ...form, nome: event.target.value })}
              maxLength={100}
              required
            />
            <label htmlFor="email">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="joana@empresa.pt"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              maxLength={254}
              required
            />
            <button className="submit-button" type="submit" disabled={isSaving}>
              {isSaving ? 'A guardar…' : editingId ? 'Guardar alterações' : 'Adicionar utilizador'}
              {!isSaving && <span aria-hidden="true">↗</span>}
            </button>
            {editingId && (
              <button className="cancel-button" type="button" onClick={resetForm}>
                Cancelar edição
              </button>
            )}
          </form>
          <div className="privacy-note">
            <span aria-hidden="true">⌁</span>
            As alterações ficam guardadas neste dispositivo e sincronizam automaticamente.
          </div>
        </aside>
      </section>

      <footer className="footer">
        <span>Feito para funcionar, mesmo quando a rede não funciona.</span>
        <span className="footer-sync">{pendingCount > 0 ? '● Alterações por sincronizar' : '✓ Tudo atualizado'}</span>
      </footer>
    </main>
  );
}
