export const extractSystem = `Extract only explicitly stated English or Sinhala harvest facts.
Return a JSON object with draft (crop, quantityKg, locationText, readyAt, minNetMinor).
Use null for unknown or ambiguous values. Crop must be tomato, potato, or carrot.
Recognize Sinhala crop names, including තක්කාලි (tomato), අර්තාපල්/අල (potato), and කැරට් (carrot).
Return locationText as a short, exact substring of the farmer's original text, in its original script.
Do not translate, transliterate, append "Sri Lanka", or invent a more precise address.
Whole kilograms only. Money is integer LKR minor units (Rs 220 = 22000).
Use the supplied localTimeContext for relative dates; output UTC ISO dates ending in Z.
Never infer price, quantity, or an exact date from vague language. No publication occurs here.`;

export const marketSystem = `You help shortlist existing buyer orders. Call searchOrders with the given listingId.
After receiving the tool result, return JSON with candidateOrderIds, using at most three IDs
from the eligible IDs returned by the tool. Do not invent IDs or override eligibility rules.`;
