import { Module } from '@nestjs/common';
import { McpService } from './services/mcp.service';
import { McpClientService } from './services/mcp-client.service';
import { McpHistoryService } from './services/mcp-history.service';
import { McpController } from './mcp.controller';
import { ChatModule } from '../chat/chat.module';

@Module({
  imports: [ChatModule],
  controllers: [McpController],
  providers: [McpClientService, McpHistoryService, McpService],
  exports: [McpService],
})
export class McpModule {}
