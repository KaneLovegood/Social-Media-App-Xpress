import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

@Injectable()
export class McpClientService implements OnModuleInit, OnModuleDestroy {
  private client: Client;
  private transport: StdioClientTransport | null = null;
  private readonly logger = new Logger(McpClientService.name);

  constructor() {
    this.client = new Client(
      { name: 'nestjs-mcp-client', version: '1.0.0' },
      { capabilities: {} },
    );
  }

  async onModuleInit() {
    const serverPath = process.env.MCP_SERVER_PATH;
    if (!serverPath) {
      this.logger.warn(
        'MCP_SERVER_PATH is not set in .env. MCP Service will not start automatically.',
      );
      return;
    }

    try {
      this.transport = new StdioClientTransport({
        command: 'node',
        args: [serverPath],
        env: process.env as Record<string, string>,
      });

      await this.client.connect(this.transport);
      this.logger.log('Successfully connected to MCP Server!');
    } catch (error) {
      this.logger.error('Failed to connect to MCP Server', error);
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
    return this.client.callTool({ name, arguments: args });
  }
}
