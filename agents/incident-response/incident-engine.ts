/**
 * EADD Incident Response Engine
 * 
 * Auto-detect → Create ticket → Notify on-call → Escalate → Resolve
 * 
 * Section 13.1 of requirements.
 */

export type Severity = 'critical' | 'high' | 'medium' | 'low';
export type IncidentStatus = 'detected' | 'notified' | 'acknowledged' | 'investigating' | 'resolved' | 'escalated';

export interface Incident {
  id: string;
  title: string;
  severity: Severity;
  status: IncidentStatus;
  /** What broke */
  affectedPipeline: string;
  affectedTables: string[];
  /** Root cause analysis (plain language) */
  rootCause: string;
  /** Blast radius (from lineage) */
  blastRadius: { pipelines: number; tables: number; dataProducts: number; teams: string[] };
  /** Auto-generated summary for the responder */
  summary: string;
  /** Notifications sent */
  notifications: Notification[];
  /** Escalation timeline */
  escalations: Escalation[];
  /** Resolution */
  resolvedAt?: string;
  resolvedBy?: string;
  resolution?: string;
  /** Timestamps */
  detectedAt: string;
  acknowledgedAt?: string;
}

export interface Notification {
  channel: 'slack' | 'teams' | 'email' | 'pagerduty' | 'phone';
  recipient: string;
  sentAt: string;
  acknowledged: boolean;
  acknowledgedAt?: string;
}

export interface Escalation {
  level: number;
  escalatedTo: string;
  escalatedAt: string;
  reason: string;
}

export interface OnCallSchedule {
  primary: { name: string; email: string; phone: string; slack: string };
  secondary: { name: string; email: string; phone: string; slack: string };
  manager: { name: string; email: string };
  /** Escalation timeout (minutes) */
  escalationTimeoutMinutes: number;
}

export class IncidentResponseEngine {
  private incidents: Map<string, Incident> = new Map();
  private onCallSchedule: OnCallSchedule | null = null;

  /** Detect and create incident automatically */
  createIncident(params: {
    pipeline: string;
    failureType: string;
    errorMessage: string;
    affectedTables: string[];
    blastRadius: Incident['blastRadius'];
  }): Incident {
    const severity = this.classifySeverity(params.blastRadius);
    const rootCause = this.analyzeRootCause(params.failureType, params.errorMessage);

    const incident: Incident = {
      id: `INC-${Date.now()}`,
      title: `Pipeline failure: ${params.pipeline}`,
      severity,
      status: 'detected',
      affectedPipeline: params.pipeline,
      affectedTables: params.affectedTables,
      rootCause,
      blastRadius: params.blastRadius,
      summary: this.generateSummary(params, severity, rootCause),
      notifications: [],
      escalations: [],
      detectedAt: new Date().toISOString(),
    };

    this.incidents.set(incident.id, incident);

    // Auto-notify based on severity
    this.notifyOnCall(incident);

    return incident;
  }

  /** Notify the right people based on severity */
  private notifyOnCall(incident: Incident): void {
    if (!this.onCallSchedule) return;

    switch (incident.severity) {
      case 'critical':
        // Page primary on-call immediately (phone + Slack + PagerDuty)
        incident.notifications.push(
          { channel: 'pagerduty', recipient: this.onCallSchedule.primary.name, sentAt: new Date().toISOString(), acknowledged: false },
          { channel: 'slack', recipient: this.onCallSchedule.primary.slack, sentAt: new Date().toISOString(), acknowledged: false },
        );
        break;
      case 'high':
        // Slack + email to primary
        incident.notifications.push(
          { channel: 'slack', recipient: this.onCallSchedule.primary.slack, sentAt: new Date().toISOString(), acknowledged: false },
          { channel: 'email', recipient: this.onCallSchedule.primary.email, sentAt: new Date().toISOString(), acknowledged: false },
        );
        break;
      case 'medium':
        // Slack only
        incident.notifications.push(
          { channel: 'slack', recipient: this.onCallSchedule.primary.slack, sentAt: new Date().toISOString(), acknowledged: false },
        );
        break;
      case 'low':
        // Email only (non-urgent)
        incident.notifications.push(
          { channel: 'email', recipient: this.onCallSchedule.primary.email, sentAt: new Date().toISOString(), acknowledged: false },
        );
        break;
    }

    incident.status = 'notified';
  }

  /** Auto-escalate if not acknowledged within timeout */
  checkEscalation(incidentId: string): void {
    const incident = this.incidents.get(incidentId);
    if (!incident || !this.onCallSchedule) return;
    if (incident.status === 'acknowledged' || incident.status === 'resolved') return;

    const detectedTime = new Date(incident.detectedAt).getTime();
    const elapsed = (Date.now() - detectedTime) / 60000; // minutes

    if (elapsed > this.onCallSchedule.escalationTimeoutMinutes && incident.escalations.length === 0) {
      // Escalate to secondary
      incident.escalations.push({
        level: 2,
        escalatedTo: this.onCallSchedule.secondary.name,
        escalatedAt: new Date().toISOString(),
        reason: `Primary on-call (${this.onCallSchedule.primary.name}) did not acknowledge within ${this.onCallSchedule.escalationTimeoutMinutes} minutes`,
      });
      incident.status = 'escalated';
    }
  }

  private classifySeverity(blastRadius: Incident['blastRadius']): Severity {
    if (blastRadius.dataProducts > 0) return 'critical';
    if (blastRadius.pipelines > 5 || blastRadius.teams.length > 2) return 'high';
    if (blastRadius.pipelines > 1) return 'medium';
    return 'low';
  }

  private analyzeRootCause(failureType: string, errorMessage: string): string {
    // Pattern-based root cause analysis
    if (errorMessage.includes('timeout')) return 'Source system timeout — likely under heavy load or network issue';
    if (errorMessage.includes('schema')) return 'Schema drift detected — source schema changed without updating the pipeline';
    if (errorMessage.includes('null') || errorMessage.includes('constraint')) return 'Data quality issue — unexpected nulls or constraint violation in source data';
    if (errorMessage.includes('permission') || errorMessage.includes('access denied')) return 'Permission issue — credentials may have expired or been revoked';
    if (errorMessage.includes('disk') || errorMessage.includes('storage')) return 'Storage capacity exceeded — need to clean up or expand';
    if (errorMessage.includes('memory') || errorMessage.includes('OOM')) return 'Out of memory — workload exceeded allocated compute resources';
    return `Pipeline failure: ${failureType}. Error: ${errorMessage}`;
  }

  private generateSummary(params: any, severity: Severity, rootCause: string): string {
    return `**${severity.toUpperCase()} Incident**\n\n` +
      `Pipeline \`${params.pipeline}\` failed.\n\n` +
      `**Likely cause:** ${rootCause}\n\n` +
      `**Blast radius:** ${params.blastRadius.pipelines} downstream pipelines, ` +
      `${params.blastRadius.tables} tables, ${params.blastRadius.dataProducts} data products affected.\n\n` +
      `**Teams impacted:** ${params.blastRadius.teams.join(', ')}`;
  }
}
