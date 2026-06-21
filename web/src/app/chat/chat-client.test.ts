import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ChatClient } from "./chat-client";

/**
 * SSR render test for the initial (idle) ChatClient shell.
 *
 * The project has no happy-dom/jsdom/@testing-library/react installed and
 * the vitest config only includes `*.test.ts` (node environment, non-JSX),
 * so we cannot exercise DOM interaction (clicks, state transitions) and
 * cannot use JSX syntax in a `.ts` file. We use `createElement` instead.
 * The interactive state machine is covered by `chat-state.test.ts`; this
 * test asserts the initial render contains the required regions (R5.1):
 * question input, submit control, answer region, sources region.
 */
describe("ChatClient initial render (SSR)", () => {
	it("renders a question input, submit control, answer region, and sources region", () => {
		const html = renderToStaticMarkup(createElement(ChatClient));
		// Question input (textarea with aria-label)
		expect(html).toContain('aria-label="Question"');
		// Submit control
		expect(html).toMatch(/<button[^>]*>/i);
		expect(html).toContain("Ask");
		// Answer region (section with aria-label="Answer")
		expect(html).toContain('aria-label="Answer"');
		// Sources region (section with aria-label="Sources")
		expect(html).toContain('aria-label="Sources"');
	});

	it("does not stream — no EventSource or ReadableStream reference in markup", () => {
		const html = renderToStaticMarkup(createElement(ChatClient));
		expect(html).not.toContain("EventSource");
		expect(html).not.toContain("ReadableStream");
	});
});
