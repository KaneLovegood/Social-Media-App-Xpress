import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { PresenceService } from '../../common/presence/presence.service';
import { UsersRepository } from '../auth/repositories/users.repository';
import { CreateGroupDto } from './dto/create-group.dto';
import { ChatActionDto } from './dto/chat-action.dto';
import { GroupMemberDto } from './dto/group-member.dto';
import { SendGroupMessageDto } from './dto/send-group-message.dto';
import { PresignedUrlDto } from './dto/presigned-url.dto';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { StorageService } from '../storage/storage.service';

interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    email: string;
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
    private readonly storageService: StorageService,
  ) {}

  @Get('rooms')
  async getRooms(@Req() request: AuthenticatedRequest): Promise<unknown> {
    const actorUserId = request.user?.userId;
    if (!actorUserId) {
      throw new UnauthorizedException('Unauthorized');
    }

    return await this.chatService.getChatRoomsForUser(actorUserId);
  }

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
    if (result.systemMessage) {
      this.chatGateway.broadcastGroupMessage(roomId, result.systemMessage);
    }
    this.chatGateway.broadcastGroupRoomUpdate(roomId, result.roomDetails);
    return result.roomDetails;
  }

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
    if (result.systemMessage) {
      this.chatGateway.broadcastGroupMessage(roomId, result.systemMessage);
    }
    this.chatGateway.broadcastGroupMemberLeft(
      roomId,
      memberUserId,
      result.roomDetails,
    );
    return result.roomDetails;
  }

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
    if (result.systemMessage) {
      this.chatGateway.broadcastGroupMessage(roomId, result.systemMessage);
    }
    this.chatGateway.broadcastGroupMemberLeft(
      roomId,
      actorUserId,
      result.roomDetails,
    );
    return result.roomDetails;
  }

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
    this.chatGateway.subscribeUserToGroupRoom(
      actorUserId,
      result.roomDetails.roomId,
    );
    if (result.systemMessage) {
      this.chatGateway.broadcastGroupMessage(
        result.roomDetails.roomId,
        result.systemMessage,
      );
    }
    this.chatGateway.broadcastGroupRoomUpdate(
      result.roomDetails.roomId,
      result.roomDetails,
    );
    return result.roomDetails;
  }

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

  @Post('presigned-url')
  async getPresignedUrl(
    @Req() request: AuthenticatedRequest,
    @Body() body: PresignedUrlDto,
  ): Promise<unknown> {
    const actorUserId = request.user?.userId;
    if (!actorUserId) {
      throw new UnauthorizedException('Unauthorized');
    }

    return await this.storageService.generatePresignedUrl(
      body.fileName,
      body.contentType,
    );
  }

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
            ? result.data.sessionId
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
