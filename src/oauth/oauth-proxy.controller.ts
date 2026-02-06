import {
  Controller,
  Post,
  Get,
  Put,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  Headers,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiHeader,
  ApiBody,
  ApiResponse,
} from '@nestjs/swagger';
import { OAuthProxyService } from './oauth-proxy.service';
import { OAuthProvider } from '../common/enums/oauth-provider.enum';

/**
 * Generic proxy request body.
 */
interface ProxyRequestBody {
  body?: any;
}

/**
 * OAuth Proxy Controller - Proxies API requests to providers with authentication.
 *
 * This controller allows the frontend or plugins to make authenticated API calls
 * to OAuth providers without handling tokens directly. The backend injects the
 * user's stored OAuth access token into the request.
 *
 * Routes:
 * - POST /api/v1/proxy/:provider - Generic proxy endpoint
 * - GET /api/v1/proxy/:provider/* - GET proxy with path
 * - POST /api/v1/proxy/:provider/* - POST proxy with path
 * - PUT /api/v1/proxy/:provider/* - PUT proxy with path
 * - PATCH /api/v1/proxy/:provider/* - PATCH proxy with path
 * - DELETE /api/v1/proxy/:provider/* - DELETE proxy with path
 */
@ApiTags('OAuth Proxy')
@Controller('api/v1/proxy')
export class OAuthProxyController {
  constructor(private readonly proxyService: OAuthProxyService) {}

  /**
   * Generic proxy endpoint for all HTTP methods.
   *
   * The HTTP method is specified via X-HTTP-Method-Override header.
   *
   * @param provider OAuth provider
   * @param path API path
   * @param method HTTP method override
   * @param userId User ID (from query)
   * @param pluginId Plugin ID (from query)
   * @param body Request body
   * @param headers Request headers
   */
  @ApiOperation({
    summary: 'Proxy API request to provider',
    description: `Make an authenticated API request to a provider.
                 The access token is automatically injected from the user's stored OAuth tokens.
                 Use the X-HTTP-Method-Override header to specify the HTTP method.`,
  })
  @ApiParam({
    name: 'provider',
    description: 'OAuth provider name',
    enum: Object.values(OAuthProvider),
    example: OAuthProvider.NOTION,
  })
  @ApiParam({
    name: 'path',
    description: 'API path (e.g., users/me, databases/query)',
    example: 'users/me',
  })
  @ApiQuery({
    name: 'user_id',
    description: 'User ID making the request',
    type: String,
    required: true,
    example: 'user_abc123',
  })
  @ApiQuery({
    name: 'plugin_id',
    description: 'Plugin ID making the request',
    type: String,
    required: true,
    example: 'plugin_xyz789',
  })
  @ApiHeader({
    name: 'X-HTTP-Method-Override',
    description: 'HTTP method (GET, POST, PUT, PATCH, DELETE)',
    required: false,
    example: 'POST',
  })
  @ApiBody({
    description: 'Request body (for POST, PUT, PATCH requests)',
    required: false,
    type: 'object',
  })
  @ApiResponse({
    status: 200,
    description: 'Provider API response',
  })
  @ApiResponse({ status: 401, description: 'No valid OAuth token found' })
  @Post(':provider/*')
  @HttpCode(HttpStatus.OK)
  async proxy(
    @Param('provider') provider: string,
    @Param('0') path: string,
    @Headers('x-http-method-override') methodOverride: string = 'POST',
    @Query('user_id') userId: string,
    @Query('plugin_id') pluginId: string,
    @Body() body: ProxyRequestBody = {},
  ): Promise<any> {
    const options: any = {
      method: methodOverride.toUpperCase(),
      body: body.body,
    };

    return this.proxyService.proxyRequest(userId, pluginId, provider as OAuthProvider, `/${path}`, options);
  }

  /**
   * GET proxy endpoint.
   */
  @ApiOperation({ summary: 'GET proxy request' })
  @ApiParam({ name: 'provider', enum: Object.values(OAuthProvider) })
  @ApiParam({ name: 'path', description: 'API path' })
  @ApiQuery({ name: 'user_id', type: String, required: true })
  @ApiQuery({ name: 'plugin_id', type: String, required: true })
  @Get(':provider/*')
  async proxyGet(
    @Param('provider') provider: string,
    @Param('0') path: string,
    @Query('user_id') userId: string,
    @Query('plugin_id') pluginId: string,
    @Query() params: Record<string, string>,
  ): Promise<any> {
    return this.proxyService.get(userId, pluginId, provider as OAuthProvider, `/${path}`, params);
  }

  /**
   * POST proxy endpoint.
   */
  @ApiOperation({ summary: 'POST proxy request' })
  @ApiParam({ name: 'provider', enum: Object.values(OAuthProvider) })
  @ApiParam({ name: 'path', description: 'API path' })
  @ApiQuery({ name: 'user_id', type: String, required: true })
  @ApiQuery({ name: 'plugin_id', type: String, required: true })
  @ApiBody({ type: 'object' })
  @Post(':provider/post/*')
  @HttpCode(HttpStatus.OK)
  async proxyPost(
    @Param('provider') provider: string,
    @Param('0') path: string,
    @Query('user_id') userId: string,
    @Query('plugin_id') pluginId: string,
    @Body() body: any,
  ): Promise<any> {
    return this.proxyService.post(userId, pluginId, provider as OAuthProvider, `/${path}`, body);
  }

  /**
   * PUT proxy endpoint.
   */
  @ApiOperation({ summary: 'PUT proxy request' })
  @ApiParam({ name: 'provider', enum: Object.values(OAuthProvider) })
  @ApiParam({ name: 'path', description: 'API path' })
  @ApiQuery({ name: 'user_id', type: String, required: true })
  @ApiQuery({ name: 'plugin_id', type: String, required: true })
  @ApiBody({ type: 'object' })
  @Put(':provider/*')
  async proxyPut(
    @Param('provider') provider: string,
    @Param('0') path: string,
    @Query('user_id') userId: string,
    @Query('plugin_id') pluginId: string,
    @Body() body: any,
  ): Promise<any> {
    return this.proxyService.put(userId, pluginId, provider as OAuthProvider, `/${path}`, body);
  }

  /**
   * PATCH proxy endpoint.
   */
  @ApiOperation({ summary: 'PATCH proxy request' })
  @ApiParam({ name: 'provider', enum: Object.values(OAuthProvider) })
  @ApiParam({ name: 'path', description: 'API path' })
  @ApiQuery({ name: 'user_id', type: String, required: true })
  @ApiQuery({ name: 'plugin_id', type: String, required: true })
  @ApiBody({ type: 'object' })
  @Patch(':provider/*')
  async proxyPatch(
    @Param('provider') provider: string,
    @Param('0') path: string,
    @Query('user_id') userId: string,
    @Query('plugin_id') pluginId: string,
    @Body() body: any,
  ): Promise<any> {
    return this.proxyService.patch(userId, pluginId, provider as OAuthProvider, `/${path}`, body);
  }

  /**
   * DELETE proxy endpoint.
   */
  @ApiOperation({ summary: 'DELETE proxy request' })
  @ApiParam({ name: 'provider', enum: Object.values(OAuthProvider) })
  @ApiParam({ name: 'path', description: 'API path' })
  @ApiQuery({ name: 'user_id', type: String, required: true })
  @ApiQuery({ name: 'plugin_id', type: String, required: true })
  @Delete(':provider/*')
  @HttpCode(HttpStatus.OK)
  async proxyDelete(
    @Param('provider') provider: string,
    @Param('0') path: string,
    @Query('user_id') userId: string,
    @Query('plugin_id') pluginId: string,
    @Query() params: Record<string, string>,
  ): Promise<any> {
    return this.proxyService.delete(userId, pluginId, provider as OAuthProvider, `/${path}`, params);
  }
}
