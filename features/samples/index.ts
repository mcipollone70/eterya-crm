/** Samples module — gestione campioni prodotto. */
export const SAMPLES_MODULE = "samples" as const;

export { SamplesPage } from "./samples-page";
export { SampleForm } from "./components/sample-form";
export { SampleDetail } from "./components/sample-detail";
export {
  saveSampleAction,
  updateSampleAction,
  deleteSampleAction,
} from "./actions/sample-actions";
export {
  listSamples,
  getSampleById,
  saveSample,
  updateSample,
  deleteSample,
  getSamplesDashboardMetrics,
  listSampleFilterOptions,
  type SampleListItem,
} from "./services/samples.service";
