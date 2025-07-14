import type { ChatMessage } from '../chat/types';

export interface SessionStorage {
  saveSession(sessionId: string, data: SessionData): Promise<void>;
  loadSession(sessionId: string): Promise<SessionData | null>;
  deleteSession(sessionId: string): Promise<void>;
  listSessions(): Promise<string[]>;
  cleanup(olderThan: Date): Promise<number>;
}

export interface SessionData {
  id: string;
  agentId?: string;
  history: ChatMessage[];
  metadata: {
    createdAt: Date;
    updatedAt: Date;
    provider: string;
    model?: string;
    messageCount: number;
  };
  options?: Record<string, any>;
}

export class MemorySessionStorage implements SessionStorage {
  private sessions = new Map<string, SessionData>();

  async saveSession(sessionId: string, data: SessionData): Promise<void> {
    this.sessions.set(sessionId, {
      ...data,
      metadata: {
        ...data.metadata,
        updatedAt: new Date()
      }
    });
  }

  async loadSession(sessionId: string): Promise<SessionData | null> {
    return this.sessions.get(sessionId) || null;
  }

  async deleteSession(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
  }

  async listSessions(): Promise<string[]> {
    return Array.from(this.sessions.keys());
  }

  async cleanup(olderThan: Date): Promise<number> {
    let deletedCount = 0;
    for (const [sessionId, data] of this.sessions.entries()) {
      if (data.metadata.updatedAt < olderThan) {
        this.sessions.delete(sessionId);
        deletedCount++;
      }
    }
    return deletedCount;
  }

  getSize(): number {
    return this.sessions.size;
  }

  clear(): void {
    this.sessions.clear();
  }
}

export class FileSessionStorage implements SessionStorage {
  constructor(private basePath: string = './sessions') {}

  async saveSession(sessionId: string, data: SessionData): Promise<void> {
    // File storage implementation would go here
    // For now, we'll just log that it's not implemented
    console.warn('FileSessionStorage not fully implemented yet');
  }

  async loadSession(sessionId: string): Promise<SessionData | null> {
    console.warn('FileSessionStorage not fully implemented yet');
    return null;
  }

  async deleteSession(sessionId: string): Promise<void> {
    console.warn('FileSessionStorage not fully implemented yet');
  }

  async listSessions(): Promise<string[]> {
    console.warn('FileSessionStorage not fully implemented yet');
    return [];
  }

  async cleanup(olderThan: Date): Promise<number> {
    console.warn('FileSessionStorage not fully implemented yet');
    return 0;
  }
}

export class DatabaseSessionStorage implements SessionStorage {
  constructor(private connectionString: string) {}

  async saveSession(sessionId: string, data: SessionData): Promise<void> {
    // Database storage implementation would go here
    console.warn('DatabaseSessionStorage not fully implemented yet');
  }

  async loadSession(sessionId: string): Promise<SessionData | null> {
    console.warn('DatabaseSessionStorage not fully implemented yet');
    return null;
  }

  async deleteSession(sessionId: string): Promise<void> {
    console.warn('DatabaseSessionStorage not fully implemented yet');
  }

  async listSessions(): Promise<string[]> {
    console.warn('DatabaseSessionStorage not fully implemented yet');
    return [];
  }

  async cleanup(olderThan: Date): Promise<number> {
    console.warn('DatabaseSessionStorage not fully implemented yet');
    return 0;
  }
}