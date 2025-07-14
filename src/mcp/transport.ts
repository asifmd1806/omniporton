import { MCPTransport } from './types';

/**
 * HTTP Transport for MCP (POST JSON-RPC requests)
 */
export class HTTPTransport implements MCPTransport {
  constructor(private baseUrl: string) {}
  async send(request: any): Promise<any> {
    const resp = await fetch(this.baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
    return await resp.json();
  }
}

/**
 * SSE Transport for MCP (Server-Sent Events, streaming)
 * Uses EventSource for streaming responses. Only resolves with the first message (basic implementation).
 */
export class SSETransport implements MCPTransport {
  constructor(private baseUrl: string) {}
  async send(request: any): Promise<any> {
    // Send the request as POST, then listen for SSE events
    const resp = await fetch(this.baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
    if (!resp.body) throw new Error('No response body for SSE');
    const reader = resp.body.getReader();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += new TextDecoder().decode(value);
      // SSE events are separated by double newlines
      const events = buffer.split('\n\n');
      for (const event of events) {
        if (event.startsWith('data:')) {
          const data = event.replace(/^data:/, '').trim();
          try {
            return JSON.parse(data);
          } catch {}
        }
      }
    }
    throw new Error('No SSE event received');
  }
}

/**
 * Stdio Transport for MCP (local subprocess)
 * Spawns a child process, writes request to stdin, reads response from stdout.
 * Supports custom env, shell, and cwd options for robust cross-platform use.
 * Usage:
 *   new StdioTransport('python3', ['./mcp_server.py'], { env: { ... }, shell: false, cwd: '/path' })
 */
export class StdioTransport implements MCPTransport {
  private child: any;
  constructor(
    private command: string,
    private args: string[] = [],
    private options: {
      env?: NodeJS.ProcessEnv;
      shell?: boolean;
      cwd?: string;
    } = {}
  ) {}
  async send(request: any): Promise<any> {
    const { spawn } = await import('child_process');
    return new Promise((resolve, reject) => {
      const child = spawn(this.command, this.args, {
        stdio: ['pipe', 'pipe', 'inherit'],
        env: { ...process.env, ...this.options.env },
        shell: this.options.shell ?? false,
        cwd: this.options.cwd,
      });
      let output = '';
      child.stdout.on('data', (data: Buffer) => {
        output += data.toString();
        // Try to parse as soon as we get a complete JSON object
        try {
          const parsed = JSON.parse(output);
          resolve(parsed);
          child.kill();
        } catch {}
      });
      child.on('error', reject);
      child.stdin.write(JSON.stringify(request) + '\n');
      child.stdin.end();
    });
  }
} 