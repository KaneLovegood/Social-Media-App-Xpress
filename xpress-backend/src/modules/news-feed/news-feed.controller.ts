import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Post,
  Put,
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CreatePostDto } from './dto/create-post.dto';
import { ListFeedDto } from './dto/list-feed.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { NewsFeedGateway } from './news-feed.gateway';
import { NewsFeedService } from './news-feed.service';

interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    email: string;
    role: string;
  };
}

@Controller()
export class NewsFeedController {
  constructor(
    private readonly newsFeedService: NewsFeedService,
    private readonly newsFeedGateway: NewsFeedGateway,
  ) {}

  @Get('ban-tin')
  layBanTin(@Req() req: AuthenticatedRequest, @Query() query: ListFeedDto) {
    return this.newsFeedService.layBanTin(this.getUserId(req), query);
  }

  @Post('bai-viet')
  async taoBaiViet(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreatePostDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    const post = await this.newsFeedService.taoBaiViet(
      this.getUserId(req),
      dto,
      idempotencyKey,
    );
    this.newsFeedGateway.emitPostCreated(post);
    return post;
  }

  @Put('bai-viet/:postId')
  async capNhatBaiViet(
    @Req() req: AuthenticatedRequest,
    @Param('postId') postId: string,
    @Body() dto: UpdatePostDto,
  ) {
    const post = await this.newsFeedService.capNhatBaiViet(
      this.getUserId(req),
      postId,
      dto,
    );
    this.newsFeedGateway.emitPostUpdated(post);
    return post;
  }

  @Delete('bai-viet/:postId')
  async xoaBaiViet(
    @Req() req: AuthenticatedRequest,
    @Param('postId') postId: string,
  ) {
    const result = await this.newsFeedService.xoaBaiViet(this.getUserId(req), postId);
    this.newsFeedGateway.emitPostDeleted({ maBaiViet: postId });
    return result;
  }

  @Post('bai-viet/:postId/thich')
  async thichBaiViet(
    @Req() req: AuthenticatedRequest,
    @Param('postId') postId: string,
  ) {
    const result = await this.newsFeedService.thichBaiViet(
      this.getUserId(req),
      postId,
    );
    this.newsFeedGateway.emitReactionUpdated({
      maBaiViet: postId,
      daThich: result.daThich,
      soLuotThich: result.soLuotThich,
      maNguoiDungTacGia: result.postUserId,
      nguoiTuongTac: result.nguoiTuongTac,
    });
    return {
      daThich: result.daThich,
      soLuotThich: result.soLuotThich,
    };
  }

  @Delete('bai-viet/:postId/thich')
  async boThichBaiViet(
    @Req() req: AuthenticatedRequest,
    @Param('postId') postId: string,
  ) {
    const result = await this.newsFeedService.boThichBaiViet(
      this.getUserId(req),
      postId,
    );
    this.newsFeedGateway.emitReactionUpdated({
      maBaiViet: postId,
      daThich: result.daThich,
      soLuotThich: result.soLuotThich,
      maNguoiDungTacGia: result.postUserId,
      nguoiTuongTac: result.nguoiTuongTac,
    });
    return {
      daThich: result.daThich,
      soLuotThich: result.soLuotThich,
    };
  }

  @Get('bai-viet/:postId/binh-luan')
  async layDanhSachBinhLuan(
    @Req() req: AuthenticatedRequest,
    @Param('postId') postId: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.newsFeedService.layDanhSachBinhLuan(
      this.getUserId(req),
      postId,
      limit ? Number(limit) : undefined,
      cursor,
    );
  }

  @Post('bai-viet/:postId/binh-luan')
  async themBinhLuan(
    @Req() req: AuthenticatedRequest,
    @Param('postId') postId: string,
    @Body() dto: CreateCommentDto,
  ) {
    const comment = await this.newsFeedService.themBinhLuan(
      this.getUserId(req),
      postId,
      dto,
    );
    this.newsFeedGateway.emitCommentCreated(comment);
    return comment;
  }

  @Delete('bai-viet/:postId/binh-luan/:commentId')
  async xoaBinhLuan(
    @Req() req: AuthenticatedRequest,
    @Param('postId') postId: string,
    @Param('commentId') commentId: string,
  ) {
    const result = await this.newsFeedService.xoaBinhLuan(
      this.getUserId(req),
      postId,
      commentId,
    );
    this.newsFeedGateway.emitCommentDeleted({ maBaiViet: postId, maBinhLuan: commentId });
    return result;
  }

  @Post('bai-viet/:postId/chia-se')
  async chiaSeBaiViet(
    @Req() req: AuthenticatedRequest,
    @Param('postId') postId: string,
    @Body() dto: CreatePostDto,
  ) {
    const post = await this.newsFeedService.chiaSeBaiViet(
      this.getUserId(req),
      postId,
      dto,
    );
    this.newsFeedGateway.emitPostCreated(post);
    return post;
  }

  private getUserId(request: AuthenticatedRequest): string {
    const userId = request.user?.userId;
    if (!userId) {
      throw new UnauthorizedException('Unauthorized');
    }

    return userId;
  }
}
