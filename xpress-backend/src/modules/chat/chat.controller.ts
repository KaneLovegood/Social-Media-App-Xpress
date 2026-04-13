import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { ChatActionDto } from './dto/chat-action.dto';
import { ChatService } from './chat.service';

interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    phone: string;
    role: string;
  };
}

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @UseGuards(AuthGuard('jwt'))
  @Get('rooms')
  async getRooms(@Req() request: AuthenticatedRequest): Promise<unknown> {
    const actorUserId = request.user?.userId;
    if (!actorUserId) {
      throw new UnauthorizedException('Unauthorized');
    }

    return await this.chatService.getChatRoomsForUser(actorUserId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('actions')
  postAction(
    @Req() request: AuthenticatedRequest,
    @Body() dto: ChatActionDto,
  ): unknown {
    const actorUserId = request.user?.userId;
    if (!actorUserId) {
      throw new UnauthorizedException('Unauthorized');
    }

    return this.chatService.handleAction(actorUserId, dto);
  }
}
