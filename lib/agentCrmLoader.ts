// lib/agentCrmLoader.ts  (same as you have)
let loaderPromise: Promise<void> | null = null;

export function loadAgentCrmOnce(): Promise<void> {
  if (loaderPromise) return loaderPromise;

  loaderPromise = new Promise<void>((resolve, reject) => {
    if (document.querySelector('script[data-agent-crm="1"]')) {
      resolve();
      return;
    }
    const s = document.createElement("script");
    s.src = "https://link.agent-crm.com/js/form_embed.js";
    s.async = true;
    s.dataset.agentCrm = "1";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Agent CRM script failed to load"));
    document.head.appendChild(s);
  });

  return loaderPromise;
}
