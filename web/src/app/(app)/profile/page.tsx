import { Suspense } from "react";
import ProfilePage from "@/components/auth/ProfilePage";

export default function Profile() {
	return (
		<Suspense>
			<ProfilePage />
		</Suspense>
	);
}
