// main/google/calendar-api.ts
import { google, type calendar_v3 } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';

export class CalendarAPI {
  private calendar: calendar_v3.Calendar;

  constructor(auth: OAuth2Client) {
    this.calendar = google.calendar({ version: 'v3', auth });
  }

  async listEvents(calendarId: string, timeMin: string, timeMax: string, syncToken?: string) {
    const params: calendar_v3.Params$Resource$Events$List = {
      calendarId,
      maxResults: 2500,
      singleEvents: true,
      orderBy: 'startTime',
    };

    if (syncToken) {
      params.syncToken = syncToken;
    } else {
      params.timeMin = timeMin;
      params.timeMax = timeMax;
    }

    try {
      const res = await this.calendar.events.list(params);
      return {
        events: res.data.items ?? [],
        nextSyncToken: res.data.nextSyncToken ?? null,
        nextPageToken: res.data.nextPageToken ?? null,
      };
    } catch (err: any) {
      if (err.code === 410) {
        // syncToken expired — full sync needed
        return { events: [], nextSyncToken: null, nextPageToken: null, fullSyncRequired: true };
      }
      throw err;
    }
  }

  async createEvent(calendarId: string, event: {
    summary: string;
    start: { dateTime: string; timeZone?: string };
    end: { dateTime: string; timeZone?: string };
    description?: string;
    location?: string;
  }) {
    const res = await this.calendar.events.insert({
      calendarId,
      requestBody: event,
    });
    return res.data;
  }

  async updateEvent(calendarId: string, eventId: string, event: Partial<{
    summary: string;
    start: { dateTime: string; timeZone?: string };
    end: { dateTime: string; timeZone?: string };
    description: string;
    location: string;
  }>) {
    const res = await this.calendar.events.patch({
      calendarId,
      eventId,
      requestBody: event,
    });
    return res.data;
  }

  async deleteEvent(calendarId: string, eventId: string) {
    await this.calendar.events.delete({ calendarId, eventId });
  }
}
