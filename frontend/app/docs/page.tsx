import { ObservatoryBackground } from "@/components/landing/observatory/ObservatoryBackground";
import { ObservatoryFooter } from "@/components/landing/observatory/ObservatoryFooter";
import { DocsHeader } from "@/components/docs/DocsHeader";
import { DocsContent } from "@/components/docs/DocsContent";

/**
 * Public /docs route.
 *
 * The single, honest place a visitor goes to install HydraSentry, connect their
 * agent (the MCP client config), see the seven MCP tools, bring their own model
 * key, learn the usage flow, and find the public API endpoints. This absorbs the
 * connect-your-agent content that used to live at /console/keys (now redirected
 * here) and mirrors the homepage install section.
 *
 * Layered like the landing page: a fixed void background (z-0) behind a centred
 * content column, with the docs header (carrying the "Docs" nav entry) and the
 * shared observatory footer.
 */
export default function DocsPage() {
  return (
    <div
      className="castellan-landing observatory-landing"
      style={{
        position: "relative",
        minHeight: "100vh",
        background: "#040506",
        isolation: "isolate",
      }}
    >
      <ObservatoryBackground />
      <DocsHeader />

      <main
        style={{
          position: "relative",
          zIndex: 2,
          maxWidth: "980px",
          margin: "0 auto",
          padding: "48px 28px 96px",
        }}
      >
        <DocsContent />
      </main>

      <ObservatoryFooter />
    </div>
  );
}
