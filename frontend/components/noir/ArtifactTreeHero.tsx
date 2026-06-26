"use client";

import { JudgeDemoController } from "./JudgeDemoController";

/**
 * ArtifactTreeHero — the homepage fold. Now a thin wrapper around the stateful
 * JudgeDemoController, which owns the visible 6-stage Judge Demo state machine:
 * the masthead copy + CTAs on the left, the live stage rail and count-up
 * metrics, and the dominant ArtifactTreeGraph on the right whose `stage` prop it
 * drives through the run. CTA1 "Run Judge Demo" plays the sequence IN PLACE (no
 * route change) and fires the real backend in parallel to persist the canonical
 * artifact; CTA2 "View Memory Certificate" scrolls to the on-page certificate.
 *
 * The controller is the single source of the hero's behavior so the homepage and
 * the certificate section stay in lockstep. COPY is fixed to the brief.
 */
export function ArtifactTreeHero() {
  return <JudgeDemoController certificateAnchorId="memory-certificate" />;
}
