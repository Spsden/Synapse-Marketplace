import { ApiProperty } from '@nestjs/swagger';
import { IsObject } from 'class-validator';

export class ImportOfficialMcpServerRequestDto {
  @ApiProperty({
    description:
      'Official MCP Registry server.json document, preserved as upstream provenance.',
  })
  @IsObject()
  server: Record<string, unknown>;

  @ApiProperty({
    description:
      'Synapse review overlay containing the stable serverId, tools, auth policy, platforms, and reviewer identity.',
  })
  @IsObject()
  overlay: Record<string, unknown>;
}
