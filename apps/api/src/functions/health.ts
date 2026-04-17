import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';

/** GET /api/health – simple health check (no external dependencies) */
app.http('health', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'health',
  handler: async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    return {
      status: 200,
      jsonBody: {
        status: 'ok',
        timestamp: new Date().toISOString(),
        env: {
          hasStorageConnectionString: !!process.env.STORAGE_CONNECTION_STRING,
          hasStorageAccountUrl: !!process.env.STORAGE_ACCOUNT_URL,
          hasSignalR: !!process.env.SIGNALR_CONNECTION_STRING,
          hasIdentityEndpoint: !!process.env.IDENTITY_ENDPOINT,
          nodeVersion: process.version,
        },
      },
    };
  },
});
