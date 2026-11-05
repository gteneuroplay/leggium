import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/dal";
import { subscribeSessionEvents } from "@/lib/realtime/sessions";
import { prisma } from "@/lib/prisma";
import { verifyPresidenteMesaToken } from "@/lib/painel/presidente-mesa-token";
import { resolveTenantForObsPublicAccess } from "@/lib/obs/public-tenant";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ sessaoId: string }> }
) {
  const { sessaoId } = await context.params;
  if (!sessaoId) {
    return new Response("Sessão inválida", { status: 400 });
  }

  const mesaTokenRaw = request.nextUrl.searchParams.get("mesaToken");
  const mesaToken = mesaTokenRaw && mesaTokenRaw.trim() ? mesaTokenRaw.trim() : null;

  let tenantId: string | null = null;
  if (mesaToken) {
    const v = verifyPresidenteMesaToken(mesaToken);
    if (v && v.sessaoId === sessaoId) {
      tenantId = v.tenantId;
    }
  }

  if (!tenantId) {
    const user = await getCurrentUser();
    if (user?.profile?.tenant_id) {
      tenantId = user.profile.tenant_id;
    } else {
      const scope = await resolveTenantForObsPublicAccess(sessaoId);
      if (!scope) {
        return new Response("Não autorizado", { status: 401 });
      }
      tenantId = scope.tenantId;
    }
  }

  const ok = await prisma.sessao.findFirst({
    where: { id: sessaoId, tenant_id: tenantId, deleted_at: null },
    select: { id: true },
  });
  if (!ok) {
    return new Response("Sessão inválida", { status: 403 });
  }

  const encoder = new TextEncoder();

  let heartbeat: NodeJS.Timeout | null = null;
  let unsubscribe: (() => void) | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(
        encoder.encode(
          `event: connected\ndata: ${JSON.stringify({
            sessionId: sessaoId,
            ts: Date.now(),
          })}\n\n`
        )
      );

      unsubscribe = subscribeSessionEvents(sessaoId, (event) => {
        controller.enqueue(
          encoder.encode(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`)
        );
      });

      heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(`event: ping\ndata: {}\n\n`));
      }, 25000);
    },
    cancel() {
      if (heartbeat) clearInterval(heartbeat);
      if (unsubscribe) unsubscribe();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
