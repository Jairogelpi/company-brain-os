import { Suspense } from "react";
import LoginPage from "@/components/auth/LoginPage";

export default function Login() {
	return (
		<Suspense>
			<LoginPage />
		</Suspense>
	);
}
