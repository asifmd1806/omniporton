/**
 * Omniporton: Universal AI Particle Engine - High-level library for local and cloud LLMs.
 *
 * @module omniporton
 */

export * as Model from "./model";
export * as Chat from "./chat";
export * as Template from "./template";
export * as Session from "./session";
export * as Agent from "./agent";
export * as Provider from "./provider";
export * as Extractor from "./extractor";
export * as MCP from "./mcp";
export * as Monitoring from "./monitoring";
export * as Utils from "./utils";

// Main factory functions
export { createChatSession, createMonitoredChatSession, createMonitoringService, createMemoryStorage, createFileStorage, createDatabaseStorage } from "./session/factory";
export { createAgent } from "./agent/factory";

// Core classes
export { ChatSession } from "./session/ChatSession";
export { MonitoredAgent } from "./agent/MonitoredAgent";
export { MonitoringService } from "./monitoring/MonitoringService";
export { MCPService } from "./mcp/MCPService";

// Types
export type { 
  RequestMetrics, 
  AgentMetrics, 
  SessionMetrics, 
  MonitoringConfig,
  AlertRule,
  MonitoringDashboard 
} from "./monitoring/types";

export type { ChatMessage, MessageContent } from "./chat/types";
export type { ChatSessionOptions } from "./session/ChatSession";
export type { Template as TemplateType } from "./template/types";

// Utility functions
export { 
  extractText, 
  createImageFromUrl, 
  createDocumentFromData, 
  createMultiModalContent,
  isMultiModal 
} from "./utils/media";