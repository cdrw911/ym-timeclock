import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google } from 'googleapis';
import { Client as NotionClient } from '@notionhq/client';

@Injectable()
export class IntegrationsService {
  private readonly logger = new Logger(IntegrationsService.name);
  private calendarClient: any;
  private driveClient: any;
  private notionClient: NotionClient | null = null;

  constructor(private readonly configService: ConfigService) {
    this.initializeGoogleClients();
    this.initializeNotionClient();
  }

  /**
   * Initialize Google API clients
   */
  private initializeGoogleClients() {
    try {
      const email = this.configService.get<string>('GOOGLE_SERVICE_ACCOUNT_EMAIL');
      const privateKey = this.configService.get<string>('GOOGLE_PRIVATE_KEY');

      if (!email || !privateKey) {
        this.logger.warn('Google credentials not configured');
        return;
      }

      const auth = new google.auth.JWT({
        email,
        key: privateKey.replace(/\\n/g, '\n'),
        scopes: [
          'https://www.googleapis.com/auth/calendar',
          'https://www.googleapis.com/auth/drive',
        ],
      });

      this.calendarClient = google.calendar({ version: 'v3', auth });
      this.driveClient = google.drive({ version: 'v3', auth });

      this.logger.log('Google API clients initialized');
    } catch (error) {
      this.logger.error(`Failed to initialize Google clients: ${error.message}`);
    }
  }

  /**
   * Initialize Notion client
   */
  private initializeNotionClient() {
    try {
      const apiKey = this.configService.get<string>('NOTION_API_KEY');

      if (!apiKey) {
        this.logger.warn('Notion API key not configured');
        return;
      }

      this.notionClient = new NotionClient({ auth: apiKey });
      this.logger.log('Notion client initialized');
    } catch (error) {
      this.logger.error(`Failed to initialize Notion client: ${error.message}`);
    }
  }

  /**
   * Create Google Calendar event
   */
  async createCalendarEvent(params: {
    title: string;
    description: string;
    startTime: Date;
    endTime: Date;
    attendees?: string[];
  }): Promise<string | null> {
    if (!this.calendarClient) {
      this.logger.warn('Calendar client not available');
      return null;
    }

    try {
      const calendarId = this.configService.get<string>('GOOGLE_CALENDAR_ID');

      const event = {
        summary: params.title,
        description: params.description,
        start: {
          dateTime: params.startTime.toISOString(),
          timeZone: 'Asia/Taipei',
        },
        end: {
          dateTime: params.endTime.toISOString(),
          timeZone: 'Asia/Taipei',
        },
        attendees: params.attendees?.map((email) => ({ email })) || [],
      };

      const response = await this.calendarClient.events.insert({
        calendarId,
        requestBody: event,
      });

      this.logger.log(`Calendar event created: ${response.data.id}`);
      return response.data.id;
    } catch (error) {
      this.logger.error(`Failed to create calendar event: ${error.message}`);
      return null;
    }
  }

  /**
   * Update Google Calendar event
   */
  async updateCalendarEvent(
    eventId: string,
    params: {
      title?: string;
      description?: string;
      startTime?: Date;
      endTime?: Date;
    },
  ): Promise<boolean> {
    if (!this.calendarClient) {
      return false;
    }

    try {
      const calendarId = this.configService.get<string>('GOOGLE_CALENDAR_ID');

      const event: any = {};
      if (params.title) event.summary = params.title;
      if (params.description) event.description = params.description;
      if (params.startTime) {
        event.start = {
          dateTime: params.startTime.toISOString(),
          timeZone: 'Asia/Taipei',
        };
      }
      if (params.endTime) {
        event.end = {
          dateTime: params.endTime.toISOString(),
          timeZone: 'Asia/Taipei',
        };
      }

      await this.calendarClient.events.patch({
        calendarId,
        eventId,
        requestBody: event,
      });

      this.logger.log(`Calendar event updated: ${eventId}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to update calendar event: ${error.message}`);
      return false;
    }
  }

  /**
   * Delete Google Calendar event
   */
  async deleteCalendarEvent(eventId: string): Promise<boolean> {
    if (!this.calendarClient) {
      return false;
    }

    try {
      const calendarId = this.configService.get<string>('GOOGLE_CALENDAR_ID');

      await this.calendarClient.events.delete({
        calendarId,
        eventId,
      });

      this.logger.log(`Calendar event deleted: ${eventId}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to delete calendar event: ${error.message}`);
      return false;
    }
  }

  /**
   * Upload file to Google Drive
   */
  async uploadToDrive(params: {
    fileName: string;
    mimeType: string;
    buffer: Buffer;
  }): Promise<string | null> {
    if (!this.driveClient) {
      this.logger.warn('Drive client not available');
      return null;
    }

    try {
      const folderId = this.configService.get<string>('GOOGLE_DRIVE_FOLDER_ID');

      const response = await this.driveClient.files.create({
        requestBody: {
          name: params.fileName,
          parents: [folderId],
        },
        media: {
          mimeType: params.mimeType,
          body: params.buffer,
        },
      });

      this.logger.log(`File uploaded to Drive: ${response.data.id}`);
      return response.data.id;
    } catch (error) {
      this.logger.error(`Failed to upload to Drive: ${error.message}`);
      return null;
    }
  }

  /**
   * Create Notion leave record
   */
  async createNotionLeave(params: {
    employeeName: string;
    type: string;
    startDate: Date;
    endDate: Date;
    reason: string;
    status: string;
  }): Promise<string | null> {
    if (!this.notionClient) {
      this.logger.warn('Notion client not available');
      return null;
    }

    try {
      const databaseId = this.configService.get<string>('NOTION_DATABASE_ID');

      const response = await this.notionClient.pages.create({
        parent: { database_id: databaseId },
        properties: {
          Name: {
            title: [
              {
                text: {
                  content: `${params.employeeName} - ${params.type}`,
                },
              },
            ],
          },
          Employee: {
            rich_text: [{ text: { content: params.employeeName } }],
          },
          Type: {
            select: { name: params.type },
          },
          'Start Date': {
            date: { start: params.startDate.toISOString().split('T')[0] },
          },
          'End Date': {
            date: { start: params.endDate.toISOString().split('T')[0] },
          },
          Reason: {
            rich_text: [{ text: { content: params.reason } }],
          },
          Status: {
            select: { name: params.status },
          },
        },
      });

      this.logger.log(`Notion page created: ${response.id}`);
      return response.id;
    } catch (error) {
      this.logger.error(`Failed to create Notion page: ${error.message}`);
      return null;
    }
  }

  /**
   * Update Notion leave record
   */
  async updateNotionLeave(
    pageId: string,
    status: string,
  ): Promise<boolean> {
    if (!this.notionClient) {
      return false;
    }

    try {
      await this.notionClient.pages.update({
        page_id: pageId,
        properties: {
          Status: {
            select: { name: status },
          },
        },
      });

      this.logger.log(`Notion page updated: ${pageId}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to update Notion page: ${error.message}`);
      return false;
    }
  }
}
