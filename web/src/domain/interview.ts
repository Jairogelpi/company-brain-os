import type {
	EdgeType,
	GraphEdge,
	GraphNode,
	KnowledgeNode,
	KnowledgeType,
} from "./graph";
import { analyzeTextWithLLM } from "@/ai/extraction";

export const INTERVIEW_PROBES = [
	{
		id: "PERSONA_CLAVE",
		label: "Persona clave",
		question:
			"¿Quién es la persona que si falta mañana tienes un problema serio?",
	},
	{
		id: "CONOCIMIENTO",
		label: "Conocimiento crítico",
		question: "¿Qué hace exactamente que nadie más sepa hacer?",
	},
	{
		id: "SUSTITUTO",
		label: "Sustituto real",
		question:
			"Si se fuera, ¿quién es el segundo que más se acerca? ¿Cuánto se acerca?",
	},
	{
		id: "PROCESO",
		label: "Proceso frágil",
		question: "¿Qué proceso para la empresa si se rompe?",
	},
	{
		id: "REGLA_NO_ESCRITA",
		label: "Regla no escrita",
		question: "¿Hay algo que todos respetan pero nadie tiene escrito?",
	},
] as const;

export type InterviewProbeId = (typeof INTERVIEW_PROBES)[number]["id"];
type QuestionPurpose =
	| "probe"
	| "deepen_knowledge"
	| "deepen_substitute"
	| "documentation_check";

export type InterviewQuestion = {
	id: string;
	probe: InterviewProbeId;
	purpose: QuestionPurpose;
	text: string;
};

export type InterviewAnswer = {
	questionId: string;
	text: string;
};

export type InterviewFact = {
	id: string;
	kind: "person" | "knowledge" | "substitute" | "process" | "rule";
	text: string;
};

export type GraphOperationProposal =
	| { type: "create_node"; node: GraphNode | KnowledgeNode; reason: string }
	| { type: "create_edge"; edge: GraphEdge; reason: string }
	| {
			type: "update_node";
			nodeId: string;
			patch: Partial<GraphNode | KnowledgeNode>;
			reason: string;
	  };

export type InterviewAlarm = {
	id: string;
	severity: "critical";
	personName: string;
	knowledgeName: string;
	message: string;
	sourceKnowledgeId: string;
};

type PersonFact = { id: string; name: string };
type KnowledgeFact = {
	id: string;
	name: string;
	knowledgeType: KnowledgeType;
	critical: boolean;
	documented: boolean;
};
type SubstituteFact = { id: string; name: string; level: number };

export type InterviewSession = {
	id: string;
	currentQuestion: InterviewQuestion;
	askedQuestions: InterviewQuestion[];
	answers: InterviewAnswer[];
	facts: {
		keyPerson?: PersonFact;
		knowledge?: KnowledgeFact;
		substitute?: SubstituteFact;
		process?: { id: string; name: string; critical: boolean };
		rules: KnowledgeFact[];
		covered: boolean;
		documented?: boolean;
		noRealSubstitute: boolean;
	};
	collectedFacts: InterviewFact[];
	proposals: GraphOperationProposal[];
	alarms: InterviewAlarm[];
};

export type TextSignals = {
	personName?: string;
	knowledgeName?: string;
	ruleName?: string;
	processName?: string;
	critical: boolean;
	covered: boolean;
	documented: boolean;
	undocumented: boolean;
	noSubstitute: boolean;
	substituteName?: string;
	substituteLevel?: number;
};

const firstQuestion = makeQuestion("PERSONA_CLAVE", "probe");

export function createInterviewSession(): InterviewSession {
	return {
		id: "interview-local",
		currentQuestion: firstQuestion,
		askedQuestions: [firstQuestion],
		answers: [],
		facts: {
			rules: [],
			covered: false,
			noRealSubstitute: false,
		},
		collectedFacts: [],
		proposals: [],
		alarms: [],
	};
}

export function answerInterviewQuestionAsync(
	session: InterviewSession,
	text: string,
): Promise<InterviewSession> {
	const answer = { questionId: session.currentQuestion.id, text };

	return analyzeTextWithLLM(text, session.currentQuestion, analyzeText).then(
		(signals) => {
			const next = cloneSession(session, answer);
			applySignals(next, signals, session.currentQuestion, text);
			detectFirstAlarm(next);

			const nextQuestion = chooseNextQuestion(
				next,
				session.currentQuestion,
				signals,
			);
			next.currentQuestion = nextQuestion;
			next.askedQuestions = [...next.askedQuestions, nextQuestion];
			return next;
		},
	);
}

export function answerInterviewQuestion(
	session: InterviewSession,
	text: string,
): InterviewSession {
	const answer = { questionId: session.currentQuestion.id, text };
	const signals = analyzeText(text);
	const next = cloneSession(session, answer);

	applySignals(next, signals, session.currentQuestion, text);
	detectFirstAlarm(next);

	const nextQuestion = chooseNextQuestion(
		next,
		session.currentQuestion,
		signals,
	);
	next.currentQuestion = nextQuestion;
	next.askedQuestions = [...next.askedQuestions, nextQuestion];
	return next;
}

export function materializeProposedGraph(proposals: GraphOperationProposal[]): {
	nodes: GraphNode[];
	edges: GraphEdge[];
} {
	const nodes = new Map<string, GraphNode>();
	const edges = new Map<string, GraphEdge>();

	for (const proposal of proposals) {
		if (proposal.type === "create_node")
			nodes.set(proposal.node.id, proposal.node);
		if (proposal.type === "create_edge")
			edges.set(proposal.edge.id, proposal.edge);
		if (proposal.type === "update_node") {
			const current = nodes.get(proposal.nodeId);
			if (current)
				nodes.set(proposal.nodeId, { ...current, ...proposal.patch });
		}
	}

	return { nodes: [...nodes.values()], edges: [...edges.values()] };
}

function cloneSession(
	session: InterviewSession,
	answer: InterviewAnswer,
): InterviewSession {
	return {
		...session,
		answers: [...session.answers, answer],
		facts: { ...session.facts, rules: [...session.facts.rules] },
		collectedFacts: [...session.collectedFacts],
		proposals: [...session.proposals],
		alarms: [...session.alarms],
	};
}

function applySignals(
	session: InterviewSession,
	signals: TextSignals,
	question: InterviewQuestion,
	text: string,
): void {
	applyCoverageSignals(session, signals);
	captureKeyPerson(session, signals, question);
	captureKnowledge(session, signals, question);
	captureSubstitute(session, signals, question);
	captureDocumentationCheck(session, question);
	captureProcess(session, signals, question, text);
	captureUnwrittenRule(session, signals, question, text);
}

function applyCoverageSignals(
	session: InterviewSession,
	signals: TextSignals,
): void {
	if (signals.covered) session.facts.covered = true;
	if (signals.documented) session.facts.documented = true;
	if (signals.undocumented) session.facts.documented = false;
	if (signals.noSubstitute) session.facts.noRealSubstitute = true;
}

function captureKeyPerson(
	session: InterviewSession,
	signals: TextSignals,
	question: InterviewQuestion,
): void {
	if (question.probe !== "PERSONA_CLAVE" || !signals.personName) return;
	const person = personFact(signals.personName);
	session.facts.keyPerson = person;
	session.collectedFacts.push({
		id: person.id,
		kind: "person",
		text: signals.personName,
	});
	pushNode(
		session,
		{ id: person.id, type: "Person", name: person.name },
		"Interview answer named the key person.",
	);
}

function captureKnowledge(
	session: InterviewSession,
	signals: TextSignals,
	question: InterviewQuestion,
): void {
	if (question.probe !== "CONOCIMIENTO" && !signals.knowledgeName) return;
	const knowledgeName = signals.knowledgeName ?? signals.ruleName;
	if (!knowledgeName) return;

	const knowledge = knowledgeFact(
		knowledgeName,
		signals.ruleName ? "rule" : "technical",
		signals,
	);
	session.facts.knowledge = knowledge;
	session.collectedFacts.push({
		id: knowledge.id,
		kind: "knowledge",
		text: knowledge.name,
	});
	pushNode(
		session,
		knowledgeNode(knowledge),
		"Interview answer described transmissible knowledge.",
	);

	const expert = signals.personName
		? personFact(signals.personName)
		: session.facts.keyPerson;
	if (!expert) return;
	session.facts.keyPerson = expert;
	pushNode(
		session,
		{ id: expert.id, type: "Person", name: expert.name },
		"Knowledge owner inferred from the answer.",
	);
	pushEdge(
		session,
		masteryEdge(expert.id, knowledge.id, 5),
		"Expert knowledge maps to MASTERS level 5.",
	);
}

function captureSubstitute(
	session: InterviewSession,
	signals: TextSignals,
	question: InterviewQuestion,
): void {
	if (question.probe !== "SUSTITUTO" || !signals.substituteName) return;
	const substitute = {
		id: nodeId("person", signals.substituteName),
		name: signals.substituteName,
		level: signals.substituteLevel ?? 2,
	};
	session.facts.substitute = substitute;
	session.collectedFacts.push({
		id: substitute.id,
		kind: "substitute",
		text: `${substitute.name} level ${substitute.level}`,
	});
	pushNode(
		session,
		{ id: substitute.id, type: "Person", name: substitute.name },
		"Interview answer named a possible substitute.",
	);
	if (!session.facts.knowledge) return;
	pushEdge(
		session,
		learningEdge(substitute.id, session.facts.knowledge.id, substitute.level),
		"Substitute maps to LEARNS with declared level.",
	);
}

function captureDocumentationCheck(
	session: InterviewSession,
	question: InterviewQuestion,
): void {
	if (question.purpose !== "documentation_check" || !session.facts.knowledge)
		return;
	const documented = session.facts.documented ?? false;
	const knowledge = { ...session.facts.knowledge, documented };
	session.facts.knowledge = knowledge;
	session.proposals.push({
		type: "update_node",
		nodeId: knowledge.id,
		patch: { documented },
		reason:
			"Documentation check updates the Knowledge proposal before human confirmation.",
	});
}

function captureProcess(
	session: InterviewSession,
	signals: TextSignals,
	question: InterviewQuestion,
	text: string,
): void {
	if (question.probe !== "PROCESO" || !text.trim()) return;
	const processName = signals.processName ?? cleanName(text);
	const process = {
		id: nodeId("process", processName),
		name: processName,
		critical: signals.critical,
	};
	session.facts.process = process;
	session.collectedFacts.push({
		id: process.id,
		kind: "process",
		text: process.name,
	});
	pushNode(
		session,
		{
			id: process.id,
			type: "Process",
			name: process.name,
			criticality: process.critical ? "high" : "medium",
		},
		"Interview answer described a process.",
	);
	if (!session.facts.knowledge) return;
	pushEdge(
		session,
		requiresEdge(process.id, session.facts.knowledge.id),
		"Critical process requires the captured knowledge.",
	);
}

function captureUnwrittenRule(
	session: InterviewSession,
	signals: TextSignals,
	question: InterviewQuestion,
	text: string,
): void {
	if (question.probe !== "REGLA_NO_ESCRITA") return;
	if (!signals.ruleName && !text.toLowerCase().includes("regla")) return;
	const rule = knowledgeFact(signals.ruleName ?? cleanRuleName(text), "rule", {
		...signals,
		critical: true,
		undocumented: true,
	});
	session.facts.rules.push(rule);
	session.collectedFacts.push({ id: rule.id, kind: "rule", text: rule.name });
	pushNode(
		session,
		knowledgeNode(rule),
		"Unwritten rule maps to Knowledge with knowledgeType=rule.",
	);
}

function chooseNextQuestion(
	session: InterviewSession,
	current: InterviewQuestion,
	signals: TextSignals,
): InterviewQuestion {
	if (current.probe === "PERSONA_CLAVE")
		return makeQuestion(
			"CONOCIMIENTO",
			signals.covered ? "probe" : "deepen_knowledge",
			session,
		);
	if (current.probe === "CONOCIMIENTO") {
		if (session.facts.covered || session.facts.documented)
			return makeQuestion("PROCESO", "probe", session);
		return makeQuestion("SUSTITUTO", "deepen_substitute", session);
	}
	if (
		current.probe === "SUSTITUTO" &&
		current.purpose !== "documentation_check"
	) {
		const hasRealSubstitute =
			(signals.substituteLevel ?? session.facts.substitute?.level ?? 0) >= 3;
		return hasRealSubstitute
			? makeQuestion("PROCESO", "probe", session)
			: makeQuestion("SUSTITUTO", "documentation_check", session);
	}
	if (
		current.probe === "SUSTITUTO" &&
		current.purpose === "documentation_check"
	)
		return makeQuestion("PROCESO", "probe", session);
	if (current.probe === "PROCESO")
		return makeQuestion("REGLA_NO_ESCRITA", "probe", session);
	return makeQuestion("REGLA_NO_ESCRITA", "probe", session);
}

function detectFirstAlarm(session: InterviewSession): void {
	const knowledge = session.facts.knowledge;
	const person = session.facts.keyPerson;
	if (!knowledge || !person || session.alarms.length > 0) return;

	const substituteLevel = session.facts.substitute?.level;
	const hasRealSubstitute = (substituteLevel ?? 0) >= 3;
	const hasNoRealSubstitute =
		session.facts.noRealSubstitute ||
		(substituteLevel !== undefined && substituteLevel < 3);
	const isDocumented = session.facts.documented === true;
	const isExplicitlyUndocumented = session.facts.documented === false;
	const missingRequiredRisk =
		!knowledge.critical || !hasNoRealSubstitute || !isExplicitlyUndocumented;
	const hasSafetyCoverage =
		session.facts.covered || hasRealSubstitute || isDocumented;
	if (missingRequiredRisk || hasSafetyCoverage) return;

	session.alarms.push({
		id: `alarm-${knowledge.id}`,
		severity: "critical",
		personName: person.name,
		knowledgeName: knowledge.name,
		message: `Si ${person.name} falta, hay una fragilidad crítica: nadie más domina ${knowledge.name}.`,
		sourceKnowledgeId: knowledge.id,
	});
}

function makeQuestion(
	probe: InterviewProbeId,
	purpose: QuestionPurpose,
	session?: InterviewSession,
): InterviewQuestion {
	const keyPerson = session?.facts.keyPerson?.name;
	const knowledge = session?.facts.knowledge?.name;
	const textByPurpose: Record<QuestionPurpose, string | undefined> = {
		probe: INTERVIEW_PROBES.find((candidate) => candidate.id === probe)
			?.question,
		deepen_knowledge: keyPerson
			? `¿Qué hace exactamente ${keyPerson} que nadie más sepa hacer?`
			: undefined,
		deepen_substitute: keyPerson
			? `Si ${keyPerson} se fuera, ¿quién es el segundo que más se acerca? ¿Qué nivel tiene de 0 a 5?`
			: undefined,
		documentation_check: knowledge
			? `¿${knowledge} está escrito o documentado en algún sitio?`
			: "¿Ese conocimiento está escrito o documentado en algún sitio?",
	};
	const text =
		textByPurpose[purpose] ??
		INTERVIEW_PROBES.find((candidate) => candidate.id === probe)?.question ??
		"¿Qué riesgo deberíamos mirar ahora?";
	return { id: `${probe.toLowerCase()}-${purpose}`, probe, purpose, text };
}

function analyzeText(text: string): TextSignals {
	const lower = text.toLowerCase();
	const level = Number(lower.match(/nivel\s*([0-5])/)?.[1]);
	const documented =
		/(documentad|manual|sop|validado|escrito)/.test(lower) &&
		!/(no\s+(est[aá]\s+)?(escrito|documentad)|nadie\s+.*escribi)/.test(lower);
	const undocumented =
		/(no\s+(est[aá]\s+)?(escrito|documentad)|nadie\s+.*escribi|nadie\s+lo\s+escribi)/.test(
			lower,
		);
	const covered =
		/(tres|varias|varios|m[uú]ltiples|cubierto|lo\s+saben\s+\w+\s+personas|conocen\s+\w+\s+personas)/.test(
			lower,
		);
	const noSubstitute =
		/(nadie\s+m[aá]s|no\s+hay\s+sustituto|sin\s+sustituto|solo|[uú]nico)/.test(
			lower,
		);
	const critical =
		/(indispensable|problema\s+serio|se\s+para|para\s+producci[oó]n|cr[ií]tic|para\s+la\s+empresa|si\s+falta|se\s+rompe)/.test(
			lower,
		);

	return {
		personName: extractPersonName(text),
		knowledgeName: extractKnowledgeName(text),
		ruleName: extractRuleName(text),
		processName: extractProcessName(text),
		critical,
		covered,
		documented,
		undocumented,
		noSubstitute,
		substituteName: extractSubstituteName(text),
		substituteLevel: Number.isNaN(level)
			? /(tambi[eé]n\s+puede|puede\s+hacerlo)/.test(lower)
				? 3
				: undefined
			: level,
	};
}

function extractPersonName(text: string): string | undefined {
	const lower = text.toLowerCase();
	if (lower.includes("socio")) return "socio";

	const ignored = new Set(["Si", "Solo", "No", "La", "El", "Eso", "Nunca"]);
	const candidates = [...text.matchAll(/\b[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+\b/gu)].map(
		(match) => match[0],
	);
	return candidates.find((candidate) => !ignored.has(candidate));
}

function extractSubstituteName(text: string): string | undefined {
	const match = text.match(/\b[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+\b/u);
	return match && !["No", "Si"].includes(match[0]) ? match[0] : undefined;
}

function extractKnowledgeName(text: string): string | undefined {
	const lower = text.toLowerCase();
	if (lower.includes("masa madre")) return "masa madre";
	if (lower.includes("forma especial"))
		return cleanName(text.slice(lower.indexOf("forma especial")));
	if (lower.includes("configura"))
		return cleanName(
			text
				.slice(lower.indexOf("configura"))
				.replace(/^configura/i, "configurar"),
		);
	if (lower.includes("firma"))
		return cleanName(
			text
				.slice(lower.indexOf("firma"))
				.replace(/^firma/i, "criterio para firmar"),
		);
	if (lower.includes("sabe"))
		return cleanName(text.slice(lower.indexOf("sabe") + 4));
	return undefined;
}

function extractRuleName(text: string): string | undefined {
	const lower = text.toLowerCase();
	if (!/(nunca|regla|nadie\s+.*escrito)/.test(lower)) return undefined;
	const start = lower.includes("nunca")
		? lower.indexOf("nunca")
		: lower.indexOf("regla");
	return cleanRuleName(text.slice(Math.max(0, start)));
}

function extractProcessName(text: string): string | undefined {
	const lower = text.toLowerCase();
	if (!lower.includes("proceso")) return undefined;
	return cleanName(text.replace(/.*proceso\s+/i, ""));
}

function cleanRuleName(text: string): string {
	return cleanName(text.replace(/^nunca\s+/i, "").replace(/;.*$/, ""));
}

function cleanName(text: string): string {
	return text
		.replace(/[.;,].*$/, "")
		.replace(
			/\b(y|porque|pero|que|nadie\s+m[aá]s|nadie|solo|siempre|hacerlo|sabe|lo\s+respetan|todos)\b.*$/i,
			"",
		)
		.trim()
		.toLowerCase();
}

function personFact(name: string): PersonFact {
	return { id: nodeId("person", name), name };
}

function knowledgeFact(
	name: string,
	knowledgeType: KnowledgeType,
	signals: Pick<TextSignals, "critical" | "documented" | "undocumented">,
): KnowledgeFact {
	return {
		id: nodeId("knowledge", name),
		name,
		knowledgeType,
		critical: signals.critical,
		documented: signals.documented && !signals.undocumented,
	};
}

function knowledgeNode(knowledge: KnowledgeFact): KnowledgeNode {
	return {
		id: knowledge.id,
		type: "Knowledge",
		name: knowledge.name,
		knowledgeType: knowledge.knowledgeType,
		documented: knowledge.documented,
		validationState: "proposed",
		confidence: knowledge.documented ? 60 : 25,
		criticality: knowledge.critical ? "high" : "medium",
	};
}

function masteryEdge(
	fromNodeId: string,
	toNodeId: string,
	level: number,
): GraphEdge {
	return edge("MASTERS", fromNodeId, toNodeId, { level });
}

function learningEdge(
	fromNodeId: string,
	toNodeId: string,
	level: number,
): GraphEdge {
	return edge("LEARNS", fromNodeId, toNodeId, { level });
}

function requiresEdge(fromNodeId: string, toNodeId: string): GraphEdge {
	return edge("REQUIRES", fromNodeId, toNodeId, {});
}

function edge(
	type: EdgeType,
	fromNodeId: string,
	toNodeId: string,
	attributes: Record<string, unknown>,
): GraphEdge {
	return {
		id: `edge-${type.toLowerCase()}-${fromNodeId}-${toNodeId}`,
		type,
		fromNodeId,
		toNodeId,
		attributes,
	};
}

function pushNode(
	session: InterviewSession,
	node: GraphNode | KnowledgeNode,
	reason: string,
): void {
	if (
		session.proposals.some(
			(proposal) =>
				proposal.type === "create_node" && proposal.node.id === node.id,
		)
	)
		return;
	session.proposals.push({ type: "create_node", node, reason });
}

function pushEdge(
	session: InterviewSession,
	edge: GraphEdge,
	reason: string,
): void {
	if (
		session.proposals.some(
			(proposal) =>
				proposal.type === "create_edge" && proposal.edge.id === edge.id,
		)
	)
		return;
	session.proposals.push({ type: "create_edge", edge, reason });
}

function nodeId(prefix: string, value: string): string {
	const slug = value
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "")
		.slice(0, 48);
	return `${prefix}-${slug || "unknown"}`;
}
