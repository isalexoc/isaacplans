// node scripts/emit-manhattan-product-messages.mjs
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const PRODUCTS = [
  {
    slug: "all-products",
    en: {
      title: "All Manhattan Life plans",
      lead: "Start from the full product catalog on Manhattan Life’s direct enrollment site. Availability, underwriting, and benefits vary by state—confirm details in the official flow.",
      kw: "Manhattan Life, direct enrollment, Isaac Plans",
    },
    es: {
      title: "Todos los planes Manhattan Life",
      lead: "Comience desde el catálogo completo en el sitio de inscripción directa de Manhattan Life. Disponibilidad, suscripción y beneficios varían según el estado—confirme en el flujo oficial.",
      kw: "Manhattan Life, inscripción directa, Isaac Plans",
    },
  },
  {
    slug: "24-hour-accident",
    en: {
      title: "24 Hour Accident Insurance",
      lead: "Accident-focused coverage designed for quick access to benefits after a covered accident. Review triggers, limits, and exclusions in the quote.",
      kw: "24 hour accident insurance, Manhattan Life, Isaac Plans",
    },
    es: {
      title: "Seguro de accidentes 24 horas",
      lead: "Cobertura centrada en accidentes con acceso rápido a beneficios tras un accidente cubierto. Revise activadores, límites y exclusiones en la cotización.",
      kw: "seguro de accidentes 24 horas, Manhattan Life, Isaac Plans",
    },
  },
  {
    slug: "accident",
    en: {
      title: "Accident Insurance",
      lead: "Helps with out-of-pocket costs tied to covered accidents. Read the benefit schedule and limitations before you enroll.",
      kw: "accident insurance, Manhattan Life, Isaac Plans",
    },
    es: {
      title: "Seguro de accidentes",
      lead: "Ayuda con gastos de bolsillo por accidentes cubiertos. Lea el calendario de beneficios y limitaciones antes de inscribirse.",
      kw: "seguro de accidentes, Manhattan Life, Isaac Plans",
    },
  },
  {
    slug: "affordable-choice",
    en: {
      title: "Affordable Choice",
      lead: "A streamlined option to explore when you want predictable supplemental value—confirm what’s filed in your state in the quote.",
      kw: "Affordable Choice, Manhattan Life, Isaac Plans",
    },
    es: {
      title: "Affordable Choice",
      lead: "Una opción ágil cuando busca valor suplementario predecible—confirme lo presentado en su estado en la cotización.",
      kw: "Affordable Choice, Manhattan Life, Isaac Plans",
    },
  },
  {
    slug: "cancer-care-plus",
    en: {
      title: "Cancer Care Plus",
      lead: "Focused on cancer-related benefits—review waiting periods, benefit triggers, and coordination with other coverage.",
      kw: "Cancer Care Plus, Manhattan Life, Isaac Plans",
    },
    es: {
      title: "Cancer Care Plus",
      lead: "Enfocado en beneficios relacionados con cáncer—revise periodos de espera, activadores y coordinación con otra cobertura.",
      kw: "Cancer Care Plus, Manhattan Life, Isaac Plans",
    },
  },
  {
    slug: "cancer-heart-attack-stroke-mac",
    en: {
      title: "Cancer, Heart Attack & Stroke (CHASMAC)",
      lead: "Specified-disease style benefits—one of Manhattan Life’s CHAS product filings. Compare materials in the quote to see exact covered conditions.",
      kw: "CHASMAC, cancer heart attack stroke, Manhattan Life, Isaac Plans",
    },
    es: {
      title: "Cáncer, infarto y accidente cerebrovascular (CHASMAC)",
      lead: "Beneficios por enfermedades específicas—una presentación CHAS de Manhattan Life. Compare en la cotización las condiciones cubiertas.",
      kw: "CHASMAC, Manhattan Life, Isaac Plans",
    },
  },
  {
    slug: "cancer-heart-attack-stroke-lac",
    en: {
      title: "Cancer, Heart Attack & Stroke (CHASLAC)",
      lead: "Alternate CHAS filing with its own benefit design—always read the official summary in the enrollment path.",
      kw: "CHASLAC, cancer heart attack stroke, Manhattan Life, Isaac Plans",
    },
    es: {
      title: "Cáncer, infarto y accidente cerebrovascular (CHASLAC)",
      lead: "Presentación CHAS alternativa con su propio diseño de beneficios—lea el resumen oficial en el flujo de inscripción.",
      kw: "CHASLAC, Manhattan Life, Isaac Plans",
    },
  },
  {
    slug: "critical-protection-recovery",
    en: {
      title: "Critical Protection and Recovery",
      lead: "Critical illness style coverage with defined benefits—confirm diagnoses and payout rules in carrier materials.",
      kw: "Critical Protection and Recovery, Manhattan Life, Isaac Plans",
    },
    es: {
      title: "Protección crítica y recuperación",
      lead: "Cobertura tipo enfermedad crítica con beneficios definidos—confirme diagnósticos y reglas de pago en los materiales.",
      kw: "Manhattan Life, Isaac Plans",
    },
  },
  {
    slug: "dental-vision-hearing-select",
    en: {
      title: "Dental, Vision & Hearing Select",
      lead: "Supplemental dental, vision, and hearing benefits—networks and annual maximums vary; review the quote for your ZIP.",
      kw: "dental vision hearing, Manhattan Life, Isaac Plans",
    },
    es: {
      title: "Dental, visión y audición Select",
      lead: "Beneficios suplementarios de dental, visión y audición—redes y máximos anuales varían; revise la cotización para su código postal.",
      kw: "dental visión audición, Manhattan Life, Isaac Plans",
    },
  },
  {
    slug: "dental-vision-hearing",
    en: {
      title: "Dental, Vision and Hearing Insurance",
      lead: "Standalone dental, vision, and hearing coverage options—compare plan tiers and exclusions before enrolling.",
      kw: "dental vision hearing insurance, Manhattan Life, Isaac Plans",
    },
    es: {
      title: "Seguro dental, de visión y audición",
      lead: "Opciones independientes de dental, visión y audición—compare niveles y exclusiones antes de inscribirse.",
      kw: "Manhattan Life, Isaac Plans",
    },
  },
  {
    slug: "first-choice-blue-ribbon",
    en: {
      title: "First Choice Blue Ribbon Series",
      lead: "A bundled series offering from Manhattan Life—read the series-specific disclosures for your state.",
      kw: "First Choice Blue Ribbon, Manhattan Life, Isaac Plans",
    },
    es: {
      title: "Serie First Choice Blue Ribbon",
      lead: "Una oferta serie de Manhattan Life—lea las divulgaciones específicas de la serie para su estado.",
      kw: "Manhattan Life, Isaac Plans",
    },
  },
  {
    slug: "home-health-care",
    en: {
      title: "Home Health Care",
      lead: "Benefits that may help with eligible home health expenses—confirm visit limits and definitions in the policy summary.",
      kw: "home health care, Manhattan Life, Isaac Plans",
    },
    es: {
      title: "Cuidado de salud en el hogar",
      lead: "Beneficios que pueden ayudar con gastos elegibles de salud en el hogar—confirme límites de visitas en el resumen.",
      kw: "Manhattan Life, Isaac Plans",
    },
  },
  {
    slug: "home-health-care-select",
    en: {
      title: "Home Health Care Select",
      lead: "Select-tier home health benefits—compare this filing with other Manhattan Life home health options in the quote.",
      kw: "Home Health Care Select, Manhattan Life, Isaac Plans",
    },
    es: {
      title: "Home Health Care Select",
      lead: "Beneficios Select de salud en el hogar—compare esta presentación con otras opciones en la cotización.",
      kw: "Manhattan Life, Isaac Plans",
    },
  },
  {
    slug: "home-health-care-select-mac",
    en: {
      title: "Home Health Care Select (MAC)",
      lead: "Another Home Health Care Select filing—verify benefit schedules and eligibility in the official materials.",
      kw: "Home Health Care Select MAC, Manhattan Life, Isaac Plans",
    },
    es: {
      title: "Home Health Care Select (MAC)",
      lead: "Otra presentación Home Health Care Select—verifique calendarios de beneficios en los materiales oficiales.",
      kw: "Manhattan Life, Isaac Plans",
    },
  },
  {
    slug: "hospital-indemnity-select",
    en: {
      title: "Hospital Indemnity Select",
      lead: "Fixed cash benefits for covered hospital stays—this is not a substitute for major medical; read limitations carefully.",
      kw: "hospital indemnity, Manhattan Life, Isaac Plans",
    },
    es: {
      title: "Indemnización hospitalaria Select",
      lead: "Beneficios en efectivo por estancias hospitalarias cubiertas—no sustituye seguro mayor; lea las limitaciones.",
      kw: "indemnización hospitalaria, Manhattan Life, Isaac Plans",
    },
  },
  {
    slug: "omniflex-short-term-care",
    en: {
      title: "OmniFlex Short-Term Care",
      lead: "Short-term care coverage for qualifying situations—different from STM medical; confirm benefit periods in the quote.",
      kw: "short-term care, OmniFlex, Manhattan Life, Isaac Plans",
    },
    es: {
      title: "OmniFlex cuidado a corto plazo",
      lead: "Cobertura de cuidado a corto plazo para situaciones elegibles—distinta del STM médico; confirme periodos en la cotización.",
      kw: "cuidado a corto plazo, Manhattan Life, Isaac Plans",
    },
  },
  {
    slug: "out-of-pocket-protection",
    en: {
      title: "Out-of-Pocket Protection Plan",
      lead: "Designed to help with eligible out-of-pocket exposure—review coordination with major medical and plan caps.",
      kw: "out of pocket protection, Manhattan Life, Isaac Plans",
    },
    es: {
      title: "Plan de protección de gastos de bolsillo",
      lead: "Pensado para ayudar con gastos elegibles de bolsillo—revise coordinación con seguro mayor y topes del plan.",
      kw: "Manhattan Life, Isaac Plans",
    },
  },
  {
    slug: "secure-advantage-final-expense",
    en: {
      title: "Secure Advantage — Final Expense",
      lead: "Final expense / burial insurance positioning—confirm face amounts, age bands, and underwriting in the flow.",
      kw: "final expense, Secure Advantage, Manhattan Life, Isaac Plans",
    },
    es: {
      title: "Secure Advantage — gastos finales",
      lead: "Enfoque de seguro de gastos finales / sepelio—confirme montos, rangos de edad y suscripción en el flujo.",
      kw: "gastos finales, Manhattan Life, Isaac Plans",
    },
  },
];

function pageBlock(locale, p) {
  const { title, lead, kw } = locale === "en" ? p.en : p.es;
  const bodyEn =
    "This Manhattan Life product is accessed through the carrier’s authorized direct enrollment site. Benefits, underwriting, and availability depend on your state and plan—read all official materials before you apply.";
  const bodyEs =
    "Este producto Manhattan Life se accede por el sitio de inscripción directa autorizado. Beneficios, suscripción y disponibilidad dependen de su estado y plan—lea todos los materiales oficiales antes de solicitar.";
  const body = locale === "en" ? bodyEn : bodyEs;

  return {
    metadata: {
      title:
        locale === "en"
          ? `${title} | Manhattan Life | Isaac Plans`
          : `${title} | Manhattan Life | Isaac Plans`,
      description:
        locale === "en"
          ? `Learn about ${title} through Manhattan Life. Open the secure direct link; availability and benefits vary by state.`
          : `Información sobre ${title} con Manhattan Life. Abra el enlace directo seguro; disponibilidad y beneficios varían por estado.`,
      keywords: `${kw}`,
    },
    backNav: {
      label: locale === "en" ? "Back to Manhattan Life" : "Volver a Manhattan Life",
    },
    hero: {
      badge: locale === "en" ? "Manhattan Life" : "Manhattan Life",
      title,
      lead,
    },
    sections: {
      what: {
        title: locale === "en" ? "What it is" : "Qué es",
        body,
      },
      who: {
        title: locale === "en" ? "Who it may fit" : "Para quién puede ser",
        body:
          locale === "en"
            ? "Individuals exploring supplemental or specified-benefit coverage who want a licensed carrier path with transparent online enrollment."
            : "Personas que exploran cobertura suplementaria o de beneficios específicos con una compañía autorizada e inscripción en línea clara.",
      },
      confirm: {
        title:
          locale === "en" ? "What to confirm in the quote" : "Qué confirmar en la cotización",
        body:
          locale === "en"
            ? "Premiums, benefit schedules, exclusions, waiting periods, and any coordination rules shown for your ZIP code."
            : "Primas, calendarios de beneficios, exclusiones, periodos de espera y reglas de coordinación para su código postal.",
      },
      more: {
        title: locale === "en" ? "More to know" : "Más información",
        body:
          locale === "en"
            ? "Manhattan Life companies may issue policies under different legal entities by product and state. Marketing names can differ—your policy documents control."
            : "Las compañías Manhattan Life pueden emitir pólizas bajo distintas entidades según producto y estado. Los documentos de la póliza prevalecen.",
      },
    },
    faq: {
      title: locale === "en" ? "Common questions" : "Preguntas frecuentes",
      items: [
        {
          q:
            locale === "en"
              ? "Is this the same as ACA major medical?"
              : "¿Es lo mismo que un seguro mayor ACA?",
          a:
            locale === "en"
              ? "Not necessarily. These products are often supplemental or limited-benefit designs. Read how your plan is classified in the official quote."
              : "No necesariamente. Suele ser suplementario o de beneficios limitados. Lea cómo se clasifica su plan en la cotización oficial.",
        },
        {
          q:
            locale === "en"
              ? "Where do I enroll?"
              : "¿Dónde me inscribo?",
          a:
            locale === "en"
              ? "Use the secure Manhattan Life direct link on this page to open the authorized enrollment experience."
              : "Use el enlace directo seguro de Manhattan Life en esta página para abrir la experiencia autorizada.",
        },
        {
          q:
            locale === "en"
              ? "Is every product available in my state?"
              : "¿Todo está disponible en mi estado?",
          a:
            locale === "en"
              ? "No. Availability varies by state and product. The enrollment path will reflect what you can apply for."
              : "No. La disponibilidad varía por estado y producto. El flujo mostrará lo que puede solicitar.",
        },
        {
          q:
            locale === "en"
              ? "Can Isaac Plans help me compare?"
              : "¿Isaac Plans puede ayudarme a comparar?",
          a:
            locale === "en"
              ? "Yes—reach out if you want a second opinion before you enroll."
              : "Sí—escríbanos si desea una segunda opinión antes de inscribirse.",
        },
      ],
    },
    ctaBand: {
      title: locale === "en" ? "Quote and enroll" : "Cotizar e inscribirse",
      body:
        locale === "en"
          ? "Open the secure Manhattan Life direct link for this product."
          : "Abra el enlace directo seguro de Manhattan Life para este producto.",
    },
    disclaimer: {
      title: locale === "en" ? "Important" : "Importante",
      body:
        locale === "en"
          ? "Products, availability, underwriting, and benefits vary by state and plan. This page is educational and links to Manhattan Life’s authorized site. Isaac Plans Insurance may be compensated when you enroll through applicable carrier programs."
          : "Productos, disponibilidad, suscripción y beneficios varían por estado y plan. Esta página es educativa y enlaza al sitio autorizado de Manhattan Life. Isaac Plans Insurance puede recibir compensación al inscribirse en programas aplicables.",
    },
    highlights: {
      title: locale === "en" ? "At a glance" : "De un vistazo",
      items:
        locale === "en"
          ? [
              "Secure online enrollment through direct.manhattanlife.com",
              "Read state- and plan-specific disclosures in the flow",
              "Ask Isaac Plans if you want help comparing options",
            ]
          : [
              "Inscripción en línea segura en direct.manhattanlife.com",
              "Lea las divulgaciones específicas de estado y plan en el flujo",
              "Pregunte a Isaac Plans si desea ayuda para comparar",
            ],
    },
  };
}

function hub(locale) {
  const en = locale === "en";
  return {
    metadata: {
      title: en
        ? "Manhattan Life | Products & enrollment | Isaac Plans"
        : "Manhattan Life | Productos e inscripción | Isaac Plans",
      description: en
        ? "Explore Manhattan Life products—short-term medical, indemnity, dental, and more. Start secure direct enrollment or get personalized help from Isaac Plans."
        : "Explore productos Manhattan Life—STM, indemnización, dental y más. Inicie inscripción directa segura o reciba ayuda personalizada de Isaac Plans.",
      keywords: en
        ? "Manhattan Life, supplemental insurance, short term medical, Isaac Plans"
        : "Manhattan Life, seguro suplementario, cobertura a corto plazo, Isaac Plans",
    },
    backNav: {
      label: en ? "Back to carriers" : "Volver a aseguradoras",
    },
    hero: {
      badge: en ? "Manhattan Life" : "Manhattan Life",
      title: en
        ? "Manhattan Life products—quote the plan that fits"
        : "Productos Manhattan Life—cotice el plan adecuado",
      lead: en
        ? "Browse supplemental, indemnity, and short-term strategies filed by Manhattan Life. Each card opens your authorized direct enrollment link; short-term medical has its own guided page."
        : "Explore opciones suplementarias, de indemnización y a corto plazo presentadas por Manhattan Life. Cada tarjeta abre su enlace de inscripción directa; el STM tiene su propia página.",
    },
    stm: {
      badge: en ? "Popular" : "Popular",
      title: en ? "Short-term medical (STLDI)" : "Seguro médico temporal (STLDI)",
      body: en
        ? "Bridge coverage between major medical plans with Manhattan Life’s STM experience—state- and form-dependent."
        : "Cubra brechas entre planes mayores con la experiencia STM de Manhattan Life—depende del estado y formulario.",
      cta: en ? "View short-term medical" : "Ver seguro médico temporal",
    },
    productsSection: {
      title: en ? "All direct enrollment products" : "Todos los productos de inscripción directa",
      subtitle: en
        ? "Choose a product to read more, or jump straight to enrollment."
        : "Elija un producto para leer más o vaya directo a la inscripción.",
    },
    disclaimer: {
      title: en ? "Important" : "Importante",
      body: en
        ? "Products, availability, underwriting, and benefits vary by state and plan. This hub links to Manhattan Life’s authorized quoting site (direct.manhattanlife.com). You leave IsaacPlans.com; carrier terms and licensing apply. Isaac Plans Insurance may be compensated when you enroll through applicable programs."
        : "Productos, disponibilidad, suscripción y beneficios varían por estado y plan. Este hub enlaza al sitio autorizado (direct.manhattanlife.com). Sale de IsaacPlans.com; aplican términos y licencias. Isaac Plans Insurance puede recibir compensación al inscribirse.",
    },
  };
}

function build(locale) {
  const products = {};
  for (const p of PRODUCTS) {
    products[p.slug] = pageBlock(locale, p);
  }

  return {
    manhattan: {
      productPages: {
        labels: {
          quoteCta: locale === "en" ? "Get quote & enroll" : "Cotizar e inscribirse",
          learnMore: locale === "en" ? "Learn more" : "Más información",
          breadcrumbHub: locale === "en" ? "Manhattan Life" : "Manhattan Life",
        },
        shared: {
          logoAlt: locale === "en" ? "Manhattan Life" : "Manhattan Life",
          contactClosing: {
            title:
              locale === "en"
                ? "Want help comparing options?"
                : "¿Quiere ayuda para comparar?",
            body:
              locale === "en"
                ? "Reach out for a personalized walkthrough—whether you already used the direct links or want Isaac to review alternatives."
                : "Escríbanos para una guía personalizada—ya haya usado los enlaces o quiera que Isaac revise alternativas.",
          },
          enrollmentSteps: {
            title: locale === "en" ? "How enrollment works" : "Cómo funciona la inscripción",
            subtitle:
              locale === "en"
                ? "Three simple steps. Timing and requirements vary by state and product."
                : "Tres pasos sencillos. Plazos y requisitos varían por estado y producto.",
            step1Title: locale === "en" ? "Open your direct link" : "Abra su enlace directo",
            step1Body:
              locale === "en"
                ? "Use the Manhattan Life button to launch the authorized enrollment experience for the product you chose."
                : "Use el botón de Manhattan Life para abrir la experiencia autorizada del producto elegido.",
            step2Title: locale === "en" ? "Review and apply" : "Revise y solicite",
            step2Body:
              locale === "en"
                ? "Read plan materials carefully, then complete the application when you are ready."
                : "Lea los materiales con atención y complete la solicitud cuando esté listo.",
            step3Title: locale === "en" ? "Confirm your coverage" : "Confirme su cobertura",
            step3Body:
              locale === "en"
                ? "Save documents and follow Manhattan Life’s instructions for payment and effective date."
                : "Guarde documentos y siga las instrucciones de Manhattan Life para pago y vigencia.",
          },
        },
        hub: hub(locale),
        products,
      },
    },
  };
}

const enOut = build("en");
const esOut = build("es");

fs.writeFileSync(
  path.join(root, "messages/en/carriers/manhattan-product-pages.json"),
  JSON.stringify(enOut, null, 2) + "\n"
);
fs.writeFileSync(
  path.join(root, "messages/es/carriers/manhattan-product-pages.json"),
  JSON.stringify(esOut, null, 2) + "\n"
);

console.log("Wrote manhattan-product-pages.json (en + es)");
