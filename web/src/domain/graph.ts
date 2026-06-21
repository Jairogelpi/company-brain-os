export const NODE_TYPES = [
  "Person",
  "Knowledge",
  "Process",
  "Asset",
  "Unit",
  "Risk",
] as const;

export type NodeType = (typeof NODE_TYPES)[number];

export const EDGE_TYPES = [
  "MASTERS",
  "LEARNS",
  "REQUIRES",
  "EXECUTES",
  "PRODUCES",
  "DEPENDS_ON",
  "BELONGS_TO",
] as const;

export type EdgeType = (typeof EDGE_TYPES)[number];

export const KNOWLEDGE_TYPES = [
  "technical",
  "process",
  "rule",
  "value",
  "policy",
] as const;

export type KnowledgeType = (typeof KNOWLEDGE_TYPES)[number];

export type Criticality = "low" | "medium" | "high";
export type ValidationState = "draft" | "proposed" | "validated" | "retired";

export type GraphNode = {
  id: string;
  type: NodeType;
  name: string;
  criticality?: Criticality;
  archived?: boolean;
  attributes?: Record<string, unknown>;
};

export type KnowledgeNode = GraphNode & {
  type: "Knowledge";
  knowledgeType: KnowledgeType;
  documented: boolean;
  validationState: ValidationState;
  confidence: number;
};

export type GraphEdge = {
  id: string;
  type: EdgeType;
  fromNodeId: string;
  toNodeId: string;
  archived?: boolean;
  attributes?: Record<string, unknown>;
};

export type ValidationIssue = {
  code:
    | "unknown_node_type"
    | "unknown_edge_type"
    | "unknown_edge_node"
    | "invalid_edge_endpoint"
    | "invalid_knowledge_type"
    | "invalid_confidence";
  message: string;
};

export type ValidationResult =
  | { ok: true; issues: [] }
  | { ok: false; issues: ValidationIssue[] };

const nodeTypeSet = new Set<string>(NODE_TYPES);
const edgeTypeSet = new Set<string>(EDGE_TYPES);
const knowledgeTypeSet = new Set<string>(KNOWLEDGE_TYPES);

const edgeEndpointRules = {
  MASTERS: [{ from: "Person", to: "Knowledge" }],
  LEARNS: [{ from: "Person", to: "Knowledge" }],
  REQUIRES: [
    { from: "Process", to: "Knowledge" },
    { from: "Process", to: "Asset" },
  ],
  EXECUTES: [{ from: "Person", to: "Process" }],
  PRODUCES: [{ from: "Process", to: "Asset" }],
  DEPENDS_ON: [{ from: "*", to: "*" }],
  BELONGS_TO: [
    { from: "Person", to: "Unit" },
    { from: "Process", to: "Unit" },
    { from: "Asset", to: "Unit" },
  ],
} as const satisfies Record<EdgeType, readonly { from: NodeType | "*"; to: NodeType | "*" }[]>;

export function isNodeType(value: string): value is NodeType {
  return nodeTypeSet.has(value);
}

export function isEdgeType(value: string): value is EdgeType {
  return edgeTypeSet.has(value);
}

export function isKnowledgeType(value: string): value is KnowledgeType {
  return knowledgeTypeSet.has(value);
}

export function canConnect(edgeType: EdgeType, from: NodeType, to: NodeType): boolean {
  return edgeEndpointRules[edgeType].some((rule) => {
    const fromMatches = rule.from === "*" || rule.from === from;
    const toMatches = rule.to === "*" || rule.to === to;
    return fromMatches && toMatches;
  });
}

export function validateGraph(nodes: GraphNode[], edges: GraphEdge[]): ValidationResult {
  const issues: ValidationIssue[] = [];
  const nodesById = new Map(nodes.map((node) => [node.id, node]));

  for (const node of nodes) {
    if (!isNodeType(node.type)) {
      issues.push({ code: "unknown_node_type", message: `Unknown node type: ${node.type}` });
      continue;
    }

    if (node.type === "Knowledge") {
      const candidate = node as Partial<KnowledgeNode>;
      if (!candidate.knowledgeType || !isKnowledgeType(candidate.knowledgeType)) {
        issues.push({ code: "invalid_knowledge_type", message: `Invalid knowledge_type for ${node.id}` });
      }
      if (typeof candidate.confidence !== "number" || candidate.confidence < 0 || candidate.confidence > 100) {
        issues.push({ code: "invalid_confidence", message: `Knowledge confidence must be 0-100 for ${node.id}` });
      }
    }
  }

  for (const edge of edges) {
    if (!isEdgeType(edge.type)) {
      issues.push({ code: "unknown_edge_type", message: `Unknown edge type: ${edge.type}` });
      continue;
    }

    const from = nodesById.get(edge.fromNodeId);
    const to = nodesById.get(edge.toNodeId);
    if (!from || !to) {
      issues.push({ code: "unknown_edge_node", message: `Edge ${edge.id} references a missing node` });
      continue;
    }

    if (!canConnect(edge.type, from.type, to.type)) {
      issues.push({
        code: "invalid_edge_endpoint",
        message: `${edge.type} cannot connect ${from.type} -> ${to.type}`,
      });
    }
  }

  return issues.length === 0 ? { ok: true, issues: [] } : { ok: false, issues };
}
