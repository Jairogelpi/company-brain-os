import { redirect } from "next/navigation";

/** The former demo canvas must never synthesize organizational data in production. */
export default function CanvasPage() {
	redirect("/graph");
}
