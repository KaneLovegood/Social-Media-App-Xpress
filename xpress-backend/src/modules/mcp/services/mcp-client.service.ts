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
  private client: Client;
  private transport: StdioClientTransport | SSEClientTransport | null = null;
  private readonly logger = new Logger(McpClientService.name);

  constructor() {
    this.client = new Client(
      { name: 'nestjs-mcp-client', version: '1.0.0' },
      { capabilities: {} },
    );
  }

  async onModuleInit() {
    const transportType = process.env.MCP_TRANSPORT || 'stdio';

    if (transportType === 'sse') {
      const serverUrl = process.env.MCP_SERVER_URL;
      if (!serverUrl) {
        this.logger.warn(
          'MCP_SERVER_URL is not set in .env while MCP_TRANSPORT is set to sse.',
        );
        return;
      }

      try {
        this.logger.log(
          `Connecting to remote MCP Server via SSE: ${serverUrl}`,
        );
        this.transport = new SSEClientTransport(new URL(serverUrl));
        await this.client.connect(this.transport);
        this.logger.log('Successfully connected to remote MCP Server via SSE!');
      } catch (error) {
        this.logger.error(
          'Failed to connect to remote MCP Server via SSE',
          error,
        );
      }
    } else {
      // Default: stdio
      const serverPath = process.env.MCP_SERVER_PATH;
      if (!serverPath) {
        this.logger.warn(
          'MCP_SERVER_PATH is not set in .env. MCP Service will not start automatically.',
        );
        return;
      }

      try {
        this.logger.log(`Starting local MCP Server via Stdio: ${serverPath}`);
        this.transport = new StdioClientTransport({
          command: 'node',
          args: [serverPath],
          env: process.env as Record<string, string>,
        });

        await this.client.connect(this.transport);
        this.logger.log(
          'Successfully connected to local MCP Server via Stdio!',
        );
      } catch (error) {
        this.logger.error(
          'Failed to connect to local MCP Server via Stdio',
          error,
        );
      }
    }
  }

  async onModuleDestroy() {
    if (this.transport) {
      try {
        await this.transport.close();
      } catch (error) {
        this.logger.error('Error closing transport', error);
      }
    }
  }

  async listTools() {
    return this.client.listTools();
  }

  async callTool(name: string, args: Record<string, unknown>) {
    return this.client.callTool({ name, arguments: args }, undefined, {
      timeout: 180000,
    });
  }
}
