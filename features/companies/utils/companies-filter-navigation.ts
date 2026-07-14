/** Riparte dalla prima pagina quando cambiano filtri o ordinamento. */
export function resetCompaniesPageParam(params: URLSearchParams): void {
  params.delete("page");
}
