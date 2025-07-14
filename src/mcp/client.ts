import { MCPTool, MCPListToolsResponse, MCPInvokeToolResponse } from './types';
import { HTTPTransport } from './transport';
import { MCPTransport } from './types';

export class MCPClient {
  private transport: MCPTransport;

  /**
   * Construct with a transport (HTTP, SSE, Stdio, etc.)
   * If given a string, use HTTPTransport by default.
   */
  constructor(transportOrUrl: MCPTransport | string) {
    if (typeof transportOrUrl === 'string') {
      this.transport = new HTTPTransport(transportOrUrl);
    } else {
      this.transport = transportOrUrl;
    }
  }

  /**
   * List available tools from the MCP server.
   */
  async listTools(): Promise<MCPTool[]> {
    const req = { jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} };
    const data: { result: MCPListToolsResponse } = await this.transport.send(req);
    return data.result.tools;
  }

  /**
   * Call a tool on the MCP server.
   */
  async callTool(name: string, args: Record<string, any>): Promise<MCPInvokeToolResponse> {
    const req = {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: { name, arguments: args },
    };
    return (await this.transport.send(req)).result;
  }
} 