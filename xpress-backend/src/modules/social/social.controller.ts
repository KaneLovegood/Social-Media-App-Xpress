import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { BlockUserDto } from './dto/block-user.dto';
import { ListFriendsDto } from './dto/list-friends.dto';
import { SearchUserDto } from './dto/search-user.dto';
import { SendFriendRequestDto } from './dto/send-friend-request.dto';
import { SocialService } from './social.service';

interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    email: string;
    role: string;
  };
}

// Auth được handle bởi global JwtGuard (xem app.module.ts).
// Mỗi route chỉ public khi đánh dấu @Public() — mặc định: cần JWT.
@Controller('social')
export class SocialController {
  constructor(private readonly socialService: SocialService) {}

  @Get('users/search')
  searchUsers(
    @Req() req: AuthenticatedRequest,
    @Query() query: SearchUserDto,
  ) {
    return this.socialService.searchUsers(this.getUserId(req), query);
  }

  @Post('friends/requests')
  sendFriendRequest(
    @Req() req: AuthenticatedRequest,
    @Body() dto: SendFriendRequestDto,
  ) {
    return this.socialService.sendFriendRequest(this.getUserId(req), dto);
  }

  @Post('friends/requests/:requesterUserId/accept')
  acceptRequest(
    @Req() req: AuthenticatedRequest,
    @Param('requesterUserId') requesterUserId: string,
  ) {
    return this.socialService.acceptFriendRequest(
      this.getUserId(req),
      requesterUserId,
    );
  }

  @Post('friends/requests/:requesterUserId/reject')
  rejectRequest(
    @Req() req: AuthenticatedRequest,
    @Param('requesterUserId') requesterUserId: string,
  ) {
    return this.socialService.rejectFriendRequest(
      this.getUserId(req),
      requesterUserId,
    );
  }

  @Delete('friends/:friendUserId')
  unfriend(
    @Req() req: AuthenticatedRequest,
    @Param('friendUserId') friendUserId: string,
  ) {
    return this.socialService.unfriend(this.getUserId(req), friendUserId);
  }

  @Get('friends')
  listFriends(
    @Req() req: AuthenticatedRequest,
    @Query() query: ListFriendsDto,
  ) {
    return this.socialService.listFriends(this.getUserId(req), query);
  }

  @Get('friends/requests/incoming')
  listIncoming(
    @Req() req: AuthenticatedRequest,
    @Query() query: ListFriendsDto,
  ) {
    return this.socialService.listIncomingRequests(this.getUserId(req), query);
  }

  @Get('friends/requests/outgoing')
  listOutgoing(
    @Req() req: AuthenticatedRequest,
    @Query() query: ListFriendsDto,
  ) {
    return this.socialService.listOutgoingRequests(this.getUserId(req), query);
  }

  @Delete('friends/requests/:targetUserId/cancel')
  cancelRequest(
    @Req() req: AuthenticatedRequest,
    @Param('targetUserId') targetUserId: string,
  ) {
    return this.socialService.cancelFriendRequest(this.getUserId(req), targetUserId);
  }

  @Get('blocks')
  listBlocked(
    @Req() req: AuthenticatedRequest,
    @Query() query: ListFriendsDto,
  ) {
    return this.socialService.listBlockedUsers(this.getUserId(req), query);
  }

  @Post('friends/requests/:requesterUserId/restore')
  restoreRequest(
    @Req() req: AuthenticatedRequest,
    @Param('requesterUserId') requesterUserId: string,
  ) {
    return this.socialService.restoreFriendRequest(this.getUserId(req), requesterUserId);
  }

  @Post('blocks')
  block(@Req() req: AuthenticatedRequest, @Body() dto: BlockUserDto) {
    return this.socialService.blockUser(this.getUserId(req), dto);
  }

  @Delete('blocks/:targetUserId')
  unblock(
    @Req() req: AuthenticatedRequest,
    @Param('targetUserId') targetUserId: string,
  ) {
    return this.socialService.unblockUser(this.getUserId(req), targetUserId);
  }

  private getUserId(request: AuthenticatedRequest): string {
    const userId = request.user?.userId;
    if (!userId) {
      throw new UnauthorizedException('Unauthorized');
    }

    return userId;
  }
}
