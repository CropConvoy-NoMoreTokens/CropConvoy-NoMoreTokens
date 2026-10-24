export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
export function pending(feature: string): never {
  throw new ApiError(503, 'NOT_IMPLEMENTED', `${feature} is a starter stub. See the owning developer's handoff.`);
}
