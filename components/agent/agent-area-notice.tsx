/**
 * What the agent area says to someone it can't show applications to: an admin (Isaac's role
 * works in /admin), an impersonated session (refused, as the DPA promises), an account with no
 * agent row, or an agent whose account isn't open for applications yet (invited, paused, or a real
 * agent while the pilot is closed). Server component; plain links only (see agent-app-shell.tsx).
 */

import type { ReactNode } from "react";
import { Clock, PauseCircle, ShieldAlert, UserX } from "lucide-react";
import AgentSignOutButton from "@/components/agent/agent-sign-out-button";
import { agentAreaPath, type AgentAreaLocale } from "@/lib/tenancy/agent-area-routes";
import type { AgentAreaNoticeKind } from "@/lib/tenancy/agent-area";

const NOTICE = {
  en: {
    admin: {
      title: "This is the agent area",
      body: "You're signed in with an admin account. Admin accounts never work as agents: manage agents in Admin, Agent Platform.",
      link: "Open Agent Platform",
    },
    impersonated: {
      title: "Not available while impersonating",
      body: "The agent area is closed to impersonated sessions: an agent's clients are only ever seen by that agent.",
    },
    not_agent: {
      title: "This account isn't linked to an agent",
      body: "If you were invited, sign out and sign in with the email address the invitation was sent to.",
    },
    signed_out: { title: "Sign in to continue", body: "The agent area needs your sign-in." },
    signOut: "Sign out",
  },
  es: {
    admin: {
      title: "Esta es el área de agentes",
      body: "Usted entró con una cuenta de administrador. Las cuentas de administrador nunca trabajan como agentes: administre los agentes en Admin, Agent Platform.",
      link: "Abrir Agent Platform",
    },
    impersonated: {
      title: "No disponible al suplantar a alguien",
      body: "El área de agentes está cerrada a las sesiones suplantadas: los clientes de un agente solo los ve ese agente.",
    },
    not_agent: {
      title: "Esta cuenta no está vinculada a un agente",
      body: "Si recibió una invitación, cierre la sesión y entre con el correo al que llegó la invitación.",
    },
    signed_out: { title: "Inicie sesión para continuar", body: "El área de agentes necesita su acceso." },
    signOut: "Cerrar sesión",
  },
} as const;

function Card({ icon, title, body, children }: { icon: ReactNode; title: string; body: string; children?: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-lg px-4 py-16">
      <div className="rounded-2xl border border-[#e6e9ef] bg-white p-6 text-center shadow-sm dark:border-gray-800 dark:bg-gray-950">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#fbf6f2] dark:bg-gray-900">{icon}</div>
        <h1 className="mt-4 text-xl font-bold text-[#0b2a4a] dark:text-white">{title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-[#56657a] dark:text-gray-400">{body}</p>
        {children ? <div className="mt-5 flex flex-col items-center gap-3">{children}</div> : null}
      </div>
    </div>
  );
}

export default function AgentAreaNotice({ kind, locale }: { kind: AgentAreaNoticeKind; locale: AgentAreaLocale }) {
  const w = NOTICE[locale];
  if (kind === "admin") {
    return (
      <Card icon={<ShieldAlert className="h-6 w-6 text-[#0b2a4a]" />} title={w.admin.title} body={w.admin.body}>
        <a href="/en/admin/agents" className="font-semibold text-brand underline underline-offset-2">
          {w.admin.link}
        </a>
      </Card>
    );
  }
  if (kind === "impersonated") {
    return <Card icon={<ShieldAlert className="h-6 w-6 text-amber-600" />} title={w.impersonated.title} body={w.impersonated.body} />;
  }
  if (kind === "not_agent") {
    return (
      <Card icon={<UserX className="h-6 w-6 text-[#0b2a4a]" />} title={w.not_agent.title} body={w.not_agent.body}>
        <AgentSignOutButton label={w.signOut} redirectUrl={agentAreaPath(locale)} />
      </Card>
    );
  }
  return <Card icon={<UserX className="h-6 w-6 text-[#0b2a4a]" />} title={w.signed_out.title} body={w.signed_out.body} />;
}

const STATUS = {
  en: {
    invited: {
      title: "Your account is waiting for activation",
      body: "You can fill in your profile meanwhile. Your applications open here once your account is activated.",
    },
    paused: { title: "Your account is paused", body: "Applications are closed for now. Contact the platform to reopen your account." },
    pilot: {
      title: "Applications aren't open yet",
      body: "The platform is in a pilot: applications open for your account at launch. You can fill in your profile meanwhile.",
    },
    profile: "Go to your profile",
  },
  es: {
    invited: {
      title: "Su cuenta está esperando activación",
      body: "Mientras tanto puede completar su perfil. Sus solicitudes se abren aquí cuando su cuenta esté activada.",
    },
    paused: {
      title: "Su cuenta está en pausa",
      body: "Las solicitudes están cerradas por ahora. Comuníquese con la plataforma para reactivar su cuenta.",
    },
    pilot: {
      title: "Las solicitudes aún no están abiertas",
      body: "La plataforma está en un piloto: las solicitudes se abren para su cuenta en el lanzamiento. Mientras tanto puede completar su perfil.",
    },
    profile: "Ir a su perfil",
  },
} as const;

/** A linked agent who may not operate yet: why, in their words. */
export function AgentStatusNotice({ status, locale }: { status: string; locale: AgentAreaLocale }) {
  const w = STATUS[locale];
  const copy = status === "paused" ? w.paused : status === "active" ? w.pilot : w.invited;
  const icon =
    status === "paused" ? <PauseCircle className="h-6 w-6 text-amber-600" /> : <Clock className="h-6 w-6 text-[#0b2a4a]" />;
  return (
    <Card icon={icon} title={copy.title} body={copy.body}>
      <a href={agentAreaPath(locale, "profile")} className="font-semibold text-brand underline underline-offset-2">
        {w.profile}
      </a>
    </Card>
  );
}
