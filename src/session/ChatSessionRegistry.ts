import { ChatSession } from './ChatSession';
import type { LLMProvider } from '../provider';
import type { MessageExtractor } from '../extractor';
import type { Template } from '../template/types';

export class ChatSessionRegistry {
  private sessions = new Map<string, ChatSession>();

  createSession(
    id: string,
    provider: LLMProvider,
    extractor: MessageExtractor,
    template: Template,
    mcpService?: any
  ): ChatSession {
    if (this.sessions.has(id)) {
      throw new Error(`Session with id '${id}' already exists`);
    }

    const session = new ChatSession(id, provider, extractor, template, mcpService);
    this.sessions.set(id, session);
    return session;
  }

  getSession(id: string): ChatSession | undefined {
    return this.sessions.get(id);
  }

  hasSession(id: string): boolean {
    return this.sessions.has(id);
  }

  removeSession(id: string): boolean {
    return this.sessions.delete(id);
  }

  listSessions(): string[] {
    return Array.from(this.sessions.keys());
  }

  getAllSessions(): ChatSession[] {
    return Array.from(this.sessions.values());
  }

  clear(): void {
    this.sessions.clear();
  }

  size(): number {
    return this.sessions.size;
  }
}