import { Catch, ExceptionFilter, ArgumentsHost } from '@nestjs/common';
import { MulterError } from 'multer';

@Catch(MulterError)
export class MulterExceptionFilter implements ExceptionFilter {
  catch(exception: MulterError, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse();
    const error =
      exception.code === 'LIMIT_FILE_SIZE'
        ? 'file_too_large'
        : exception.code === 'LIMIT_FILE_COUNT'
          ? 'too_many_files'
          : 'file_upload';
    res.status(400).json({ error });
  }
}
