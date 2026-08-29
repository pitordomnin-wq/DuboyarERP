import { ArrayMaxSize, ArrayUnique, IsArray, IsEnum, IsNumber, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { TaskBoard, TaskStatus } from '@prisma/client';

export class CreateTaskDto {
  @IsEnum(TaskBoard)
  board!: TaskBoard;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  assigneeIds?: string[];
}

export class UpdateTaskDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @IsOptional()
  @IsNumber()
  position?: number;
}

export class CreateCommentDto {
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  body?: string;
}
