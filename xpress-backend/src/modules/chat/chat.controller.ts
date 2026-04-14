import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { PresenceService } from '../../common/presence/presence.service';
import { UsersRepository } from '../auth/repositories/users.repository';
import { ChatActionDto } from './dto/chat-action.dto';
import { ChatGateway } from './chat.gateway';
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
  constructor(
    private readonly chatService: ChatService,
    private readonly chatGateway: ChatGateway,
    private readonly usersRepository: UsersRepository,
    private readonly presenceService: PresenceService,
  ) {}

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
  @Get('rooms/:roomId/messages')
  async getRoomMessages(
    @Req() request: AuthenticatedRequest,
    @Param('roomId') roomId: string,
  ): Promise<unknown> {
    const actorUserId = request.user?.userId;
    if (!actorUserId) {
      throw new UnauthorizedException('Unauthorized');
    }

    return await this.chatService.getMessagesForRoom(actorUserId, roomId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('actions')
  async postAction(
    @Req() request: AuthenticatedRequest,
    @Body() dto: ChatActionDto,
  ): Promise<unknown> {
    const actorUserId = request.user?.userId;
    if (!actorUserId) {
      throw new UnauthorizedException('Unauthorized');
    }

    const result = await this.chatService.handleAction(actorUserId, dto);

    // Broadcast incoming call notification if action is voice/video call
    if (dto.action === 'open_voice_call' || dto.action === 'open_video_call') {
      const caller = await this.usersRepository.findByUserId(actorUserId);
      const callerPresence = this.presenceService.getPresence(actorUserId);
      if (caller) {
        const sessionId = typeof result.data === 'object' && result.data !== null && 'sessionId' in result.data
          ? (result.data.sessionId as string)
          : '';
        this.chatGateway.broadcastIncomingCall(dto.peerUserId, {
          senderId: actorUserId,
          senderName: caller.name,
          callMode: dto.action === 'open_voice_call' ? 'voice' : 'video',
          sessionId,
          isOnline: callerPresence.isOnline,
        });
      }
    }

    if (result.callSummaryMessage) {
      this.chatGateway.broadcastChatMessage(result.callSummaryMessage);
    }

    return result;
  }
}
