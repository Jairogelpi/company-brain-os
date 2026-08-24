import AcceptInvitePage from "@/components/auth/AcceptInvitePage";

export default async function AcceptInvitationRoute({
	searchParams,
}: {
	searchParams: Promise<{ token?: string }>;
}) {
	const { token } = await searchParams;
	return <AcceptInvitePage token={token ?? ""} />;
}
