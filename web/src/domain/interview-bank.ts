/**
 * Expanded, fixed interview question bank.
 *
 * Asked in order to build a rich picture of the company across areas: people,
 * knowledge, processes, unwritten rules, clients, suppliers, systems, projects
 * and risk. Pure data — no I/O. Every `AI_EVERY` answered questions the capture
 * flow inserts one AI-generated, company-specific question (see
 * /api/interview/ai-question) so the interview adapts to what's already known.
 *
 * `expectsPerson` → answered with the company people dropdown (no free text).
 * `expectsSubstitute` → people dropdown + a 0–5 closeness level.
 */

export type BankArea =
	| "people"
	| "knowledge"
	| "process"
	| "rules"
	| "client"
	| "supplier"
	| "system"
	| "project"
	| "risk";

export type BankQuestion = {
	id: string;
	area: BankArea;
	text: string;
	expectsPerson?: boolean;
	expectsSubstitute?: boolean;
};

/** Insert an AI-generated question after every N bank questions. */
export const AI_EVERY = 5;

export const QUESTION_BANK: BankQuestion[] = [
	// People & key dependencies
	{
		id: "key-person",
		area: "people",
		text: "¿Quién es la persona que si falta mañana tienes un problema serio?",
		expectsPerson: true,
	},
	{
		id: "key-knowledge",
		area: "knowledge",
		text: "¿Qué hace exactamente esa persona que nadie más sepa hacer?",
	},
	{
		id: "substitute",
		area: "people",
		text: "¿Quién es el segundo que más se acerca a ese conocimiento?",
		expectsSubstitute: true,
	},
	{
		id: "documented",
		area: "knowledge",
		text: "¿Ese conocimiento está escrito o documentado en algún sitio?",
	},
	{
		id: "fragile-process",
		area: "process",
		text: "¿Qué proceso para la empresa si se rompe?",
	},

	// Rules, processes, onboarding
	{
		id: "unwritten-rule",
		area: "rules",
		text: "¿Hay algo que todos respetan pero nadie tiene escrito?",
	},
	{
		id: "process-owner",
		area: "people",
		text: "¿Quién es el dueño real de ese proceso crítico?",
		expectsPerson: true,
	},
	{
		id: "decision-criteria",
		area: "knowledge",
		text: "¿Qué decisiones se toman 'a ojo' por experiencia y no por una regla escrita?",
	},
	{
		id: "onboarding",
		area: "process",
		text: "Si entra alguien nuevo en ese puesto, ¿cuánto tarda en ser autónomo y por qué?",
	},
	{
		id: "manual-steps",
		area: "process",
		text: "¿Qué tarea se sigue haciendo a mano que debería estar automatizada o documentada?",
	},

	// Clients & suppliers
	{
		id: "key-client",
		area: "client",
		text: "¿Cuál es el cliente cuya pérdida más os dolería, y quién lleva esa relación?",
	},
	{
		id: "client-knowledge",
		area: "client",
		text: "¿Qué se sabe de ese cliente que solo está en la cabeza de alguien?",
	},
	{
		id: "key-supplier",
		area: "supplier",
		text: "¿De qué proveedor dependéis de forma crítica y qué pasaría si fallara?",
	},
	{
		id: "supplier-lockin",
		area: "supplier",
		text: "¿Hay algún proveedor o contrato del que sea muy difícil cambiar (lock-in)?",
	},

	// Systems & tools
	{
		id: "key-system",
		area: "system",
		text: "¿Qué sistema o herramienta es imprescindible para operar (ERP, CRM, hojas de cálculo…)?",
	},
	{
		id: "system-admin",
		area: "people",
		text: "¿Quién sabe administrar/configurar ese sistema si se cae?",
		expectsPerson: true,
	},
	{
		id: "shadow-tool",
		area: "system",
		text: "¿Hay alguna herramienta 'no oficial' (un Excel, una macro) de la que dependéis más de lo que debería?",
	},

	// Projects
	{
		id: "key-project",
		area: "project",
		text: "¿Qué proyecto en marcha es más crítico ahora mismo?",
	},
	{
		id: "project-lead",
		area: "people",
		text: "¿Quién lidera ese proyecto y quién más entiende cómo va?",
		expectsPerson: true,
	},

	// Risk synthesis
	{
		id: "single-point",
		area: "risk",
		text: "Si tuvieras que señalar el mayor punto único de fallo de la empresa, ¿cuál sería?",
	},
	{
		id: "downtime-cost",
		area: "risk",
		text: "¿Cuánto costaría aproximadamente un día de parada del proceso más crítico?",
	},
	{
		id: "retirement-risk",
		area: "people",
		text: "¿Hay alguien cercano a jubilarse o irse que se llevaría conocimiento clave?",
		expectsPerson: true,
	},
	{
		id: "recent-incident",
		area: "risk",
		text: "¿Cuál fue el último susto o incidente por depender de una sola persona o sistema?",
	},
	{
		id: "wishlist",
		area: "knowledge",
		text: "Si pudieras documentar una sola cosa este mes, ¿cuál salvaría más a la empresa?",
	},
];
