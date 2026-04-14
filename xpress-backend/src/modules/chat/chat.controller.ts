import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { PresenceService } from '../../common/presence/presence.service';
import { UsersRepository } from '../auth/repositories/users.repository';
import { GROUP_EVENTS } from './constants/events';
import { ChatActionDto } from './dto/chat-action.dto';
import { CreateGroupDto } from './dto/create-group.dto';
import { GroupCallStateDto } from './dto/group-call-state.dto';
import {
  JoinGroupByInviteDto,
  ManageGroupMemberDto,
  PinGroupMessageDto,
  SetGroupNicknameDto,
} from './dto/manage-group-member.dto';
import { GroupService } from './group.service';
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
    private readonly groupService: GroupService,
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
  @Post('actions')
  async postAction(
    @Req() request: AuthenticatedRequest,
    @Body() dto: ChatActionDto,
  ): Promise<unknown> {
    const actorUserId = request.user?.userId;
    if (!actorUserId) {
      throw new UnauthorizedException('Unauthorized');
    }

    const result = this.chatService.handleAction(actorUserId, dto);

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

    return result;
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('groups')
  async listGroups(@Req() request: AuthenticatedRequest): Promise<unknown> {
    const actorUserId = request.user?.userId;
    if (!actorUserId) {
      throw new UnauthorizedException('Unauthorized');
    }

    return await this.groupService.listGroups(actorUserId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('groups/:groupId')
  async getGroupDetail(
    @Req() request: AuthenticatedRequest,
    @Param('groupId', ParseUUIDPipe) groupId: string,
  ): Promise<unknown> {
    const actorUserId = request.user?.userId;
    if (!actorUserId) {
      throw new UnauthorizedException('Unauthorized');
    }

    return await this.groupService.getGroupDetail(actorUserId, groupId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('groups/:groupId/messages')
  async getGroupMessages(
    @Req() request: AuthenticatedRequest,
    @Param('groupId', ParseUUIDPipe) groupId: string,
  ): Promise<unknown> {
    const actorUserId = request.user?.userId;
    if (!actorUserId) {
      throw new UnauthorizedException('Unauthorized');
    }

    return await this.groupService.listGroupMessages(actorUserId, groupId);
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

    const result = await this.groupService.createGroup(actorUserId, dto);
    this.chatGateway.emitGroupUpdatedToUsers([actorUserId], {
      type: 'group_created',
      ...result,
    });

    return result;
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('groups/:groupId/members')
  async addMember(
    @Req() request: AuthenticatedRequest,
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Body() dto: ManageGroupMemberDto,
  ): Promise<unknown> {
    const actorUserId = request.user?.userId;
    if (!actorUserId) {
      throw new UnauthorizedException('Unauthorized');
    }

    const result = await this.groupService.addMember(actorUserId, groupId, dto);
    this.chatGateway.emitGroupEvent(
      groupId,
      GROUP_EVENTS.MEMBER_JOINED,
      result,
    );
    this.chatGateway.emitGroupUpdatedToUsers([dto.targetUserId], {
      type: 'group_membership_changed',
      groupId,
      userId: dto.targetUserId,
    });

    return result;
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete('groups/:groupId/members/:targetUserId')
  async removeMember(
    @Req() request: AuthenticatedRequest,
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Param('targetUserId', ParseUUIDPipe) targetUserId: string,
  ): Promise<unknown> {
    const actorUserId = request.user?.userId;
    if (!actorUserId) {
      throw new UnauthorizedException('Unauthorized');
    }

    const result = await this.groupService.removeMember(actorUserId, groupId, {
      targetUserId,
    });
    this.chatGateway.emitGroupEvent(groupId, GROUP_EVENTS.MEMBER_LEFT, result);

    return result;
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('groups/:groupId/leave')
  async leaveGroup(
    @Req() request: AuthenticatedRequest,
    @Param('groupId', ParseUUIDPipe) groupId: string,
  ): Promise<unknown> {
    const actorUserId = request.user?.userId;
    if (!actorUserId) {
      throw new UnauthorizedException('Unauthorized');
    }

    const result = await this.groupService.leaveGroup(actorUserId, groupId);
    this.chatGateway.emitGroupEvent(groupId, GROUP_EVENTS.MEMBER_LEFT, result);

    return result;
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete('groups/:groupId')
  async disbandGroup(
    @Req() request: AuthenticatedRequest,
    @Param('groupId', ParseUUIDPipe) groupId: string,
  ): Promise<unknown> {
    const actorUserId = request.user?.userId;
    if (!actorUserId) {
      throw new UnauthorizedException('Unauthorized');
    }

    const result = await this.groupService.disbandGroup(actorUserId, groupId);
    this.chatGateway.emitGroupEvent(groupId, GROUP_EVENTS.MEMBER_LEFT, {
      groupId,
      userId: actorUserId,
      type: 'group_disbanded',
    });

    return result;
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('groups/:groupId/promote')
  async promoteMember(
    @Req() request: AuthenticatedRequest,
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Body() dto: ManageGroupMemberDto,
  ): Promise<unknown> {
    const actorUserId = request.user?.userId;
    if (!actorUserId) {
      throw new UnauthorizedException('Unauthorized');
    }

    const result = await this.groupService.promoteMember(
      actorUserId,
      groupId,
      dto,
    );
    this.chatGateway.emitGroupEvent(
      groupId,
      GROUP_EVENTS.MEMBER_PROMOTED,
      result,
    );

    return result;
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('groups/:groupId/invite-link')
  async createInviteLink(
    @Req() request: AuthenticatedRequest,
    @Param('groupId', ParseUUIDPipe) groupId: string,
  ): Promise<unknown> {
    const actorUserId = request.user?.userId;
    if (!actorUserId) {
      throw new UnauthorizedException('Unauthorized');
    }

    return await this.groupService.createInviteLink(actorUserId, groupId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('groups/join-by-link')
  async joinByInvite(
    @Req() request: AuthenticatedRequest,
    @Body() dto: JoinGroupByInviteDto,
  ): Promise<unknown> {
    const actorUserId = request.user?.userId;
    if (!actorUserId) {
      throw new UnauthorizedException('Unauthorized');
    }

    const result = await this.groupService.joinByInvite(actorUserId, dto);
    this.chatGateway.emitGroupEvent(
      result.groupId,
      GROUP_EVENTS.MEMBER_JOINED,
      {
        groupId: result.groupId,
        userId: actorUserId,
        role: result.role,
      },
    );

    return result;
  }

  @UseGuards(AuthGuard('jwt'))
  @Patch('groups/:groupId/nickname')
  async setGroupNickname(
    @Req() request: AuthenticatedRequest,
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Body() dto: SetGroupNicknameDto,
  ): Promise<unknown> {
    const actorUserId = request.user?.userId;
    if (!actorUserId) {
      throw new UnauthorizedException('Unauthorized');
    }

    const result = await this.groupService.setNickname(
      actorUserId,
      groupId,
      dto,
    );
    this.chatGateway.emitGroupUpdated(groupId, {
      type: 'group_nickname_updated',
      ...result,
    });

    return result;
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('groups/:groupId/pinned-messages')
  async pinMessage(
    @Req() request: AuthenticatedRequest,
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Body() dto: PinGroupMessageDto,
  ): Promise<unknown> {
    const actorUserId = request.user?.userId;
    if (!actorUserId) {
      throw new UnauthorizedException('Unauthorized');
    }

    const result = await this.groupService.pinMessage(
      actorUserId,
      groupId,
      dto,
    );
    this.chatGateway.emitGroupEvent(
      groupId,
      GROUP_EVENTS.MESSAGE_PINNED,
      result,
    );

    return result;
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete('groups/:groupId/pinned-messages/:messageId')
  async unpinMessage(
    @Req() request: AuthenticatedRequest,
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Param('messageId') messageId: string,
  ): Promise<unknown> {
    const actorUserId = request.user?.userId;
    if (!actorUserId) {
      throw new UnauthorizedException('Unauthorized');
    }

    const result = await this.groupService.unpinMessage(
      actorUserId,
      groupId,
      messageId,
    );
    this.chatGateway.emitGroupEvent(
      groupId,
      GROUP_EVENTS.MESSAGE_UNPINNED,
      result,
    );

    return result;
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('groups/:groupId/call-state')
  async updateGroupCallState(
    @Req() request: AuthenticatedRequest,
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Body() dto: GroupCallStateDto,
  ): Promise<unknown> {
    const actorUserId = request.user?.userId;
    if (!actorUserId) {
      throw new UnauthorizedException('Unauthorized');
    }

    const result = await this.groupService.updateCallState(actorUserId, {
      groupId,
      mode: dto.mode,
      state: dto.state,
    });
    this.chatGateway.emitGroupEvent(groupId, GROUP_EVENTS.CALL_STATE, result);

    return result;
  }
}
