import { handle } from "@/server/http";
import { listModels } from "@/server/providers";

/** Every model the connected providers offer: Claude aliases plus the signed-in Antigravity account's models. */
export async function GET(req: Request) {
  return handle(req, () => listModels());
}
