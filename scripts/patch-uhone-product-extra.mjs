/**
 * One-time patch: add sections.more + highlights to each product in uhone-product-pages.json
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const enPath = path.join(root, "messages/en/carriers/uhone-product-pages.json");
const esPath = path.join(root, "messages/es/carriers/uhone-product-pages.json");

const enExtras = {
  triterm: {
    more: {
      title: "More about TriTerm",
      body: "TriTerm is positioned for shoppers who need longer coverage than federal short-term rules allow for STLDI in many states. Plans may include network access similar to major medical designs; always compare total out-of-pocket exposure, exclusions, and renewal rules in the official quote. If you need ACA protections, maternity, or guaranteed issue for preexisting conditions, compare TriTerm side by side with Marketplace plans before you enroll.",
    },
    highlights: {
      title: "At a glance",
      items: [
        "Longer bridge than typical STLDI where TriTerm is offered",
        "Not Minimum Essential Coverage—review limitations carefully",
        "Availability and forms vary—quote path shows your state options",
      ],
    },
  },
  "health-protector": {
    more: {
      title: "More about fixed indemnity",
      body: "Fixed indemnity pays preset dollar amounts for covered services rather than paying after a deductible like traditional insurance. It can pair with high-deductible medical plans to create predictable cash flow for office visits and prescriptions. Coordination of benefits and tax treatment can be nuanced—read your certificate and consult a tax advisor for personal tax questions.",
    },
    highlights: {
      title: "At a glance",
      items: [
        "Cash benefits for covered services up to plan schedules",
        "May include wellness, visits, and Rx on many designs",
        "Not a substitute for comprehensive major medical coverage",
      ],
    },
  },
  "advantage-guard": {
    more: {
      title: "More about AdvantageGuard",
      body: "AdvantageGuard is built for older adults who want hospital-focused cash benefits—often alongside Medicare Advantage cost-sharing. Benefits are typically triggered by covered confinements and may include defined amounts per day or stay. Always confirm how benefits interact with Medicare, Medigap, or employer coverage before you rely on the policy for a large bill.",
    },
    highlights: {
      title: "At a glance",
      items: [
        "Designed for issue ages 60–90 in eligible states",
        "Supplemental—does not replace Medicare or Part D",
        "Review elimination periods and preexisting condition rules",
      ],
    },
  },
  "hospital-wise": {
    more: {
      title: "More about HospitalWise",
      body: "Guaranteed-issue hospital indemnity can be attractive when you want simplified underwriting and clear cash benefits for hospital events. Policies pay based on covered triggers in the certificate—not on whether a provider is in network for your major medical plan. Use the quote flow to see benefit schedules, maximums, and any waiting periods that apply in your state.",
    },
    highlights: {
      title: "At a glance",
      items: [
        "Guaranteed-issue designs may be available where filed",
        "Fixed benefits for covered hospital events—read triggers carefully",
        "Pairs with—not replaces—comprehensive medical coverage",
      ],
    },
  },
  "hospital-indemnity-gi": {
    more: {
      title: "More about GI hospital indemnity",
      body: "Guaranteed-issue products focus on simplified enrollment rules, but claims are still governed by policy language, waiting periods, and exclusions. If you have other insurance, ask how benefits coordinate and whether duplicate coverage rules apply. Keep copies of admissions and itemized bills to support timely claims.",
    },
    highlights: {
      title: "At a glance",
      items: [
        "Simplified underwriting at enrollment—claims follow policy terms",
        "Compare daily benefits, maximums, and benefit periods",
        "Medicare coordination rules vary—read disclosures",
      ],
    },
  },
  "hospital-guard": {
    more: {
      title: "More about Hospital Guard",
      body: "Hospital Guard is structured to complement high-deductible plans by paying fixed amounts when covered hospital events occur. Optional telehealth riders can add convenience for minor issues, but they are not a substitute for emergency care. Review accidental death benefits and any outpatient riders in your specific form.",
    },
    highlights: {
      title: "At a glance",
      items: [
        "Fixed cash benefits for covered admissions and related services",
        "Optional telehealth on some plans—confirm in the certificate",
        "Designed to cushion deductibles and cost-sharing",
      ],
    },
  },
  "hospital-safeguard": {
    more: {
      title: "More about supplemental indemnity",
      body: "Supplemental indemnity helps with out-of-pocket exposure from your primary plan by paying cash for covered events like admissions or surgery, depending on the policy. The right path on UHOne may differ by state—use the quote experience that matches your enrollment intent and read benefit maximums for each service category.",
    },
    highlights: {
      title: "At a glance",
      items: [
        "Cash benefits for defined events—check schedules and caps",
        "Keep major medical for comprehensive protection",
        "Confirm which UHOne quoting path matches your product",
      ],
    },
  },
  "critical-guard": {
    more: {
      title: "More about critical illness",
      body: "Critical illness insurance is about liquidity after a serious diagnosis: the lump sum can help with deductibles, travel for care, or time off work. Definitions matter—two policies may cover “cancer” differently. Review survival periods, recurrence benefits, and whether you can purchase multiple policies or riders for heart attack and stroke.",
    },
    highlights: {
      title: "At a glance",
      items: [
        "Lump-sum payment for defined diagnoses—read definitions closely",
        "Not a substitute for major medical or disability insurance",
        "Guaranteed-issue may be available on some forms",
      ],
    },
  },
  "term-life": {
    more: {
      title: "More about term life",
      body: "Term life is often the most affordable way to protect a mortgage or replace income during working years. Compare level-premium periods, conversion privileges to permanent coverage, and optional riders such as accelerated benefit or child term. Beneficiary designations should be kept current after major life events.",
    },
    highlights: {
      title: "At a glance",
      items: [
        "Pure protection for a defined term—no cash value",
        "Underwriting may include health questions or exams",
        "Review conversion and renewal options before you buy",
      ],
    },
  },
  "dental-wise": {
    more: {
      title: "More about DentalWise",
      body: "DentalWise and DentalWise Max (DVH) help budget for preventive care and reduce surprises on basic and major services. Annual maximums, waiting periods, and orthodontic coverage vary—if you expect major work soon, compare plans with shorter waiting periods and higher maximums, even if the premium is higher.",
    },
    highlights: {
      title: "At a glance",
      items: [
        "DVH bundles dental, vision, and hearing in one product line",
        "Save more by staying in the UnitedHealthcare dental network",
        "Orthodontia and implants vary—check the benefit summary",
      ],
    },
  },
  "dental-discount": {
    more: {
      title: "More about dental discount programs",
      body: "Discount programs reduce fees at participating dentists but do not pay claims like insurance. They can be a fit for people who primarily need cleanings and fillings at predictable savings. If you anticipate major restorative work, compare total out-of-pocket under a discount plan versus a traditional dental insurance plan with an annual maximum.",
    },
    highlights: {
      title: "At a glance",
      items: [
        "Reduced fees—not insurance payments",
        "No traditional annual maximum in the insurance sense",
        "Verify participating dentists near you before you join",
      ],
    },
  },
  "vision-wise": {
    more: {
      title: "More about vision coverage",
      body: "Standalone vision plans focus on routine exams and materials allowances for glasses or contacts. Medical eye disease is often covered under major medical—vision plans are for refractive care and materials. Compare lens options, frame allowances, and whether contact lens benefits replace eyeglass benefits in the same benefit year.",
    },
    highlights: {
      title: "At a glance",
      items: [
        "Routine exams and materials allowances—read frequency limits",
        "Maximize value with in-network optical retailers",
        "LASIK is often a discount—not full insurance coverage",
      ],
    },
  },
  "accident-wise": {
    more: {
      title: "More about accident coverage",
      body: "Accident insurance pays for accidental injuries on a schedule—think fractures, lacerations, or ER visits—not illness. It can pair well with high-deductible health plans for families with active lifestyles. Review exclusions for organized sports, aviation, or hazardous activities if they apply to you.",
    },
    highlights: {
      title: "At a glance",
      items: [
        "Accidental injuries only—illness is excluded",
        "Schedule-based benefits—compare amounts per injury type",
        "Often used as supplemental to medical coverage",
      ],
    },
  },
  "accident-pro": {
    more: {
      title: "More about Accident ProGuard",
      body: "ProGuard bundles can combine accident coverage with other supplemental lines where state filings allow. Bundles may simplify billing, but compare the package premium to buying standalone policies if you only need one type of protection. Read each module’s exclusions and maximums independently.",
    },
    highlights: {
      title: "At a glance",
      items: [
        "Modular designs—availability varies by state",
        "Compare bundle pricing vs. standalone policies",
        "Confirm which riders are included in your quote",
      ],
    },
  },
  "healthiest-you": {
    more: {
      title: "More about telehealth",
      body: "Telehealth is convenient for many non-emergency issues, but it is not appropriate for chest pain, stroke symptoms, severe bleeding, or other emergencies. Program rules vary for behavioral health visits and prescribing controlled substances. Register before you need care so you’re not troubleshooting login issues when you feel ill.",
    },
    highlights: {
      title: "At a glance",
      items: [
        "24/7 access on many programs for common illnesses",
        "Not for emergencies—call 911 or go to the ER",
        "May be bundled or sold separately—check your enrollment path",
      ],
    },
  },
  "mental-health": {
    more: {
      title: "More about behavioral health benefits",
      body: "Behavioral health benefits depend on the underlying product—ACA-compliant major medical has different parity rules than supplemental lines. Network access, visit limits, and teletherapy options vary. If you are in crisis, call 988 in the U.S. or your local emergency number; this page is not a crisis service.",
    },
    highlights: {
      title: "At a glance",
      items: [
        "Network and visit limits vary—check your certificate",
        "Teletherapy may be included—confirm cost-sharing",
        "For emergencies, use crisis lines—not a web quote",
      ],
    },
  },
};

const esExtras = {
  triterm: {
    more: {
      title: "Más sobre TriTerm",
      body: "TriTerm está orientado a quienes necesitan cobertura más prolongada que la que permiten las reglas federales del STLDI en muchos estados. Los planes pueden incluir acceso a red similar a diseños de mayor médico; compare siempre el gasto de bolsillo total, exclusiones y renovación en la cotización oficial. Si necesita protecciones del ACA, maternidad o emisión garantizada por preexistencias, compare TriTerm con planes del Mercado antes de inscribirse.",
    },
    highlights: {
      title: "En resumen",
      items: [
        "Puente más largo que el STLDI típico donde se ofrece TriTerm",
        "No es cobertura mínima esencial—revise limitaciones",
        "La disponibilidad y formas varían—la cotización muestra su estado",
      ],
    },
  },
  "health-protector": {
    more: {
      title: "Más sobre indemnización fija",
      body: "La indemnización fija paga montos fijos por servicios cubiertos en lugar de pagar tras un deducible como el seguro tradicional. Puede complementar planes con deducible alto. La coordinación de beneficios y el tratamiento fiscal pueden ser complejos—lea su certificado y consulte a un asesor fiscal para su caso.",
    },
    highlights: {
      title: "En resumen",
      items: [
        "Beneficios en efectivo según tablas de servicios cubiertos",
        "Puede incluir bienestar, consultas y medicamentos en muchos diseños",
        "No sustituye cobertura mayor médica integral",
      ],
    },
  },
  "advantage-guard": {
    more: {
      title: "Más sobre AdvantageGuard",
      body: "AdvantageGuard está pensado para adultos mayores que quieren beneficios en efectivo centrados en hospital—a menudo junto a copagos de Medicare Advantage. Los beneficios suelen activarse por internaciones cubiertas; confirme cómo interactúan con Medicare, Medigap o cobertura del empleador antes de depender de la póliza para una factura grande.",
    },
    highlights: {
      title: "En resumen",
      items: [
        "Diseñado para edades de emisión 60–90 en estados elegibles",
        "Suplemento—no reemplaza Medicare ni Parte D",
        "Revise carencias y reglas de preexistencias",
      ],
    },
  },
  "hospital-wise": {
    more: {
      title: "Más sobre HospitalWise",
      body: "La indemnización hospitalaria con emisión garantizada puede ser atractiva cuando busca suscripción simplificada y beneficios claros por eventos hospitalarios. Las pólizas pagan según activadores cubiertos en el certificado. Use la cotización para ver tablas, máximos y carencias en su estado.",
    },
    highlights: {
      title: "En resumen",
      items: [
        "Diseños de emisión garantizada donde estén presentados",
        "Beneficios fijos por eventos hospitalarios—lea activadores",
        "Complementa—no reemplaza—cobertura médica integral",
      ],
    },
  },
  "hospital-indemnity-gi": {
    more: {
      title: "Más sobre indemnización hospitalaria GI",
      body: "Los productos de emisión garantizada simplifican reglas al inscribirse, pero los reclamos siguen el lenguaje de la póliza, carencias y exclusiones. Si tiene otro seguro, pregunte por coordinación de beneficios. Guarde copias de ingresos y facturas detalladas para reclamos oportunos.",
    },
    highlights: {
      title: "En resumen",
      items: [
        "Suscripción simplificada—los reclamos siguen la póliza",
        "Compare beneficios diarios, máximos y periodos de beneficio",
        "Las reglas con Medicare varían—lea avisos",
      ],
    },
  },
  "hospital-guard": {
    more: {
      title: "Más sobre Hospital Guard",
      body: "Hospital Guard complementa planes con deducible alto pagando montos fijos ante eventos hospitalarios cubiertos. Los riders de telesalud añaden comodidad para problemas menores, pero no sustituyen emergencias. Revise beneficios por muerte accidental y cobertura ambulatoria en su forma.",
    },
    highlights: {
      title: "En resumen",
      items: [
        "Efectivo fijo por ingresos y servicios cubiertos",
        "Telesalud opcional en algunos planes—confirme en el certificado",
        "Ayuda a amortiguar deducibles y participación en costos",
      ],
    },
  },
  "hospital-safeguard": {
    more: {
      title: "Más sobre indemnización suplementaria",
      body: "La indemnización suplementaria ayuda con gastos de bolsillo del plan primario pagando efectivo por eventos cubiertos como ingresos o cirugía, según la póliza. La ruta correcta en UHOne puede variar por estado—use la cotización que coincida con su intención de inscripción y revise máximos por categoría de servicio.",
    },
    highlights: {
      title: "En resumen",
      items: [
        "Beneficios en efectivo por eventos definidos—revise tablas y topes",
        "Mantenga mayor médico para protección amplia",
        "Confirme qué ruta de cotización UHOne corresponde a su producto",
      ],
    },
  },
  "critical-guard": {
    more: {
      title: "Más sobre enfermedad crítica",
      body: "El seguro de enfermedad crítica aporta liquidez tras un diagnóstico grave: la suma puede ayudar con deducibles, viajes o tiempo fuera del trabajo. Las definiciones importan—dos pólizas pueden definir “cáncer” distinto. Revise periodos de supervivencia, recurrencia y si puede comprar varias pólizas o riders.",
    },
    highlights: {
      title: "En resumen",
      items: [
        "Pago global por diagnósticos definidos—lea definiciones",
        "No sustituye mayor médico ni seguro de incapacidad",
        "La emisión garantizada puede existir en algunas formas",
      ],
    },
  },
  "term-life": {
    more: {
      title: "Más sobre vida temporal",
      body: "La vida temporal suele ser la forma más asequible de proteger hipoteca o ingresos en años de trabajo. Compare periodos de prima nivel, privilegios de conversión a permanente y riders opcionales. Mantenga actualizados a los beneficiarios tras cambios importantes.",
    },
    highlights: {
      title: "En resumen",
      items: [
        "Protección pura por plazo definido—sin valor en efectivo",
        "La suscripción puede incluir preguntas de salud o exámenes",
        "Revise conversión y renovación antes de comprar",
      ],
    },
  },
  "dental-wise": {
    more: {
      title: "Más sobre DentalWise",
      body: "DentalWise y DentalWise Max (DVH) ayudan a presupuestar preventivo y reducir sorpresas en servicios básicos y mayores. Los máximos anuales, carencias y ortodoncia varían—si espera trabajo mayor pronto, compare planes con carencias más cortas y máximos más altos.",
    },
    highlights: {
      title: "En resumen",
      items: [
        "DVH agrupa dental, visión y audición en una línea",
        "Ahorre más permaneciendo en la red dental UnitedHealthcare",
        "Ortodoncia e implantes varían—revise el resumen de beneficios",
      ],
    },
  },
  "dental-discount": {
    more: {
      title: "Más sobre descuento dental",
      body: "Los programas de descuento reducen tarifas con dentistas participantes pero no pagan reclamos como el seguro. Pueden encajar si principalmente necesita limpiezas y empastes con ahorro predecible. Si anticipa trabajo restaurador mayor, compare el gasto total bajo descuento frente a un plan dental tradicional con máximo anual.",
    },
    highlights: {
      title: "En resumen",
      items: [
        "Tarifas reducidas—no pagos de seguro",
        "Sin máximo anual de seguro en el sentido tradicional",
        "Verifique dentistas participantes antes de unirse",
      ],
    },
  },
  "vision-wise": {
    more: {
      title: "Más sobre cobertura de visión",
      body: "Los planes de visión independientes se centran en exámenes de rutina y montos para gafas o contactos. Las enfermedades oculares médicas suelen ir al mayor médico. Compare opciones de lentes, monturas y si los beneficios de contactos sustituyen a los de anteojos en el mismo año de beneficio.",
    },
    highlights: {
      title: "En resumen",
      items: [
        "Exámenes de rutina y montos para materiales—vea límites de frecuencia",
        "Más valor con ópticas en red",
        "LASIK suele ser descuento—no cobertura plena",
      ],
    },
  },
  "accident-wise": {
    more: {
      title: "Más sobre cobertura de accidentes",
      body: "El seguro de accidentes paga lesiones accidentales según tabla—fracturas, cortes o urgencias—no enfermedad. Puede combinar bien con deducible alto para familias activas. Revise exclusiones por deportes organizados, aviación o actividades de riesgo si aplican.",
    },
    highlights: {
      title: "En resumen",
      items: [
        "Solo lesiones accidentales—excluye enfermedad",
        "Beneficios por tabla—compare montos por tipo de lesión",
        "Suele usarse como suplemento al médico",
      ],
    },
  },
  "accident-pro": {
    more: {
      title: "Más sobre Accident ProGuard",
      body: "ProGuard puede combinar accidentes con otras líneas suplementarias donde las presentaciones estatales lo permitan. Los paquetes pueden simplificar facturación, pero compare la prima del paquete con pólizas independientes si solo necesita un tipo de protección. Lea exclusiones y máximos de cada módulo.",
    },
    highlights: {
      title: "En resumen",
      items: [
        "Diseños modulares—la disponibilidad varía por estado",
        "Compare precio de paquete vs. pólizas separadas",
        "Confirme qué riders incluye su cotización",
      ],
    },
  },
  "healthiest-you": {
    more: {
      title: "Más sobre telesalud",
      body: "La telesalud es conveniente para muchos casos no urgentes, pero no para dolor torácico, síntomas de ACV, sangrado grave u otras emergencias. Las reglas varían para salud conductual y prescripción de sustancias controladas. Regístrese antes de necesitar atención.",
    },
    highlights: {
      title: "En resumen",
      items: [
        "Acceso 24/7 en muchos programas para dolencias comunes",
        "No es para emergencias—llame al 911 o vaya a urgencias",
        "Puede ir agrupado o vendido por separado—verifique su ruta",
      ],
    },
  },
  "mental-health": {
    more: {
      title: "Más sobre salud conductual",
      body: "Los beneficios de salud conductual dependen del producto subyacente—el mayor médico compatible con ACA tiene reglas de paridad distintas a las líneas suplementarias. Acceso a red, límites de visitas y telesalud varían. En crisis, llame al 988 en EE. UU. o al número de emergencia local; esta página no es servicio de crisis.",
    },
    highlights: {
      title: "En resumen",
      items: [
        "Red y límites de visitas varían—revise el certificado",
        "La telesalud puede incluirse—confirme costos",
        "En emergencias use líneas de crisis—no una cotización web",
      ],
    },
  },
};

function patch(filePath, extras) {
  const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const pages = data.uhone.productPages;
  for (const slug of Object.keys(extras)) {
    if (!pages[slug]) {
      console.warn("missing slug", slug);
      continue;
    }
    const cur = pages[slug];
    cur.sections = cur.sections || {};
    cur.sections.more = extras[slug].more;
    cur.highlights = extras[slug].highlights;
  }
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n");
  console.log("patched", filePath);
}

patch(enPath, enExtras);
patch(esPath, esExtras);
