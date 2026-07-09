/**
 * EADD Knowledge Graph & Data Lineage Engine
 * 
 * Unified graph that all agents read from and write to.
 * Combines: lineage + catalog + semantic layer + decisions.
 * 
 * Nodes: tables, columns, pipelines, metrics, users, systems, policies
 * Edges: "produces", "owns", "depends_on", "governed_by", "transforms"
 * 
 * Answers questions like:
 * - "Where did this number come from?" (lineage)
 * - "What breaks if I change this column?" (impact analysis)
 * - "Who owns this data?" (catalog)
 * - "What systems affect revenue?" (cross-cutting)
 */

// ============================================================
// GRAPH NODE TYPES
// ============================================================

export type NodeType =
  | 'table'
  | 'column'
  | 'pipeline'
  | 'metric'
  | 'user'
  | 'team'
  | 'system'
  | 'policy'
  | 'data_product'
  | 'decision';

export interface GraphNode {
  id: string;
  type: NodeType;
  name: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface TableNode extends GraphNode {
  type: 'table';
  metadata: {
    database: string;
    schema: string;
    layer: 'bronze' | 'silver' | 'gold' | 'source' | 'serving';
    platform: string;
    rowCount?: number;
    sizeBytes?: number;
    freshnessSLA?: string;
    lastUpdated?: string;
  };
}

export interface ColumnNode extends GraphNode {
  type: 'column';
  metadata: {
    tableId: string;
    dataType: string;
    nullable: boolean;
    isPrimaryKey: boolean;
    isForeignKey: boolean;
    isPII: boolean;
    businessDescription?: string;
    transformationLogic?: string;
  };
}

export interface PipelineNode extends GraphNode {
  type: 'pipeline';
  metadata: {
    sourceSystem: string;
    targetSystem: string;
    schedule: string;
    platform: string;
    status: 'active' | 'deprecated' | 'draft';
    lastRunAt?: string;
    avgDurationMs?: number;
  };
}

export interface MetricNode extends GraphNode {
  type: 'metric';
  metadata: {
    /** THE single definition — no conflicting versions */
    definition: string;
    formula: string;
    owner: string;
    sourceTableIds: string[];
    /** Business context */
    businessDomain: string;
    granularity: string;
  };
}

export interface DataProductNode extends GraphNode {
  type: 'data_product';
  metadata: {
    owner: string;
    team: string;
    sla: string;
    consumers: string[];
    businessValue: string;
    version: string;
    status: 'draft' | 'active' | 'deprecated';
  };
}

export interface DecisionNode extends GraphNode {
  type: 'decision';
  metadata: {
    /** What was decided */
    question: string;
    /** What was chosen */
    choice: string;
    /** Alternatives that were considered */
    alternatives: Array<{
      option: string;
      scores: Record<string, number>;
    }>;
    /** Why (derived from scores) */
    justification: string;
    /** Who/what made the decision */
    decidedBy: string;
    decidedAt: string;
  };
}

// ============================================================
// GRAPH EDGE TYPES
// ============================================================

export type EdgeType =
  | 'produces'       // pipeline → table
  | 'consumes'      // pipeline ← table
  | 'transforms'    // column → column (with logic)
  | 'owns'          // user/team → data_product
  | 'depends_on'    // table → table, pipeline → pipeline
  | 'governed_by'   // table → policy
  | 'defines'       // metric → column(s)
  | 'part_of'       // column → table
  | 'decided_for'   // decision → system/table/pipeline
  | 'impacts';      // change propagation

export interface GraphEdge {
  id: string;
  type: EdgeType;
  sourceNodeId: string;
  targetNodeId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface TransformEdge extends GraphEdge {
  type: 'transforms';
  metadata: {
    /** The transformation logic applied */
    transformationSQL?: string;
    transformationPython?: string;
    transformationDescription: string;
    /** Is this a direct copy, rename, cast, or complex derivation? */
    complexity: 'direct' | 'rename' | 'cast' | 'derived' | 'aggregated';
  };
}

// ============================================================
// KNOWLEDGE GRAPH SERVICE
// ============================================================

export class KnowledgeGraph {
  private nodes: Map<string, GraphNode> = new Map();
  private edges: Map<string, GraphEdge> = new Map();
  private nodesByType: Map<NodeType, Set<string>> = new Map();

  // ─── CRUD Operations ─────────────────────────────────

  addNode(node: GraphNode): void {
    this.nodes.set(node.id, node);
    const typeSet = this.nodesByType.get(node.type) || new Set();
    typeSet.add(node.id);
    this.nodesByType.set(node.type, typeSet);
  }

  addEdge(edge: GraphEdge): void {
    this.edges.set(edge.id, edge);
  }

  getNode(id: string): GraphNode | undefined {
    return this.nodes.get(id);
  }

  // ─── LINEAGE QUERIES ─────────────────────────────────

  /**
   * "Where did this column come from?" — trace upstream lineage
   */
  traceUpstream(nodeId: string, depth: number = 10): GraphNode[] {
    const result: GraphNode[] = [];
    const visited = new Set<string>();
    this._traceDirection(nodeId, 'upstream', depth, result, visited);
    return result;
  }

  /**
   * "What breaks if I change this?" — trace downstream impact
   */
  traceDownstream(nodeId: string, depth: number = 10): GraphNode[] {
    const result: GraphNode[] = [];
    const visited = new Set<string>();
    this._traceDirection(nodeId, 'downstream', depth, result, visited);
    return result;
  }

  /**
   * Impact analysis — what consumers are affected by a change?
   */
  impactAnalysis(nodeId: string): ImpactReport {
    const downstream = this.traceDownstream(nodeId);
    const affectedPipelines = downstream.filter(n => n.type === 'pipeline');
    const affectedTables = downstream.filter(n => n.type === 'table');
    const affectedMetrics = downstream.filter(n => n.type === 'metric');
    const affectedProducts = downstream.filter(n => n.type === 'data_product');

    return {
      sourceNode: this.getNode(nodeId)!,
      totalAffected: downstream.length,
      affectedPipelines: affectedPipelines.length,
      affectedTables: affectedTables.length,
      affectedMetrics: affectedMetrics.length,
      affectedDataProducts: affectedProducts.length,
      riskLevel: affectedProducts.length > 0 ? 'high' : affectedMetrics.length > 0 ? 'medium' : 'low',
      details: downstream,
      recommendation: this._generateImpactRecommendation(downstream),
    };
  }

  /**
   * "What systems affect revenue?" — cross-cutting query
   */
  queryByMetric(metricName: string): GraphNode[] {
    const metricNodes = Array.from(this.nodesByType.get('metric') || [])
      .map(id => this.nodes.get(id)!)
      .filter(n => n.name.toLowerCase().includes(metricName.toLowerCase()));

    const allRelated: GraphNode[] = [];
    for (const metric of metricNodes) {
      allRelated.push(...this.traceUpstream(metric.id));
    }
    return [...new Set(allRelated)];
  }

  /**
   * "Who owns this data?"
   */
  getOwner(nodeId: string): GraphNode | undefined {
    const ownerEdges = Array.from(this.edges.values())
      .filter(e => e.type === 'owns' && e.targetNodeId === nodeId);
    if (ownerEdges.length > 0) {
      return this.getNode(ownerEdges[0].sourceNodeId);
    }
    return undefined;
  }

  // ─── SEMANTIC LAYER ───────────────────────────────────

  /**
   * Get the SINGLE definition of a business metric.
   * No conflicting versions — one truth.
   */
  getMetricDefinition(metricName: string): MetricNode | undefined {
    const metrics = Array.from(this.nodesByType.get('metric') || [])
      .map(id => this.nodes.get(id) as MetricNode)
      .filter(n => n.name.toLowerCase() === metricName.toLowerCase());
    return metrics[0];
  }

  /**
   * Get all registered data products
   */
  getDataProducts(): DataProductNode[] {
    return Array.from(this.nodesByType.get('data_product') || [])
      .map(id => this.nodes.get(id) as DataProductNode);
  }

  // ─── DECISION LOG ─────────────────────────────────────

  /**
   * Record a decision with full scoring (Section 6.1)
   */
  recordDecision(decision: DecisionNode): void {
    this.addNode(decision);
  }

  /**
   * Get all past decisions for review/challenge
   */
  getDecisionHistory(): DecisionNode[] {
    return Array.from(this.nodesByType.get('decision') || [])
      .map(id => this.nodes.get(id) as DecisionNode)
      .sort((a, b) => b.metadata.decidedAt.localeCompare(a.metadata.decidedAt));
  }

  // ─── PRIVATE HELPERS ──────────────────────────────────

  private _traceDirection(
    nodeId: string,
    direction: 'upstream' | 'downstream',
    depth: number,
    result: GraphNode[],
    visited: Set<string>
  ): void {
    if (depth <= 0 || visited.has(nodeId)) return;
    visited.add(nodeId);

    const node = this.getNode(nodeId);
    if (node) result.push(node);

    const edges = Array.from(this.edges.values()).filter(e =>
      direction === 'upstream'
        ? e.targetNodeId === nodeId
        : e.sourceNodeId === nodeId
    );

    for (const edge of edges) {
      const nextId = direction === 'upstream' ? edge.sourceNodeId : edge.targetNodeId;
      this._traceDirection(nextId, direction, depth - 1, result, visited);
    }
  }

  private _generateImpactRecommendation(affected: GraphNode[]): string {
    if (affected.length === 0) return 'No downstream impact detected. Safe to change.';
    if (affected.some(n => n.type === 'data_product')) {
      return 'HIGH RISK: Change affects registered data products. Notify consumers and coordinate migration window.';
    }
    if (affected.some(n => n.type === 'metric')) {
      return 'MEDIUM RISK: Change affects business metrics. Validate metric definitions after change.';
    }
    return `LOW RISK: ${affected.length} downstream nodes affected. Review before proceeding.`;
  }
}

// ============================================================
// TYPES
// ============================================================

export interface ImpactReport {
  sourceNode: GraphNode;
  totalAffected: number;
  affectedPipelines: number;
  affectedTables: number;
  affectedMetrics: number;
  affectedDataProducts: number;
  riskLevel: 'low' | 'medium' | 'high';
  details: GraphNode[];
  recommendation: string;
}
