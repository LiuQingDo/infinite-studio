/** Server-only contract. No provider is connected or enabled. */
export interface ImageProvider {
  submit(input: { prompt: string; idempotencyKey: string }): Promise<{ providerRequestId: string }>;
  getStatus(providerRequestId: string): Promise<
    | { status: 'running' }
    | { status: 'failed'; code: string }
    | { status: 'succeeded'; resultUrl: string }
  >;
}
