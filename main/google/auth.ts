// main/google/auth.ts
import { BrowserWindow } from 'electron';
import { google } from 'googleapis';
import type Database from 'better-sqlite3';
import { v4 as uuid } from 'uuid';
import type { Statements } from '../db/statements';

const SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/userinfo.email',
];

export class GoogleAuth {
  private oauth2Client;

  constructor(
    private db: Database.Database,
    private stmts: Statements,
  ) {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      'http://localhost:3333/callback'
    );
  }

  async startAuth(): Promise<{ id: string; email: string }> {
    const authUrl = this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      prompt: 'consent',
    });

    const code = await this.openAuthWindow(authUrl);
    const { tokens } = await this.oauth2Client.getToken(code);
    this.oauth2Client.setCredentials(tokens);

    // Get user email
    const oauth2 = google.oauth2({ version: 'v2', auth: this.oauth2Client });
    const { data } = await oauth2.userinfo.get();
    const email = data.email!;

    // Save to DB
    const id = uuid();
    const expiry = tokens.expiry_date
      ? new Date(tokens.expiry_date).toISOString()
      : new Date(Date.now() + 3600 * 1000).toISOString();

    this.stmts.upsertGoogleAccount.run(
      id, email,
      tokens.access_token ?? '',
      tokens.refresh_token ?? '',
      expiry,
      JSON.stringify(['primary'])
    );

    return { id, email };
  }

  private openAuthWindow(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const win = new BrowserWindow({
        width: 500,
        height: 700,
        webPreferences: { nodeIntegration: false, contextIsolation: true },
      });

      win.loadURL(url);

      win.webContents.on('will-redirect', (_event, redirectUrl) => {
        const parsed = new URL(redirectUrl);
        const code = parsed.searchParams.get('code');
        if (code) {
          resolve(code);
          win.close();
        }
        const error = parsed.searchParams.get('error');
        if (error) {
          reject(new Error(`OAuth error: ${error}`));
          win.close();
        }
      });

      win.on('closed', () => {
        reject(new Error('Auth window closed'));
      });
    });
  }

  getClient(accountId: string) {
    const account = this.stmts.getGoogleAccount.get(accountId) as any;
    if (!account) throw new Error(`Account not found: ${accountId}`);

    const client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      'http://localhost:3333/callback'
    );

    client.setCredentials({
      access_token: account.access_token,
      refresh_token: account.refresh_token,
      expiry_date: new Date(account.token_expiry).getTime(),
    });

    // Auto-refresh: save new tokens
    client.on('tokens', (tokens) => {
      const expiry = tokens.expiry_date
        ? new Date(tokens.expiry_date).toISOString()
        : new Date(Date.now() + 3600 * 1000).toISOString();

      this.db.prepare(
        'UPDATE google_accounts SET access_token = ?, token_expiry = ? WHERE id = ?'
      ).run(tokens.access_token ?? account.access_token, expiry, accountId);
    });

    return client;
  }

  getAccounts() {
    return this.stmts.listGoogleAccounts.all();
  }

  removeAccount(accountId: string) {
    this.stmts.deleteEventsByAccount.run(accountId);
    this.stmts.deleteGoogleAccount.run(accountId);
  }
}
