import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { PresenceService } from '../../common/presence/presence.service';
import { UserEntity } from '../auth/interfaces/user.interface';
import { UsersRepository } from '../auth/repositories/users.repository';
import { BlockUserDto } from './dto/block-user.dto';
import { ListFriendsDto } from './dto/list-friends.dto';
import { SearchUserDto } from './dto/search-user.dto';
import { SendFriendRequestDto } from './dto/send-friend-request.dto';
import { SocialRepository } from './repositories/social.repository';
import { ChatGatewayTransportService } from '../chat/services/chat-gateway-transport.service';
import { SOCIAL_EVENTS } from '../chat/constants/events';

export interface ChatFriendUser {
  userId: string;
  name: string;
  avatarUrl?: string;
  connectedAt: string;
}

@Injectable()
export class SocialService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly socialRepository: SocialRepository,
    private readonly presenceService: PresenceService,
    private readonly moduleRef: ModuleRef,
  ) {}

  async searchUsers(actorUserId: string, dto: SearchUserDto) {
    if (!dto.query || !dto.query.trim()) {
      return { items: [], nextCursor: null };
    }

    const result = await this.usersRepository.searchUsers(
      actorUserId,
      dto.query,
      dto.limit ?? 20,
      dto.cursor,
    );

    const items = (
      await Promise.all(
        result.items.map(async (user) => {
          const blockedMe = await this.socialRepository.isBlocked(
            user.userId,
            actorUserId,
          );
          if (blockedMe) {
            return null;
          }

          const relation = await this.socialRepository.getFriend(
            actorUserId,
            user.userId,
          );
          const blockedByMe = await this.socialRepository.isBlocked(
            actorUserId,
            user.userId,
          );
          const presence = this.presenceService.getPresence(user.userId);

          return {
            userId: user.userId,
            name: user.name,
            email: user.email,
            friendStatus: relation?.status ?? 'NONE',
            isOnline: presence.isOnline,
            lastSeenAt: presence.lastSeenAt,
            blockedByMe,
            blockedMe,
          };
        }),
      )
    ).filter((item): item is NonNullable<typeof item> => item !== null);

    return {
      items,
      nextCursor: result.nextCursor,
    };
  }

  async sendFriendRequest(actorUserId: string, dto: SendFriendRequestDto) {
    if (actorUserId === dto.targetUserId) {
      throw new ConflictException('Khong the ket ban voi chinh minh');
    }

    await this.ensureUserExists(dto.targetUserId);

    const blocked = await this.socialRepository.isEitherBlocked(
      actorUserId,
      dto.targetUserId,
    );
    if (blocked) {
      throw new ForbiddenException('Khong the gui loi moi ket ban do bi chan');
    }

    const relation = await this.socialRepository.getFriend(
      actorUserId,
      dto.targetUserId,
    );
    if (relation?.status === 'FRIEND') {
      throw new ConflictException('Hai nguoi da la ban');
    }
    if (relation?.status === 'PENDING_SENT') {
      throw new ConflictException('Da gui loi moi ket ban');
    }
    if (relation?.status === 'PENDING_RECEIVED') {
      throw new ConflictException('Ban dang co loi moi ket ban tu nguoi nay');
    }

    await this.socialRepository.saveFriendPair(
      actorUserId,
      dto.targetUserId,
      'PENDING_SENT',
      'PENDING_RECEIVED',
    );

    const actorUser = await this.usersRepository.findByUserId(actorUserId);
    if (actorUser) {
      try {
        const transportService = this.moduleRef.get(
          ChatGatewayTransportService,
          { strict: false },
        );
        const presenceActor = this.presenceService.getPresence(actorUserId);
        transportService.emitToUser(
          dto.targetUserId,
          SOCIAL_EVENTS.REQUEST_RECEIVED,
          {
            userId: actorUserId,
            name: actorUser.name,
            email: actorUser.email,
            isOnline: presenceActor.isOnline,
            lastSeenAt: presenceActor.lastSeenAt,
          },
        );
      } catch (err) {
        // ignore
      }
    }

    return { success: true };
  }

  async acceptFriendRequest(actorUserId: string, requesterUserId: string) {
    const relation = await this.socialRepository.getFriend(
      actorUserId,
      requesterUserId,
    );
    if (relation?.status !== 'PENDING_RECEIVED') {
      throw new NotFoundException('Khong tim thay loi moi');
    }

    await this.socialRepository.saveFriendPair(
      actorUserId,
      requesterUserId,
      'FRIEND',
      'FRIEND',
    );

    const [actorUser, requesterUser] = await Promise.all([
      this.usersRepository.findByUserId(actorUserId),
      this.usersRepository.findByUserId(requesterUserId),
    ]);

    if (actorUser && requesterUser) {
      try {
        const transportService = this.moduleRef.get(
          ChatGatewayTransportService,
          { strict: false },
        );
        const presenceActor = this.presenceService.getPresence(actorUserId);
        const presenceRequester =
          this.presenceService.getPresence(requesterUserId);

        transportService.emitToUser(
          requesterUserId,
          SOCIAL_EVENTS.REQUEST_ACCEPTED,
          {
            userId: actorUserId,
            name: actorUser.name,
            email: actorUser.email,
            isOnline: presenceActor.isOnline,
            lastSeenAt: presenceActor.lastSeenAt,
          },
        );

        transportService.emitToUser(
          actorUserId,
          SOCIAL_EVENTS.REQUEST_ACCEPTED,
          {
            userId: requesterUserId,
            name: requesterUser.name,
            email: requesterUser.email,
            isOnline: presenceRequester.isOnline,
            lastSeenAt: presenceRequester.lastSeenAt,
          },
        );
      } catch (err) {
        // ignore
      }
    }

    return { success: true };
  }

  async rejectFriendRequest(actorUserId: string, requesterUserId: string) {
    const relation = await this.socialRepository.getFriend(
      actorUserId,
      requesterUserId,
    );
    if (relation?.status !== 'PENDING_RECEIVED') {
      throw new NotFoundException('Khong tim thay loi moi');
    }

    await this.socialRepository.removeFriendPair(actorUserId, requesterUserId);
    return { success: true };
  }

  async unfriend(actorUserId: string, friendUserId: string) {
    const relation = await this.socialRepository.getFriend(
      actorUserId,
      friendUserId,
    );
    if (relation?.status !== 'FRIEND') {
      throw new NotFoundException('Khong tim thay ban be');
    }

    await this.socialRepository.removeFriendPair(actorUserId, friendUserId);

    try {
      const transportService = this.moduleRef.get(ChatGatewayTransportService, {
        strict: false,
      });
      transportService.emitToUser(actorUserId, SOCIAL_EVENTS.UNFRIENDED, {
        userId: friendUserId,
      });
      transportService.emitToUser(friendUserId, SOCIAL_EVENTS.UNFRIENDED, {
        userId: actorUserId,
      });
    } catch (err) {
      // ignore
    }

    return { success: true };
  }

  async listFriends(actorUserId: string, dto: ListFriendsDto) {
    const page = await this.socialRepository.listFriendsByStatus(
      actorUserId,
      'FRIEND',
      dto.limit ?? 20,
      dto.cursor,
    );

    const users = await this.loadUsers(
      page.items.map((item) => item.targetUserId),
    );

    return {
      items: users.map((user) => {
        const presence = this.presenceService.getPresence(user.userId);
        return {
          userId: user.userId,
          name: user.name,
          email: user.email,
          isOnline: presence.isOnline,
          lastSeenAt: presence.lastSeenAt,
        };
      }),
      nextCursor: page.nextCursor,
    };
  }

  async listIncomingRequests(actorUserId: string, dto: ListFriendsDto) {
    const page = await this.socialRepository.listFriendsByStatus(
      actorUserId,
      'PENDING_RECEIVED',
      dto.limit ?? 20,
      dto.cursor,
    );

    const users = await this.loadUsers(
      page.items.map((item) => item.targetUserId),
    );

    return {
      items: users.map((user) => {
        const presence = this.presenceService.getPresence(user.userId);
        return {
          userId: user.userId,
          name: user.name,
          email: user.email,
          isOnline: presence.isOnline,
          lastSeenAt: presence.lastSeenAt,
        };
      }),
      nextCursor: page.nextCursor,
    };
  }

  async listOutgoingRequests(actorUserId: string, dto: ListFriendsDto) {
    const page = await this.socialRepository.listFriendsByStatus(
      actorUserId,
      'PENDING_SENT',
      dto.limit ?? 20,
      dto.cursor,
    );

    const users = await this.loadUsers(
      page.items.map((item) => item.targetUserId),
    );

    return {
      items: users.map((user) => {
        const presence = this.presenceService.getPresence(user.userId);
        return {
          userId: user.userId,
          name: user.name,
          email: user.email,
          isOnline: presence.isOnline,
          lastSeenAt: presence.lastSeenAt,
        };
      }),
      nextCursor: page.nextCursor,
    };
  }

  async cancelFriendRequest(actorUserId: string, targetUserId: string) {
    const relation = await this.socialRepository.getFriend(
      actorUserId,
      targetUserId,
    );
    if (relation?.status !== 'PENDING_SENT') {
      throw new NotFoundException('Khong tim thay yeu cau ket ban');
    }

    await this.socialRepository.removeFriendPair(actorUserId, targetUserId);

    try {
      const transportService = this.moduleRef.get(ChatGatewayTransportService, {
        strict: false,
      });
      transportService.emitToUser(
        targetUserId,
        SOCIAL_EVENTS.REQUEST_CANCELLED,
        {
          userId: actorUserId,
        },
      );
    } catch (err) {
      // ignore
    }

    return { success: true };
  }

  async listBlockedUsers(actorUserId: string, dto: ListFriendsDto) {
    const page = await this.socialRepository.listBlockedUsers(
      actorUserId,
      dto.limit ?? 20,
      dto.cursor,
    );

    const users = await this.loadUsers(
      page.items.map((item) => item.targetUserId),
    );

    return {
      items: users.map((user) => {
        return {
          userId: user.userId,
          name: user.name,
          email: user.email,
        };
      }),
      nextCursor: page.nextCursor,
    };
  }

  async restoreFriendRequest(actorUserId: string, requesterUserId: string) {
    await this.ensureUserExists(requesterUserId);

    await this.socialRepository.saveFriendPair(
      requesterUserId,
      actorUserId,
      'PENDING_SENT',
      'PENDING_RECEIVED',
    );

    const requesterUser =
      await this.usersRepository.findByUserId(requesterUserId);
    if (requesterUser) {
      try {
        const transportService = this.moduleRef.get(
          ChatGatewayTransportService,
          { strict: false },
        );
        const presenceRequester =
          this.presenceService.getPresence(requesterUserId);
        transportService.emitToUser(
          actorUserId,
          SOCIAL_EVENTS.REQUEST_RECEIVED,
          {
            userId: requesterUserId,
            name: requesterUser.name,
            email: requesterUser.email,
            isOnline: presenceRequester.isOnline,
            lastSeenAt: presenceRequester.lastSeenAt,
          },
        );
      } catch (err) {
        // ignore
      }
    }

    return { success: true };
  }

  async listAllFriendUsers(actorUserId: string): Promise<ChatFriendUser[]> {
    const relationItems = [] as Array<{
      targetUserId: string;
      updatedAt: string;
    }>;
    let cursor: string | undefined;

    do {
      const page = await this.socialRepository.listFriendsByStatus(
        actorUserId,
        'FRIEND',
        100,
        cursor,
      );

      relationItems.push(
        ...page.items.map((item) => ({
          targetUserId: item.targetUserId,
          updatedAt: item.updatedAt,
        })),
      );
      cursor = page.nextCursor ?? undefined;
    } while (cursor);

    if (relationItems.length === 0) {
      return [];
    }

    const users = await this.loadUsers(
      Array.from(new Set(relationItems.map((item) => item.targetUserId))),
    );
    const userMap = new Map(users.map((user) => [user.userId, user]));

    return relationItems
      .map((item) => {
        const user = userMap.get(item.targetUserId);
        if (!user) return null;

        return {
          userId: user.userId,
          name: user.name,

          ...(user.avatarUrl ? { avatarUrl: user.avatarUrl } : {}),
          connectedAt: item.updatedAt,
        };
      })
      .filter((item): item is ChatFriendUser => item != null);
  }

  async blockUser(actorUserId: string, dto: BlockUserDto) {
    if (actorUserId === dto.targetUserId) {
      throw new ConflictException('Khong the chan chinh minh');
    }

    await this.ensureUserExists(dto.targetUserId);

    const relation = await this.socialRepository.getFriend(
      actorUserId,
      dto.targetUserId,
    );
    const wasFriends = relation?.status === 'FRIEND';

    await this.socialRepository.setBlocked(actorUserId, dto.targetUserId);
    await this.socialRepository.removeFriendPair(actorUserId, dto.targetUserId);

    if (wasFriends) {
      try {
        const transportService = this.moduleRef.get(
          ChatGatewayTransportService,
          { strict: false },
        );
        transportService.emitToUser(actorUserId, SOCIAL_EVENTS.UNFRIENDED, {
          userId: dto.targetUserId,
        });
        transportService.emitToUser(
          dto.targetUserId,
          SOCIAL_EVENTS.UNFRIENDED,
          { userId: actorUserId },
        );
      } catch (err) {
        // ignore
      }
    }

    return { success: true };
  }

  async unblockUser(actorUserId: string, targetUserId: string) {
    await this.socialRepository.unblock(actorUserId, targetUserId);
    return { success: true };
  }

  async assertNotBlocked(userAId: string, userBId: string): Promise<void> {
    const blocked = await this.socialRepository.isEitherBlocked(
      userAId,
      userBId,
    );
    if (blocked) {
      throw new ForbiddenException('Khong the thao tac vi co quan he chan');
    }
  }

  private async ensureUserExists(userId: string): Promise<void> {
    const user = await this.usersRepository.findByUserId(userId);
    if (!user) {
      throw new NotFoundException('Nguoi dung khong ton tai');
    }
  }

  private async loadUsers(userIds: string[]): Promise<UserEntity[]> {
    const loaded = await Promise.all(
      userIds.map((userId) => this.usersRepository.findByUserId(userId)),
    );
    return loaded.filter((item): item is UserEntity => item != null);
  }
}
