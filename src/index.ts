import 'dotenv/config';

import { serve } from '@hono/node-server'
import { Hono } from 'hono';
import { discordAuth } from '@hono/oauth-providers/discord';
import { Redis } from '@upstash/redis';

// Types for Discord API responses
interface DiscordUser {
  id: string;
  username: string;
  discriminator: string;
  avatar: string | null;
  email?: string;
}

interface DiscordMessage {
  id: string;
  channel_id: string;
  content: string;
  attachments: DiscordAttachment[];
}

interface DiscordAttachment {
  id: string;
  filename: string;
  size: number;
  url: string;
  proxy_url: string;
  content_type?: string;
}

// Environment variables validation
const requiredEnvVars = [
  'DISCORD_CLIENT_ID',
  'DISCORD_CLIENT_SECRET',
  'DISCORD_BOT_TOKEN',
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

// Initialize Redis client
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Initialize Hono app
const app = new Hono();

// Home route with instructions
app.get('/', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>3DS Nand Storage Repository</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
            max-width: 800px;
            margin: 50px auto;
            padding: 20px;
            background-color: #1e1e1e;
            color: #e0e0e0;
          }
          .container {
            background-color: #2d2d2d;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.3);
            border: 1px solid #3d3d3d;
          }
          h1 {
            color: #5865F2;
            margin-top: 0;
          }
          h2 {
            color: #c9d1d9;
          }
          p, li {
            line-height: 1.6;
            color: #b3b3b3;
          }
          ol {
            padding-left: 24px;
          }
          .button {
            display: inline-block;
            background-color: #5865F2;
            color: white;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 4px;
            margin-top: 20px;
            font-weight: 500;
            transition: background-color 0.2s ease;
          }
          .button:hover {
            background-color: #4752C4;
          }
          code {
            background-color: #1a1a1a;
            color: #00d4aa;
            padding: 2px 6px;
            border-radius: 3px;
            font-family: 'Courier New', monospace;
          }
          .footer {
            position: fixed;
            bottom: 20px;
            right: 20px;
            font-size: 12px;
            color: #666;
          }
          .footer a {
            color: #5865F2;
            text-decoration: none;
          }
          .footer a:hover {
            text-decoration: underline;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>3DS Nand Storage Repository</h1>
          <p>This application allows you to retrieve your 3DS Nand Dump backup from our servers.</p>
          
          <a href="/auth/discord" class="button">Login with Discord</a>
        </div>
        <div class="footer">
          Powered by: <a href="https://github.com/RegularRabbit05/DiscordAuthenticatedFileProvider" target="_blank">DiscordAuthenticatedFileProvider</a>
        </div>
      </body>
    </html>
  `);
});

// Discord OAuth middleware
app.use(
  '/auth/discord',
  discordAuth({
    client_id: process.env.DISCORD_CLIENT_ID!,
    client_secret: process.env.DISCORD_CLIENT_SECRET!,
    scope: ['identify', 'email'],
    redirect_uri: `${process.env.BASE_URL || 'http://localhost:3000'}/auth/discord`,
  })
);

// Discord OAuth callback handler
app.get('/auth/discord', async (c) => {
  try {
    // Get the access token and user info from the OAuth provider
    const token = c.get('token');
    const user = c.get('user-discord') as DiscordUser;

    if (!user || !user.id) {
      return c.json({ error: 'Failed to get user information from Discord' }, 400);
    }

    const userId = user.id;
    console.log(`User authenticated: ${user.username} (${userId})`);

    // Fetch the message ID from Redis using the user ID
    const messageKey = `user:${userId}`;
    const messageData = await redis.get<string>(messageKey);

    if (!messageData) {
      return c.html(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>No Dump Found</title>
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
                max-width: 800px;
                margin: 50px auto;
                padding: 20px;
                background-color: #1e1e1e;
                color: #e0e0e0;
              }
              .container {
                background-color: #2d2d2d;
                padding: 30px;
                border-radius: 8px;
                box-shadow: 0 4px 6px rgba(0,0,0,0.3);
                border: 1px solid #3d3d3d;
              }
              h1 { 
                color: #ED4245; 
                margin-top: 0;
              }
              h3 {
                color: #c9d1d9;
              }
              p {
                line-height: 1.6;
                color: #b3b3b3;
              }
              strong {
                color: #e0e0e0;
              }
              code {
                background-color: #1a1a1a;
                color: #00d4aa;
                padding: 2px 6px;
                border-radius: 3px;
                font-family: 'Courier New', monospace;
              }
              .info {
                background-color: #3a3a1a;
                border: 1px solid #5a5a2a;
                padding: 15px;
                border-radius: 4px;
                margin: 20px 0;
              }
              a {
                color: #5865F2;
                text-decoration: none;
              }
              a:hover {
                text-decoration: underline;
              }
              .footer {
                position: fixed;
                bottom: 20px;
                right: 20px;
                font-size: 12px;
                color: #666;
              }
              .footer a {
                color: #5865F2;
                text-decoration: none;
              }
              .footer a:hover {
                text-decoration: underline;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>No Dump Found</h1>
              <p>Hello <strong>${user.username}</strong>!</p>
              <p>No Nand has been associated with your Discord account yet.</p>
              
              <div class="info">
                <strong>Your Discord User ID:</strong> <code>${userId}</code>
              </div>
              
              <p style="margin-top: 20px;"><a href="/">← Back to Home</a></p>
            </div>
            <div class="footer">
              Powered by: <a href="https://github.com/RegularRabbit05/DiscordAuthenticatedFileProvider" target="_blank">DiscordAuthenticatedFileProvider</a>
            </div>
          </body>
        </html>
      `);
    }

    // Parse the message data (format: "channelId:messageId")
    const [channelId, messageId] = messageData.split(':');

    if (!channelId || !messageId) {
      return c.json({ 
        error: 'Invalid message data format in Redis. Expected format: "channelId:messageId"' 
      }, 500);
    }

    console.log(`Fetching message ${messageId} from channel ${channelId}`);

    // Fetch the message from Discord API using the bot token
    const discordApiUrl = `https://discord.com/api/v10/channels/${channelId}/messages/${messageId}`;
    const discordResponse = await fetch(discordApiUrl, {
      headers: {
        'Authorization': `Bot ${process.env.DISCORD_BOT_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });

    if (!discordResponse.ok) {
      const errorText = await discordResponse.text();
      console.error(`Discord API error: ${discordResponse.status} - ${errorText}`);
      return c.json({ 
        error: 'Failed to fetch message from Discord',
        details: errorText,
        status: discordResponse.status
      }, 500);
    }

    const message = await discordResponse.json() as DiscordMessage;

    // Check if the message has attachments
    if (!message.attachments || message.attachments.length === 0) {
      return c.html(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>No Attachments Found</title>
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
                max-width: 800px;
                margin: 50px auto;
                padding: 20px;
                background-color: #1e1e1e;
                color: #e0e0e0;
              }
              .container {
                background-color: #2d2d2d;
                padding: 30px;
                border-radius: 8px;
                box-shadow: 0 4px 6px rgba(0,0,0,0.3);
                border: 1px solid #3d3d3d;
              }
              h1 { 
                color: #FAA61A;
                margin-top: 0;
              }
              p {
                line-height: 1.6;
                color: #b3b3b3;
              }
              a {
                color: #5865F2;
                text-decoration: none;
              }
              a:hover {
                text-decoration: underline;
              }
              .footer {
                position: fixed;
                bottom: 20px;
                right: 20px;
                font-size: 12px;
                color: #666;
              }
              .footer a {
                color: #5865F2;
                text-decoration: none;
              }
              .footer a:hover {
                text-decoration: underline;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>No Attachments Found</h1>
              <p>The message associated with your account doesn't have any Nand dump.</p>
              <p style="margin-top: 20px;"><a href="/">← Back to Home</a></p>
            </div>
            <div class="footer">
              Powered by: <a href="https://github.com/RegularRabbit05/DiscordAuthenticatedFileProvider" target="_blank">DiscordAuthenticatedFileProvider</a>
            </div>
          </body>
        </html>
      `);
    }

    // Get the first attachment
    const attachment = message.attachments[0];
    console.log(`Found attachment: ${attachment.filename} (${attachment.size} bytes)`);

    // Redirect to the attachment URL
    return c.redirect(attachment.url);

  } catch (error) {
    console.error('Error processing request:', error);
    return c.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// Start the server
const port = parseInt(process.env.PORT || '3000');
console.log(`Server is running on http://localhost:${port}`);

export default {
  port,
  fetch: app.fetch,
};
