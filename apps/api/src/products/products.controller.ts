import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ProductKind } from '@prisma/client';
import { memoryStorage } from 'multer';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user';
import type { AuthUser } from '../auth/auth-user';
import { MulterExceptionFilter } from '../mailbox/multer.filter';
import { ProductsService, type ProductListScope } from './products.service';
import { SetProductCatalogDto, UpsertProductDto, CreateAttributeTemplateDto } from './dto';
import { MAX_IMAGE_BYTES, MAX_IMAGES } from './storage';

@Controller('products')
@UseGuards(AuthGuard)
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query('q') q?: string, @Query('kind') kind?: string) {
    return this.products.list(user, q, this.scope(kind));
  }

  @Get('attribute-templates')
  listTemplates(@CurrentUser() user: AuthUser) {
    return this.products.listTemplates(user);
  }

  @Post('attribute-templates')
  createTemplate(@CurrentUser() user: AuthUser, @Body() body: CreateAttributeTemplateDto) {
    return this.products.createTemplate(user, body);
  }

  @Delete('attribute-templates/:templateId')
  @HttpCode(204)
  removeTemplate(@CurrentUser() user: AuthUser, @Param('templateId') templateId: string) {
    return this.products.removeTemplate(user, templateId);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() body: UpsertProductDto) {
    return this.products.create(user, body);
  }

  @Patch(':id/catalog')
  setCatalog(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: SetProductCatalogDto) {
    return this.products.setCatalog(user, id, body.inCatalog);
  }

  @Post(':id/images')
  @UseFilters(MulterExceptionFilter)
  @UseInterceptors(
    FilesInterceptor('files', MAX_IMAGES, {
      storage: memoryStorage(),
      limits: { fileSize: MAX_IMAGE_BYTES, files: MAX_IMAGES },
    }),
  )
  addImages(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.products.addImages(user, id, files ?? []);
  }

  @Get(':id/images/:imageId/file')
  @Header('Cache-Control', 'private, max-age=31536000, immutable')
  file(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('imageId') imageId: string,
    @Query('w') w?: string,
  ) {
    const width = w ? Number.parseInt(w, 10) : undefined;
    return this.products.file(user, id, imageId, Number.isFinite(width) ? width : undefined);
  }

  @Delete(':id/images/:imageId')
  removeImage(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('imageId') imageId: string,
  ) {
    return this.products.removeImage(user, id, imageId);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.products.get(user, id);
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: UpsertProductDto) {
    return this.products.update(user, id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.products.remove(user, id);
  }

  private scope(kind?: string): ProductListScope {
    const kinds = Object.values(ProductKind) as string[];
    if (kind === 'all' || kind === 'supply' || kind === 'stock' || kind === 'catalog') return kind;
    if (kind && kinds.includes(kind)) return kind as ProductKind;
    return 'catalog';
  }
}
