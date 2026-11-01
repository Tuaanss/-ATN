import { HttpStatus, PipeTransform } from '@nestjs/common';
import { ZodType } from 'zod';
import { AppException } from '../errors/app-exception';

/** Kiểm tra body/query bằng Zod; lỗi trả VALIDATION_ERROR kèm danh sách trường. */
export class ZodPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T>) {}

  transform(value: unknown): T {
    const parsed = this.schema.safeParse(value);
    if (!parsed.success) {
      const details = parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
      throw new AppException('VALIDATION_ERROR', details[0]?.message ?? 'Dữ liệu không hợp lệ', HttpStatus.BAD_REQUEST, details);
    }
    return parsed.data;
  }
}
