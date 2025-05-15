import { PaginatedResponseDto } from '@common/dto/responses/pagination.response.dto'
import { ApiProperty } from '@nestjs/swagger'
import { EntityDto } from './fetch_account.response.dto'

export class FetchAccountEntitiesResponseDto extends PaginatedResponseDto<EntityDto> {
  @ApiProperty({
    description: 'List of entities',
    type: [EntityDto],
    isArray: true
  })
  items: EntityDto[]
}
