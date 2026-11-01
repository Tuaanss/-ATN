import { Global, Module } from '@nestjs/common';
import { DriveService } from './drive/drive.service';
import { StorageService } from './storage/storage.service';
import { MailService } from './mail/mail.service';

@Global()
@Module({
  providers: [DriveService, StorageService, MailService],
  exports: [DriveService, StorageService, MailService],
})
export class InfraModule {}
