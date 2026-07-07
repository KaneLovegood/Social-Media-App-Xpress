import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

@Injectable()
export class McpClientService implements OnModuleInit, OnModuleDestroy {
  private client!: Client;
  private transport: StdioClientTransport | SSEClientTransport | null = null;
  private readonly logger = new Logger(McpClientService.name);

  constructor() {
    this.initializeClientInstance();
  }

  private initializeClientInstance() {
    this.client = new Client(
      { name: 'nestjs-mcp-client', version: '1.0.0' },
      { capabilities: {} },
    );
  }

  private async disconnect() {
    if (this.transport) {
      try {
        await this.transport.close();
      } catch (error) {
        this.logger.error('Error closing transport', error);
      } finally {
        this.transport = null;
      }
    }
  }

  private async connectToServer() {
    // 1. Clear old transport connection
    await this.disconnect();

    // 2. Re-create the Client instance to clear all internal state / handshakes
    this.initializeClientInstance();

    const transportType = process.env.MCP_TRANSPORT || 'stdio';

    if (transportType === 'sse') {
      const serverUrl = process.env.MCP_SERVER_URL;
      if (!serverUrl) {
        this.logger.warn(
          'MCP_SERVER_URL is not set in .env while MCP_TRANSPORT is set to sse.',
        );
        return;
      }

      this.logger.log(`Connecting to remote MCP Server via SSE: ${serverUrl}`);
      this.transport = new SSEClientTransport(new URL(serverUrl));
      await this.client.connect(this.transport);
      this.logger.log('Successfully connected to remote MCP Server via SSE!');
    } else {
      // Default: stdio
      const serverPath = process.env.MCP_SERVER_PATH;
      if (!serverPath) {
        this.logger.warn(
          'MCP_SERVER_PATH is not set in .env. MCP Service will not start automatically.',
        );
        return;
      }

      this.logger.log(`Starting local MCP Server via Stdio: ${serverPath}`);
      const childEnv = { ...process.env } as Record<string, string>;
      delete childEnv.PORT;
      this.transport = new StdioClientTransport({
        command: 'node',
        args: [serverPath],
        env: childEnv,
      });

      await this.client.connect(this.transport);
      this.logger.log('Successfully connected to local MCP Server via Stdio!');
    }
  }

  async onModuleInit() {
    try {
      await this.connectToServer();
    } catch (error) {
      this.logger.error('Failed initial connection to MCP Server', error);
    }
  }

  async onModuleDestroy() {
    await this.disconnect();
  }

  async listTools() {
    try {
      return await this.client.listTools();
    } catch (error) {
      this.logger.warn(
        'listTools failed. Attempting to reconnect MCP client...',
        error,
      );
      try {
        await this.connectToServer();
        return await this.client.listTools();
      } catch (retryError) {
        this.logger.error(
          'listTools failed after reconnection attempt',
          retryError,
        );
        throw error;
      }
    }
  }

  async callTool(name: string, args: Record<string, unknown>) {
    try {
      return await this.client.callTool({ name, arguments: args }, undefined, {
        timeout: 180000,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      if (
        errorMessage.includes('Session not found') ||
        errorMessage.includes('Connection closed') ||
        errorMessage.includes('Failed to fetch') ||
        errorMessage.includes('HTTP') ||
        errorMessage.includes('transport')
      ) {
        this.logger.warn(
          `callTool failed with connection error: ${errorMessage}. Attempting to reconnect MCP client...`,
        );
        try {
          await this.connectToServer();
          return await this.client.callTool(
            { name, arguments: args },
            undefined,
            { timeout: 180000 },
          );
        } catch (retryError) {
          this.logger.error(
            'callTool failed after reconnection attempt',
            retryError,
          );
          throw error;
        }
      }
      throw error;
    }
  }
}
