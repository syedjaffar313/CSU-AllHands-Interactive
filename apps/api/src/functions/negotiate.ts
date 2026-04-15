import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';

/**
 * SignalR negotiate endpoint.
 * Returns connection info for the "eventHub" hub.
 * Azure SignalR Serverless mode uses the extension bundle binding.
 */
app.http('negotiate', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'negotiate',
  handler: async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    try {
      // In serverless mode, we use the SignalR connection info input binding
      // The binding is configured via function.json / extraInputs
      // For SWA + Functions integration, we return the negotiate payload
      const connectionString = process.env.SIGNALR_CONNECTION_STRING;
      if (!connectionString) {
        return { status: 500, jsonBody: { error: 'SignalR not configured' } };
      }

      // Parse connection string to get endpoint and key
      const endpointMatch = connectionString.match(/Endpoint=([^;]+)/);
      const keyMatch = connectionString.match(/AccessKey=([^;]+)/);

      if (!endpointMatch || !keyMatch) {
        return { status: 500, jsonBody: { error: 'Invalid SignalR connection string' } };
      }

      const hubName = 'eventHub';
      const endpoint = endpointMatch[1].replace(/\/$/, '');
      const accessKey = keyMatch[1];

      // Build the access token (JWT) for the client
      const crypto = await import('crypto');
      const audience = `${endpoint}/client/?hub=${hubName}`;
      const expiry = Math.floor(Date.now() / 1000) + 3600; // 1 hour

      const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
      const payload = Buffer.from(
        JSON.stringify({ aud: audience, exp: expiry, iat: Math.floor(Date.now() / 1000) })
      ).toString('base64url');
      const signature = crypto
        .createHmac('sha256', accessKey)
        .update(`${header}.${payload}`)
        .digest('base64url');

      const token = `${header}.${payload}.${signature}`;

      return {
        status: 200,
        jsonBody: {
          url: audience,
          accessToken: token,
        },
        headers: { 'Content-Type': 'application/json' },
      };
    } catch (err) {
      context.error('negotiate error', err);
      return { status: 500, jsonBody: { error: 'Failed to negotiate' } };
    }
  },
});
