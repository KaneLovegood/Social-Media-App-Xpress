import { Module } from '@nestjs/common';
import { McpService } from './services/mcp.service';
import { McpClientService } from './services/mcp-client.service';
import { McpHistoryService } from './services/mcp-history.service';
import { McpLlmService } from './services/mcp-llm.service';
import { McpPromptService } from './services/mcp-prompt.service';
import { McpController } from './mcp.controller';
import { ChatModule } from '../chat/chat.module';

@Module({
  imports: [ChatModule],
  controllers: [McpController],
  providers: [
    McpClientService,
    McpHistoryService,
    McpLlmService,
    McpPromptService,
    McpService,
  ],
  exports: [McpService],
})
export class McpModule {}
