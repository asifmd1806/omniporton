import { MCPClient } from './client';
import { MCPTransport } from './types';
import { zodFromJsonSchema } from '../utils';
import type { ToolDefinition } from '../tools/types';

export class MCPService {
  private tools: Map<string, ToolDefinition> = new Map();
  private mcpClients: Map<string, MCPClient> = new Map();

  constructor() {}

  /**
   * Register a local tool directly
   */
  registerTool(tool: ToolDefinition): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool '${tool.name}' already registered.`);
    }
    this.tools.set(tool.name, tool);
  }

  /**
   * Initialize MCP tools from a single MCP server
   */
  async initializeMcpTools(serverKey: string, mcp: string | MCPTransport): Promise<void> {
    const client = new MCPClient(mcp);
    this.mcpClients.set(serverKey, client);
    
    const tools = await client.listTools();
    for (const tool of tools) {
      this.registerTool({
        name: tool.name,
        description: tool.description,
        schema: zodFromJsonSchema(tool.inputSchema),
        handler: (args: any) => client.callTool(tool.name, args),
      });
    }
  }

  /**
   * Initialize MCP tools from multiple MCP servers with prefixed names
   */
  async initializeAllMcpTools(
    servers: { label: string; mcp: string | MCPTransport }[],
  ): Promise<void> {
    for (const { label, mcp } of servers) {
      const client = new MCPClient(mcp);
      this.mcpClients.set(label, client);
      
      const tools = await client.listTools();
      for (const tool of tools) {
        this.registerTool({
          name: `${label}.${tool.name}`,
          description: tool.description,
          schema: zodFromJsonSchema(tool.inputSchema),
          handler: (args: any) => client.callTool(tool.name, args),
        });
      }
    }
  }

  /**
   * Get a tool by name
   */
  getTool(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  /**
   * List all available tools
   */
  listTools(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  /**
   * Execute a tool call
   */
  async executeTool(name: string, args: any): Promise<any> {
    const tool = this.getTool(name);
    if (!tool) {
      throw new Error(`Tool '${name}' not found`);
    }

    // Validate arguments using zod
    const parsedArgs = tool.schema.parse(args);
    return await tool.handler(parsedArgs);
  }

  /**
   * Check if a tool exists
   */
  hasTool(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Remove a tool
   */
  removeTool(name: string): boolean {
    return this.tools.delete(name);
  }

  /**
   * Clear all tools
   */
  clear(): void {
    this.tools.clear();
  }

  /**
   * Get number of registered tools
   */
  size(): number {
    return this.tools.size;
  }
}