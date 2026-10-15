export type ProviderSubmissionObserver = Readonly<{
  onSubmit: () => void;
  onResponse?: (response: Response) => void;
}>;

// Construct/validate URL, headers and body before marking an attempt submitted.
// Once fetch starts, a timeout/disconnect cannot prove the provider did no work.
export async function submitProviderRequest(url: string, init: RequestInit, observer?: ProviderSubmissionObserver) {
  const request = new Request(url, init);
  observer?.onSubmit();
  const response = await fetch(request);
  observer?.onResponse?.(response);
  return response;
}
