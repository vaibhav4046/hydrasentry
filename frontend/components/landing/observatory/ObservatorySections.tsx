import { InstrumentLegend } from "./sections/InstrumentLegend";
import { ObservationLog } from "./sections/ObservationLog";
import { InstrumentsGrid } from "./sections/InstrumentsGrid";
import { ReductionMethod } from "./sections/ReductionMethod";

/**
 * Below-the-fold observatory sections, the product story reskinned to the
 * star-atlas language. Each section is its own focused client component under
 * sections/ and reveals on scroll (framer-motion whileInView, once): the
 * instrument legend, the observation log (with a progressively-drawn timeline
 * hairline), the instruments grid, and the reduction-method loop. Copy is
 * preserved from landingData; the framing stays cartographic and pure
 * monochrome. Anchors (#product, #flow, #features, #architecture) are kept for
 * the nav.
 */
export function ObservatorySections() {
  return (
    <>
      <InstrumentLegend />
      <ObservationLog />
      <InstrumentsGrid />
      <ReductionMethod />
    </>
  );
}
