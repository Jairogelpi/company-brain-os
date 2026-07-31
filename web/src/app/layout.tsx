import type { ReactNode } from "react";
import type { Metadata } from "next";
import { Geist, Geist_Mono, Archivo } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { LanguageProvider } from "@/components/auth/LanguageContext";
import "./globals.css";

const geist = Geist({
	variable: "--font-geist",
	subsets: ["latin"],
});

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
});

const archivo = Archivo({
	variable: "--font-archivo",
	subsets: ["latin"],
	weight: ["400", "500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
	title: "Company Brain OS",
	description: "A living graph for organizational knowledge risk.",
};

export default function RootLayout({
	children,
}: Readonly<{ children: ReactNode }>) {
	return (
		<html lang="en" suppressHydrationWarning>
			<body
				className={`${geist.variable} ${geistMono.variable} ${archivo.variable}`}
			>
				<ThemeProvider
					attribute="class"
					defaultTheme="light"
					disableTransitionOnChange
				>
					<div id="app-root">
						<LanguageProvider><AuthProvider>{children}</AuthProvider></LanguageProvider>
					</div>
				</ThemeProvider>
			</body>
		</html>
	);
}
