import { redirect } from "next/navigation";

/**
 * Legacy /console/keys route.
 *
 * Key-minting and sign-in are gone (the product is no-login, bring-your-own-key
 * in Settings), so this route no longer hosts anything. Its connect-your-agent
 * content moved to the public /docs page and the homepage install section, so we
 * redirect here to /docs rather than leave a dead end.
 */
export default function KeysPage() {
  redirect("/docs");
}
