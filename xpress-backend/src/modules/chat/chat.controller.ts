import {
  Body,
  Controller,
  Delete,
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
import { CreateGroupDto } from './dto/create-group.dto';
import { ChatActionDto } from './dto/chat-action.dto';
import { GroupMemberDto } from './dto/group-member.dto';
import { SendGroupMessageDto } from './dto/send-group-message.dto';
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
  @Post('groups')
  async createGroup(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateGroupDto,
  ): Promise<unknown> {
    const actorUserId = request.user?.userId;
    if (!actorUserId) {
      throw new UnauthorizedException('Unauthorized');
    }

    const result = await this.chatService.createGroupRoom(actorUserId, dto);
    const targetUserIds = Array.from(
      new Set([actorUserId, ...(dto.memberUserIds ?? [])]),
    );

    for (const userId of targetUserIds) {
      this.chatGateway.subscribeUserToGroupRoom(userId, result.roomId);
    }

    this.chatGateway.broadcastGroupRoomUpdateToUsers(targetUserIds, result);
    return result;
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('groups/:roomId')
  async getGroupDetails(
    @Req() request: AuthenticatedRequest,
    @Param('roomId') roomId: string,
  ): Promise<unknown> {
    const actorUserId = request.user?.userId;
    if (!actorUserId) {
      throw new UnauthorizedException('Unauthorized');
    }

    return await this.chatService.getGroupRoomDetails(actorUserId, roomId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('groups/:roomId/messages')
  async sendGroupMessage(
    @Req() request: AuthenticatedRequest,
    @Param('roomId') roomId: string,
    @Body() dto: Omit<SendGroupMessageDto, 'roomId'>,
  ): Promise<unknown> {
    const actorUserId = request.user?.userId;
    if (!actorUserId) {
      throw new UnauthorizedException('Unauthorized');
    }

    const message = await this.chatService.sendGroupMessage(actorUserId, {
      roomId,
      content: dto.content,
    });
    this.chatGateway.broadcastGroupMessage(roomId, message);
    return message;
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('groups/:roomId/members')
  async addGroupMember(
    @Req() request: AuthenticatedRequest,
    @Param('roomId') roomId: string,
    @Body() dto: GroupMemberDto,
  ): Promise<unknown> {
    const actorUserId = request.user?.userId;
    if (!actorUserId) {
      throw new UnauthorizedException('Unauthorized');
    }

    const result = await this.chatService.addGroupMember(
      actorUserId,
      roomId,
      dto,
    );
    this.chatGateway.subscribeUserToGroupRoom(dto.userId, roomId);
    this.chatGateway.broadcastGroupRoomUpdate(roomId, result);
    return result;
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete('groups/:roomId/members/:memberUserId')
  async removeGroupMember(
    @Req() request: AuthenticatedRequest,
    @Param('roomId') roomId: string,
    @Param('memberUserId') memberUserId: string,
  ): Promise<unknown> {
    const actorUserId = request.user?.userId;
    if (!actorUserId) {
      throw new UnauthorizedException('Unauthorized');
    }

    const result = await this.chatService.removeGroupMember(
      actorUserId,
      roomId,
      memberUserId,
    );
    this.chatGateway.unsubscribeUserFromGroupRoom(memberUserId, roomId);
    this.chatGateway.broadcastGroupMemberLeft(roomId, memberUserId, result);
    return result;
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('groups/:roomId/leave')
  async leaveGroup(
    @Req() request: AuthenticatedRequest,
    @Param('roomId') roomId: string,
  ): Promise<unknown> {
    const actorUserId = request.user?.userId;
    if (!actorUserId) {
      throw new UnauthorizedException('Unauthorized');
    }

    const result = await this.chatService.leaveGroup(actorUserId, roomId);
    this.chatGateway.unsubscribeUserFromGroupRoom(actorUserId, roomId);
    this.chatGateway.broadcastGroupMemberLeft(roomId, actorUserId, result);
    return result;
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete('groups/:roomId')
  async dissolveGroup(
    @Req() request: AuthenticatedRequest,
    @Param('roomId') roomId: string,
  ): Promise<unknown> {
    const actorUserId = request.user?.userId;
    if (!actorUserId) {
      throw new UnauthorizedException('Unauthorized');
    }

    const result = await this.chatService.dissolveGroup(actorUserId, roomId);
    this.chatGateway.broadcastGroupDissolved(
      roomId,
      result.memberUserIds,
      result,
    );
    return result;
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('groups/:roomId/members/:memberUserId/promote')
  async promoteGroupMember(
    @Req() request: AuthenticatedRequest,
    @Param('roomId') roomId: string,
    @Param('memberUserId') memberUserId: string,
  ): Promise<unknown> {
    const actorUserId = request.user?.userId;
    if (!actorUserId) {
      throw new UnauthorizedException('Unauthorized');
    }

    const result = await this.chatService.promoteGroupMember(
      actorUserId,
      roomId,
      memberUserId,
    );
    this.chatGateway.broadcastGroupRoomUpdate(roomId, result);
    return result;
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('groups/:roomId/invite-link')
  async createInviteLink(
    @Req() request: AuthenticatedRequest,
    @Param('roomId') roomId: string,
  ): Promise<unknown> {
    const actorUserId = request.user?.userId;
    if (!actorUserId) {
      throw new UnauthorizedException('Unauthorized');
    }

    return await this.chatService.createGroupInviteLink(actorUserId, roomId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('group-invites/:inviteCode/join')
  async joinByInvite(
    @Req() request: AuthenticatedRequest,
    @Param('inviteCode') inviteCode: string,
  ): Promise<unknown> {
    const actorUserId = request.user?.userId;
    if (!actorUserId) {
      throw new UnauthorizedException('Unauthorized');
    }

    const result = await this.chatService.joinGroupByInvite(
      actorUserId,
      inviteCode,
    );
    this.chatGateway.subscribeUserToGroupRoom(actorUserId, result.roomId);
    this.chatGateway.broadcastGroupRoomUpdate(result.roomId, result);
    return result;
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete('rooms/:roomId/messages')
  async deleteChatHistory(
    @Req() request: AuthenticatedRequest,
    @Param('roomId') roomId: string,
  ): Promise<unknown> {
    const actorUserId = request.user?.userId;
    if (!actorUserId) {
      throw new UnauthorizedException('Unauthorized');
    }

    return await this.chatService.deleteChatHistory(actorUserId, roomId);
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
        const sessionId =
          typeof result.data === 'object' &&
          result.data !== null &&
          'sessionId' in result.data
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

  @UseGuards(AuthGuard('jwt'))
  @Get('rooms/:roomId/images')
  async getRoomImages(
    @Req() request: AuthenticatedRequest,
    @Param('roomId') roomId: string,
  ): Promise<unknown> {
    const actorUserId = request.user?.userId;
    if (!actorUserId) {
      throw new UnauthorizedException('Unauthorized');
    }

    return await this.chatService.getRoomImages(actorUserId, roomId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('rooms/:roomId/files')
  async getRoomFiles(
    @Req() request: AuthenticatedRequest,
    @Param('roomId') roomId: string,
  ): Promise<unknown> {
    const actorUserId = request.user?.userId;
    if (!actorUserId) {
      throw new UnauthorizedException('Unauthorized');
    }

    return await this.chatService.getRoomFiles(actorUserId, roomId);
  }
}
