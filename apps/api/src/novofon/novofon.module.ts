import { Global, Module } from '@nestjs/common';
import { NovofonService } from './novofon.service';

@Global()
@Module({
  providers: [NovofonService],
  exports: [NovofonService],
})
export class NovofonModule {}
