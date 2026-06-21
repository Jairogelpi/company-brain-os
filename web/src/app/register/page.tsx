import { Suspense } from "react";
import RegisterPage from "@/components/auth/RegisterPage";

export default function Register() {
	return (
		<Suspense>
			<RegisterPage />
		</Suspense>
	);
}
