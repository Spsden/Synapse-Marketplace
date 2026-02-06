import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { OAuthProvider } from '../common/enums/oauth-provider.enum';
import { OAuthTokensRepository } from './oauth-tokens.repository';
import axios, { AxiosRequestConfig, AxiosResponse, Method } from 'axios';
import { getProviderConfig } from './oauth-provider.config';

/**
 * Proxy request options.
 */
export interface ProxyRequestOptions {
  /** HTTP method */
  method?: Method;

  /** Request headers (will be merged with auth header) */
  headers?: Record<string, string>;

  /** Request body */
  body?: any;

  /** Query parameters */
  params?: Record<string, string | number>;

  /** Content type for body */
  contentType?: 'application/json' | 'application/x-www-form-urlencoded' | 'multipart/form-data';
}

/**
 * Proxy response result.
 */
export interface ProxyResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  data: any;
}

/**
 * OAuth Proxy Service - Makes authenticated API calls to providers.
 *
 * This service acts as a proxy, injecting the user's OAuth access token
 * into requests to the provider's API. This keeps tokens secure on the
 * backend and never exposes them to the client.
 *
 * Supported providers: Notion, Google, GitHub, Slack, etc.
 */
@Injectable()
export class OAuthProxyService {
  private readonly logger = new Logger(OAuthProxyService.name);

  // Base URLs for common provider APIs
  private readonly providerBaseUrls: Record<OAuthProvider, string> = {
    [OAuthProvider.NOTION]: 'https://api.notion.com/v1',
    [OAuthProvider.GOOGLE]: 'https://www.googleapis.com',
    [OAuthProvider.GITHUB]: 'https://api.github.com',
    [OAuthProvider.SLACK]: 'https://slack.com/api',
    [OAuthProvider.MICROSOFT]: 'https://graph.microsoft.com/v1.0',
    [OAuthProvider.DISCORD]: 'https://discord.com/api/v10',
    [OAuthProvider.LINEAR]: 'https://api.linear.app/v1',
    [OAuthProvider.FIGMA]: 'https://api.figma.com/v1',
    [OAuthProvider.SALESFORCE]: '', // Instance-specific
    [OAuthProvider.DROPBOX]: 'https://api.dropboxapi.com/2',
    [OAuthProvider.STRIPE]: 'https://api.stripe.com/v1',
  };

  constructor(private oauthTokensRepository: OAuthTokensRepository) {}

  /**
   * Make an authenticated API call to a provider on behalf of a user.
   *
   * @param userId User ID
   * @param pluginId Plugin ID
   * @param provider OAuth provider
   * @param path API path (e.g., '/users/me', '/databases/query')
   * @param options Request options
   * @returns Provider API response
   */
  async proxyRequest(
    userId: string,
    pluginId: string,
    provider: OAuthProvider,
    path: string,
    options: ProxyRequestOptions = {},
  ): Promise<ProxyResponse> {
    const { method = 'GET', headers = {}, body, params, contentType = 'application/json' } = options;

    this.logger.debug(`Proxying ${method} ${provider} request for user ${userId}`);

    // Get the access token
    const accessToken = await this.oauthTokensRepository.getAccessToken(userId, pluginId, provider);

    if (!accessToken) {
      throw new HttpException(
        'No valid OAuth token found. Please authenticate first.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const config = getProviderConfig(provider);
    const baseUrl = this.providerBaseUrls[provider];

    // Build the full URL
    let url = `${baseUrl}${path}`;

    // Add query parameters
    if (params && Object.keys(params).length > 0) {
      const searchParams = new URLSearchParams();
      for (const [key, value] of Object.entries(params)) {
        searchParams.append(key, String(value));
      }
      url += `?${searchParams.toString()}`;
    }

    // Build request config
    const axiosConfig: AxiosRequestConfig = {
      method,
      url,
      headers: {
        ...this.getDefaultHeaders(provider, contentType),
        ...headers,
      },
    };

    // Set authorization header based on provider format
    if (config.authHeaderFormat === 'Bearer') {
      axiosConfig.headers['Authorization'] = `Bearer ${accessToken}`;
    } else if (config.authHeaderFormat === 'token') {
      axiosConfig.headers['Authorization'] = `token ${accessToken}`;
    } else if (config.authHeaderFormat === 'OAuth') {
      axiosConfig.headers['Authorization'] = `OAuth ${accessToken}`;
    }

    // Add body for POST/PUT/PATCH requests
    if (body && ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
      if (contentType === 'application/json') {
        axiosConfig.data = JSON.stringify(body);
      } else if (contentType === 'application/x-www-form-urlencoded') {
        const formData = new URLSearchParams();
        for (const [key, value] of Object.entries(body)) {
          formData.append(key, String(value));
        }
        axiosConfig.data = formData.toString();
      } else {
        axiosConfig.data = body;
      }
    }

    try {
      const response: AxiosResponse = await axios(axiosConfig);

      return {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers as Record<string, string>,
        data: response.data,
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as any;

        // Token might be expired
        if (axiosError.response?.status === 401) {
          throw new HttpException(
            'OAuth token expired or invalid. Please re-authenticate.',
            HttpStatus.UNAUTHORIZED,
          );
        }

        // Proxy provider error response
        throw new HttpException(
          axiosError.response?.data || 'Provider API error',
          axiosError.response?.status || HttpStatus.BAD_GATEWAY,
        );
      }

      throw new HttpException(
        `Proxy request failed: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Make a GET request.
   */
  async get(
    userId: string,
    pluginId: string,
    provider: OAuthProvider,
    path: string,
    params?: Record<string, string | number>,
    headers?: Record<string, string>,
  ): Promise<ProxyResponse> {
    return this.proxyRequest(userId, pluginId, provider, path, {
      method: 'GET',
      params,
      headers,
    });
  }

  /**
   * Make a POST request.
   */
  async post(
    userId: string,
    pluginId: string,
    provider: OAuthProvider,
    path: string,
    body?: any,
    headers?: Record<string, string>,
  ): Promise<ProxyResponse> {
    return this.proxyRequest(userId, pluginId, provider, path, {
      method: 'POST',
      body,
      headers,
    });
  }

  /**
   * Make a PUT request.
   */
  async put(
    userId: string,
    pluginId: string,
    provider: OAuthProvider,
    path: string,
    body?: any,
    headers?: Record<string, string>,
  ): Promise<ProxyResponse> {
    return this.proxyRequest(userId, pluginId, provider, path, {
      method: 'PUT',
      body,
      headers,
    });
  }

  /**
   * Make a PATCH request.
   */
  async patch(
    userId: string,
    pluginId: string,
    provider: OAuthProvider,
    path: string,
    body?: any,
    headers?: Record<string, string>,
  ): Promise<ProxyResponse> {
    return this.proxyRequest(userId, pluginId, provider, path, {
      method: 'PATCH',
      body,
      headers,
    });
  }

  /**
   * Make a DELETE request.
   */
  async delete(
    userId: string,
    pluginId: string,
    provider: OAuthProvider,
    path: string,
    params?: Record<string, string | number>,
    headers?: Record<string, string>,
  ): Promise<ProxyResponse> {
    return this.proxyRequest(userId, pluginId, provider, path, {
      method: 'DELETE',
      params,
      headers,
    });
  }

  /**
   * Get default headers for a provider.
   */
  private getDefaultHeaders(
    provider: OAuthProvider,
    contentType: string,
  ): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': contentType,
    };

    // Notion requires specific version header
    if (provider === OAuthProvider.NOTION) {
      headers['Notion-Version'] = '2022-06-28';
    }

    // GitHub requires user agent
    if (provider === OAuthProvider.GITHUB) {
      headers['User-Agent'] = 'Synapse-OAuth-Proxy/1.0';
    }

    // Figma requires specific headers
    if (provider === OAuthProvider.FIGMA) {
      headers['X-Figma-Token'] = '{access_token}'; // Placeholder, will be replaced
    }

    return headers;
  }
}
