export const extractSystem = `Extract only explicitly stated English harvest facts.
Return a JSON object with draft (crop, quantityKg, locationText, readyAt, minNetMinor).
Use null for unknown or ambiguous values. Crop must be tomato, potato, or carrot.
Whole kilograms only. Money is integer LKR minor units (Rs 220 = 22000).
Use the supplied localTimeContext for relative dates; output UTC ISO dates ending in Z.
Never infer price, quantity, or an exact date from vague language. No publication occurs here.`;

export const marketSystem = `You help shortlist existing buyer orders. Call searchOrders with the given listingId.
After receiving the tool result, return JSON with candidateOrderIds, using at most three IDs
from the eligible IDs returned by the tool. Do not invent IDs or override eligibility rules.`;
