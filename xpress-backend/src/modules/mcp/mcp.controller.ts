import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Req,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { McpService } from './services/mcp.service';
import { McpChatDto } from './dto/mcp-chat.dto';

interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    username: string;
  };
}

@Controller('mcp')
@UseGuards(AuthGuard('jwt'))
export class McpController {
  constructor(private readonly mcpService: McpService) {}

  @Post('chat')
  @HttpCode(HttpStatus.OK)
  async chat(@Req() req: AuthenticatedRequest, @Body() mcpChatDto: McpChatDto) {
    const userId = req.user?.userId;
    console.log(`\n========================================`);
    console.log(`[🚀 FRONTEND REQUEST] Nhận request tới /mcp/chat`);
    console.log(`User ID: "${userId}"`);
    console.log(`Message: "${mcpChatDto.message}"`);
    if (mcpChatDto.fileUrl) {
      console.log(`File URL: "${mcpChatDto.fileUrl}"`);
    }
    console.log(`========================================\n`);

    const result = await this.mcpService.chatWithMcp(
      userId,
      mcpChatDto.message,
      mcpChatDto.fileUrl,
    );

    console.log(`\n========================================`);
    console.log(`[✅ RESPONSE TO FRONTEND] Trả kết quả về cho frontend`);
    console.log(`Response: `, result);
    console.log(`========================================\n`);

    return result;
  }

  @Get('chat/history')
  @HttpCode(HttpStatus.OK)
  async getHistory(@Req() req: AuthenticatedRequest) {
    const userId = req.user?.userId;
    if (!userId) {
      return [];
    }
    return this.mcpService.getHistory(userId);
  }
}
