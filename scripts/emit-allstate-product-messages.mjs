// One-off generator: node scripts/emit-allstate-product-messages.mjs
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

function page(title, lead, kw) {
  return {
    metadata: {
      title: `${title} | Allstate Health Solutions | Isaac Plans`,
      description: `Learn about ${title} through Allstate Health Solutions. Start a secure quote; availability and benefits vary by state.`,
      keywords: `${kw}, Allstate Health Solutions, National General, Isaac Plans`,
    },
    backNav: { label: "Back to Allstate Health Solutions" },
    hero: {
      badge: "Allstate Health Solutions",
      title,
      lead,
    },
    sections: {
      what: {
        title: "What it is",
        body: "This Allstate Health Solutions product line is offered through the National General enrollment experience. Benefits, underwriting, and availability depend on your state and the plan you select—always read official materials in the quote flow.",
      },
      who: {
        title: "Who it may fit",
        body: "Shoppers who want a clear online path to compare options and enroll may use this product when it is available for their situation. Confirm suitability with a licensed professional for your specific needs.",
      },
      confirm: {
        title: "What to confirm in the quote",
        body: "Review premiums, benefit schedules, exclusions, waiting periods, and any network or program details shown for your ZIP code. Confirm effective dates and how this plan coordinates with other coverage you carry.",
      },
      more: {
        title: "More to know",
        body: "Allstate Health Solutions connects you to trusted carriers and digital enrollment tools. The underwriting company on your policy is the legal issuer—names and forms can vary by state.",
      },
    },
    faq: {
      title: "Common questions",
      items: [
        {
          q: "Is this the same as major medical ACA coverage?",
          a: "Not necessarily. Products differ widely. Read disclosures in the official quote to see how your plan is classified and what it covers.",
        },
        {
          q: "Where do I enroll?",
          a: "Use the secure quick-quote link on this page to open the National General enrollment experience for Allstate Health Solutions.",
        },
        {
          q: "Is every product available in my state?",
          a: "No. Availability varies by state and product. The quote path will show what you can apply for in your area.",
        },
        {
          q: "Can Isaac Plans help me compare?",
          a: "Yes. Reach out if you want a second opinion before you enroll.",
        },
      ],
    },
    ctaBand: {
      title: "Quote and enroll",
      body: "Use the button below to open the secure National General quick-quote flow for this product.",
    },
    disclaimer: {
      title: "Important",
      body: "Products, availability, underwriting, and benefits vary by state and plan. This page is educational and links to the carrier’s authorized quoting experience. Read all disclosures before you enroll. Isaac Plans Insurance may be compensated when you enroll through applicable carrier programs.",
    },
    highlights: {
      title: "At a glance",
      items: [
        "Secure online quoting through National General",
        "Read your state-specific disclosures in the flow",
        "Confirm details with a licensed professional if unsure",
      ],
    },
  };
}

const seniors = {
  "all-products": page(
    "All senior products—quote in one place",
    "Start from the full senior catalog to compare Allstate Health Solutions options available for your ZIP code. Not all products are offered in every state.",
    "senior health products"
  ),
  "dental-vision-hearing": page(
    "Dental, vision & hearing for seniors",
    "Dental, vision, and hearing benefits designed for senior markets—use the quote flow to see plan options for your area.",
    "dental vision hearing seniors"
  ),
  "senior-indemnity": page(
    "Senior indemnity",
    "Supplemental indemnity-style benefits for seniors—cash-style benefits for covered events vary by plan; confirm schedules in the quote.",
    "senior indemnity"
  ),
  "my-life-senior": page(
    "My LIFE Senior",
    "My LIFE Senior products through Allstate Health Solutions—review benefits and premiums in the secure quote for your ZIP code.",
    "My LIFE Senior"
  ),
};

const individual = {
  accident: page(
    "Accident insurance",
    "Accident coverage that pays benefits for covered injuries according to your policy—compare options and enroll through the secure flow.",
    "accident insurance"
  ),
  dental: page(
    "Individual dental",
    "Individual dental coverage options—networks, annual maximums, and premiums vary; confirm in the official quote.",
    "dental insurance individual"
  ),
  "life-cancer-critical-illness": page(
    "Life, cancer & critical illness",
    "Protection for life, cancer, and critical illness needs—details and issue ages vary by state and form.",
    "critical illness cancer life insurance"
  ),
  "fixed-benefit-indemnity": page(
    "Fixed-benefit indemnity",
    "Fixed indemnity benefits pay preset amounts for covered services—use the quote to see schedules and limits for your state.",
    "fixed indemnity"
  ),
  "my-life-wellness": page(
    "My LIFE wellness",
    "Wellness-oriented coverage through My LIFE—review benefits and enrollment rules in the secure quote path.",
    "wellness insurance"
  ),
};

const cancerOnly = page(
  "Cancer-only coverage",
  "Focused cancer coverage options—read benefit triggers, waiting periods, and exclusions in the official materials for your state.",
  "cancer insurance"
);

const hub = {
  metadata: {
    title: "Allstate Health Solutions | Products & enrollment | Isaac Plans",
    description:
      "Explore Allstate Health Solutions products—short-term medical, senior lines, and individual coverage. Start secure quotes or get personalized help.",
    keywords: "Allstate Health Solutions, National General, supplemental insurance, Isaac Plans",
  },
  backNav: { label: "Back to carriers" },
  hero: {
    badge: "Allstate Health Solutions",
    title: "Compare products and enroll online",
    lead: "Choose short-term medical, senior-focused benefits, or individual coverage lines available through Allstate Health Solutions. Every path uses the same secure National General enrollment experience when you are ready to quote.",
  },
  stm: {
    title: "Short-term medical (STLDI)",
    body: "Bridge coverage between major medical plans with clear STLDI disclosures and a guided online experience.",
    cta: "View short-term medical",
    badge: "Popular",
  },
  seniorsSection: {
    title: "Seniors",
    subtitle: "Products commonly used with Medicare-age planning—availability varies.",
  },
  individualSection: {
    title: "Individual",
    subtitle: "Accident, dental, indemnity, and wellness lines—subject to underwriting.",
  },
  cancerStrip: {
    title: "Cancer-only coverage",
    body: "Standalone cancer product—see benefit triggers and limitations in the quote.",
    cta: "Learn more",
  },
  disclaimer: {
    title: "Important",
    body: "Products, availability, underwriting, and benefits vary by state and plan. This hub is educational and links to carrier enrollment experiences. Isaac Plans Insurance may be compensated when you enroll through applicable carrier programs.",
  },
};

const shared = {
  logoAlt: "Allstate Health Solutions",
  contactClosing: {
    title: "Want help comparing options?",
    body: "Reach out for a personalized walkthrough—whether you already used the quote links or want Isaac to review alternatives.",
  },
  enrollmentSteps: {
    title: "How enrollment works",
    subtitle: "Three simple steps. Timing and requirements vary by state and product.",
    step1Title: "Get your quote",
    step1Body:
      "Enter your ZIP and details in the secure National General quick-quote flow.",
    step2Title: "Review and apply",
    step2Body:
      "Read the plan materials carefully, then complete the online application when you are ready.",
    step3Title: "Confirm your coverage",
    step3Body:
      "Save your documents and follow the carrier’s instructions for payment and effective date.",
  },
};

const labels = {
  quoteCta: "Get quote & enroll",
  learnMore: "Learn more",
  breadcrumbHub: "Allstate Health Solutions",
  breadcrumbSeniors: "Seniors",
  breadcrumbIndividual: "Individual",
};

const en = {
  allstate: {
    productPages: {
      labels,
      shared,
      hub,
      seniors,
      individual,
      cancerOnly,
    },
  },
};

const es = {
  allstate: {
    productPages: {
      labels: {
        quoteCta: "Cotizar e inscribirse",
        learnMore: "Más información",
        breadcrumbHub: "Allstate Health Solutions",
        breadcrumbSeniors: "Adultos mayores",
        breadcrumbIndividual: "Individual",
      },
      shared: {
        logoAlt: "Allstate Health Solutions",
        contactClosing: {
          title: "¿Quiere ayuda para comparar opciones?",
          body: "Contáctenos para una guía personalizada—ya haya usado los enlaces de cotización o quiera que Isaac revise alternativas.",
        },
        enrollmentSteps: {
          title: "Cómo funciona la inscripción",
          subtitle: "Tres pasos simples. Los plazos y requisitos varían según el estado y el producto.",
          step1Title: "Obtenga su cotización",
          step1Body:
            "Ingrese su código postal y datos en el flujo seguro de cotización rápida de National General.",
          step2Title: "Revise y solicite",
          step2Body:
            "Lea los materiales del plan con atención y complete la solicitud en línea cuando esté listo.",
          step3Title: "Confirme su cobertura",
          step3Body:
            "Guarde sus documentos y siga las instrucciones de la aseguradora para el pago y la fecha de inicio.",
        },
      },
      hub: {
        metadata: {
          title: "Allstate Health Solutions | Productos e inscripción | Isaac Plans",
          description:
            "Explore productos de Allstate Health Solutions—médico temporal, líneas para adultos mayores y cobertura individual. Inicie cotizaciones seguras u obtenga ayuda personalizada.",
          keywords:
            "Allstate Health Solutions, National General, seguro suplementario, Isaac Plans",
        },
        backNav: { label: "Volver a aseguradoras" },
        hero: {
          badge: "Allstate Health Solutions",
          title: "Compare productos e inscríbase en línea",
          lead: "Elija seguro médico temporal, beneficios para adultos mayores o líneas individuales disponibles con Allstate Health Solutions. Cada ruta usa la experiencia segura de inscripción de National General cuando esté listo para cotizar.",
        },
        stm: {
          title: "Seguro médico temporal (STLDI)",
          body: "Cobertura puente entre planes mayores con avisos claros de STLDI y una experiencia guiada en línea.",
          cta: "Ver seguro médico temporal",
          badge: "Popular",
        },
        seniorsSection: {
          title: "Adultos mayores",
          subtitle:
            "Productos usados con frecuencia en la planificación cercana a Medicare—la disponibilidad varía.",
        },
        individualSection: {
          title: "Individual",
          subtitle:
            "Accidentes, dental, indemnidad y bienestar—sujeto a suscripción.",
        },
        cancerStrip: {
          title: "Solo cáncer",
          body: "Producto independiente para cáncer—vea disparadores de beneficios y límites en la cotización.",
          cta: "Más información",
        },
        disclaimer: {
          title: "Importante",
          body: "Los productos, la disponibilidad, la suscripción y los beneficios varían según el estado y el plan. Este centro es educativo y enlaza a las experiencias de inscripción de la aseguradora. Isaac Plans Insurance puede recibir compensación cuando se inscribe mediante programas aplicables.",
        },
      },
      seniors: Object.fromEntries(
        Object.entries(seniors).map(([k, v]) => [
          k,
          {
            ...v,
            backNav: { label: "Volver a Allstate Health Solutions" },
            metadata: {
              ...v.metadata,
              title: v.metadata.title.replace("Isaac Plans", "Isaac Plans"),
            },
            hero: { ...v.hero, badge: "Allstate Health Solutions · Adultos mayores" },
            faq: { ...v.faq, title: "Preguntas frecuentes" },
            sections: {
              what: {
                title: "Qué es",
                body: v.sections.what.body,
              },
              who: {
                title: "Para quién puede ser",
                body: v.sections.who.body,
              },
              confirm: {
                title: "Qué confirmar en la cotización",
                body: v.sections.confirm.body,
              },
              more: {
                title: "Más información",
                body: v.sections.more.body,
              },
            },
            ctaBand: {
              title: "Cotizar e inscribirse",
              body: "Use el botón de abajo para abrir el flujo seguro de cotización rápida de National General para este producto.",
            },
            disclaimer: {
              title: "Importante",
              body: "Los productos, la disponibilidad, la suscripción y los beneficios varían según el estado y el plan. Esta página es educativa y enlaza a la experiencia de cotización autorizada. Lea todos los avisos antes de inscribirse. Isaac Plans Insurance puede recibir compensación cuando se inscribe mediante programas aplicables.",
            },
            highlights: {
              title: "En resumen",
              items: [
                "Cotización en línea segura con National General",
                "Lea los avisos específicos de su estado en el flujo",
                "Confirme con un profesional licenciado si tiene dudas",
              ],
            },
          },
        ])
      ),
      individual: Object.fromEntries(
        Object.entries(individual).map(([k, v]) => [
          k,
          {
            ...v,
            backNav: { label: "Volver a Allstate Health Solutions" },
            hero: { ...v.hero, badge: "Allstate Health Solutions · Individual" },
            faq: { ...v.faq, title: "Preguntas frecuentes" },
            sections: {
              what: {
                title: "Qué es",
                body: v.sections.what.body,
              },
              who: {
                title: "Para quién puede ser",
                body: v.sections.who.body,
              },
              confirm: {
                title: "Qué confirmar en la cotización",
                body: v.sections.confirm.body,
              },
              more: {
                title: "Más información",
                body: v.sections.more.body,
              },
            },
            ctaBand: {
              title: "Cotizar e inscribirse",
              body: "Use el botón de abajo para abrir el flujo seguro de cotización rápida de National General para este producto.",
            },
            disclaimer: {
              title: "Importante",
              body: "Los productos, la disponibilidad, la suscripción y los beneficios varían según el estado y el plan. Esta página es educativa y enlaza a la experiencia de cotización autorizada. Lea todos los avisos antes de inscribirse. Isaac Plans Insurance puede recibir compensación cuando se inscribe mediante programas aplicables.",
            },
            highlights: {
              title: "En resumen",
              items: [
                "Cotización en línea segura con National General",
                "Lea los avisos específicos de su estado en el flujo",
                "Confirme con un profesional licenciado si tiene dudas",
              ],
            },
          },
        ])
      ),
      cancerOnly: {
        ...cancerOnly,
        backNav: { label: "Volver a Allstate Health Solutions" },
        hero: { ...cancerOnly.hero, badge: "Allstate Health Solutions" },
        faq: { ...cancerOnly.faq, title: "Preguntas frecuentes" },
        sections: {
          what: { title: "Qué es", body: cancerOnly.sections.what.body },
          who: { title: "Para quién puede ser", body: cancerOnly.sections.who.body },
          confirm: {
            title: "Qué confirmar en la cotización",
            body: cancerOnly.sections.confirm.body,
          },
          more: { title: "Más información", body: cancerOnly.sections.more.body },
        },
        ctaBand: {
          title: "Cotizar e inscribirse",
          body: "Use el botón de abajo para abrir el flujo seguro de cotización rápida de National General para este producto.",
        },
        disclaimer: {
          title: "Importante",
          body: "Los productos, la disponibilidad, la suscripción y los beneficios varían según el estado y el plan. Esta página es educativa y enlaza a la experiencia de cotización autorizada. Lea todos los avisos antes de inscribirse. Isaac Plans Insurance puede recibir compensación cuando se inscribe mediante programas aplicables.",
        },
        highlights: {
          title: "En resumen",
          items: [
            "Cotización en línea segura con National General",
            "Lea los avisos específicos de su estado en el flujo",
            "Confirme con un profesional licenciado si tiene dudas",
          ],
        },
      },
    },
  },
};

for (const [name, data] of [
  ["en", en],
  ["es", es],
]) {
  const fp = path.join(root, "messages", name, "carriers", "allstate-product-pages.json");
  fs.mkdirSync(path.dirname(fp), { recursive: true });
  fs.writeFileSync(fp, JSON.stringify(data, null, 2), "utf8");
  console.log("Wrote", fp);
}
