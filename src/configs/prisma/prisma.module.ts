/**
 * Resources
 */
import { Global, Module } from '@nestjs/common'

/**
 * Dependencies
 */
import { PrismaService } from '@configs/prisma/prisma.service'

/**
 * Declaration
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService]
})
export class PrismaModule {}
