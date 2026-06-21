import { redirect } from "next/navigation";
import { getCurrentUser } from "@/auth/nextauth";
import { ChatClient } from "./chat-client";

/**
 * /chat — server shell. Redirects unauthenticated users to sign-in before
 * rendering, matching the pattern in other protected routes (design §6.3).
 */
export default async function ChatPage() {
	const user = await getCurrentUser();
	if (!user) redirect("/api/auth/signin");
	return <ChatClient />;
}
