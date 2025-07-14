export interface MCPTool {
  name: string;
  description: string;
  inputSchema: any; // JSON Schema
}

export interface MCPListToolsResponse {
  tools: MCPTool[];
}

export interface MCPInvokeToolResponse {
  content: any;
  error?: string;
} 

// MCP transport interface for pluggable transports (HTTP, SSE, Stdio, etc.)
export interface MCPTransport {
  send(request: any): Promise<any>;
} 