/**
 * ServiceNow Integration
 * Reads service requests/incidents related to data pipelines.
 */

export class ServiceNowConnector {
  constructor(private config: { instance: string; credentials_ref: string }) {}

  async fetchDataRequests(): Promise<any[]> {
    console.log(`[ServiceNow] Fetching data requests from ${this.config.instance}`);
    return [];
  }
}
