import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Response } from 'express';
import { MulterError } from 'multer';

/** Chuẩn hóa mọi lỗi về dạng { statusCode, code, message, details? }. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exception');

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();

    if (exception instanceof MulterError) {
      const tooLarge = exception.code === 'LIMIT_FILE_SIZE';
      const tooMany = exception.code === 'LIMIT_FILE_COUNT';
      return res.status(HttpStatus.BAD_REQUEST).json({
        statusCode: HttpStatus.BAD_REQUEST,
        code: tooLarge ? 'FILE_TOO_LARGE' : tooMany ? 'FILE_TOO_MANY' : 'VALIDATION_ERROR',
        message: tooLarge ? 'Tệp vượt quá dung lượng cho phép' : tooMany ? 'Vượt quá số tệp cho phép' : exception.message,
      });
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'object' && body && 'code' in body) return res.status(status).json(body);
      const message =
        typeof body === 'string' ? body : ((body as { message?: string | string[] }).message ?? exception.message);
      return res.status(status).json({
        statusCode: status,
        code: status === 401 ? 'UNAUTHENTICATED' : status === 403 ? 'FORBIDDEN' : status === 404 ? 'NOT_FOUND' : 'VALIDATION_ERROR',
        message: Array.isArray(message) ? message.join(', ') : message,
      });
    }

    this.logger.error(exception);
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      message: 'Có lỗi xảy ra, vui lòng thử lại sau',
    });
  }
}
