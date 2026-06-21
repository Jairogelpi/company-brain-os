import NextAuth from "next-auth";
import { authConfig } from "@/auth/config";

// Edge-safe Auth.js instance (no DB / bcrypt) used only to gate routes.
// The `authorized` callback in authConfig decides what is public.
export const { auth: middleware } = NextAuth(authConfig);

export default middleware;

export const config = {
	// Run on everything except Next internals and static assets.
	matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|woff2?)$).*)"],
};
