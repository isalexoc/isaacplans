"use client";

import { useLanguage } from "@/hooks/useLanguage";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function TermsOfServicePage() {
  const { language } = useLanguage();

  /** ─────────────  CONTENIDO MULTILENGUAJE  ───────────── */
  const content = {
    es: {
      title: "Términos y Condiciones",
      lastUpdated: "Última actualización: 20 de junio de 2025",
      backToHome: "Volver al Inicio",
      sections: {
        /* 1 */
        sms: {
          title: "1. Términos y Condiciones de SMS",
          content:
            "Las siguientes políticas regulan todas las comunicaciones por SMS emitidas por Isaac Plans:",
          items: [
            "1 – Comunicación de consentimiento de SMS: Los números telefónicos obtenidos para consentimiento SMS no se comparten con terceros para fines de marketing.",
            "2 – Tipos de comunicaciones SMS: recordatorios de pago, avisos de inscripción y notificaciones de servicio. Ejemplos: «Estimado Cliente: le recordamos que su póliza caerá en inactividad…» o «Hola, este es un recordatorio amistoso de su próxima cita…». Puede responder STOP para dejar de recibir SMS en cualquier momento.",
            "3 – Frecuencia de mensajes: la frecuencia puede variar según la comunicación; por ejemplo, hasta 3 mensajes SMS por semana relacionados con su póliza o período de inscripción.",
            "4 – Posibles tarifas: se pueden aplicar cargos estándar de mensajes y datos, los cuales pueden variar si el SMS es nacional o internacional.",
            "5 – Método de inclusión (Opt-In): marcando la casilla de consentimiento en nuestros formularios en línea.",
            "6 – Método de exclusión (Opt-Out): puede darse de baja en cualquier momento respondiendo «STOP» o contactándonos directamente para ser eliminado.",
            "7 – Ayuda: si experimenta problemas, responda «AYUDA» o visite https://www.isaacplans.com/contact.",
            "8 – Divulgaciones estándar: podrían aplicarse tarifas de mensajes y datos. Para ayuda envíe AYUDA al (956) 302-1451. La frecuencia de mensajes puede variar.",
          ],
        },

        /* 2 */
        introduction: {
          title: "2. Introducción y Aceptación",
          content:
            'Bienvenido a Isaac Plans. Estos Términos y Condiciones ("Términos") rigen el uso de nuestros servicios de seguros y sitio web. Al utilizar nuestros servicios, usted acepta estos términos.',
        },

        /* 3 */
        services: {
          title: "3. Descripción de Servicios",
          content:
            "Isaac Plans Insurance proporciona los siguientes servicios:",
          items: [
            "Consultoría y asesoramiento en seguros ACA (Obamacare)",
            "Servicios de seguros Medicare (Partes A, B, C y D)",
            "Seguros de vida, dental y visión",
            "Comparación y análisis de planes de seguros",
            "Asistencia con inscripciones y renovaciones",
            "Soporte continuo y servicio al cliente",
            "Optimización de costos y análisis de subsidios",
          ],
        },

        /* 4 */
        eligibility: {
          title: "4. Elegibilidad y Licencias",
          content:
            "Nuestros servicios están disponibles para residentes de los estados donde Isaac Orraiz mantiene licencias activas. Actualmente contamos con licencias en más de 20 estados de EE.UU.",
        },

        /* 5 */
        responsibilities: {
          title: "5. Responsabilidades del Cliente",
          content: "Como cliente, usted se compromete a:",
          items: [
            "Proporcionar información precisa y completa durante el proceso de cotización",
            "Notificar cambios en su situación que puedan afectar su cobertura",
            "Revisar cuidadosamente todos los documentos de póliza antes de firmar",
            "Pagar primas directamente a la aseguradora según los términos acordados",
            "Cumplir con todos los términos de su póliza",
            "Mantener la confidencialidad de la información de su cuenta",
          ],
        },

        /* 6 */
        limitations: {
          title: "6. Limitaciones de Responsabilidad",
          content:
            "Isaac Plans actúa como intermediario entre usted y las compañías de seguros. Nuestras responsabilidades incluyen:",
          items: [
            "Proporcionar información precisa sobre planes disponibles",
            "Asistir en la solicitud e inscripción",
            "Brindar soporte durante la vigencia de su póliza",
            "Mantener la confidencialidad de su información",
          ],
          limitations: [
            "No somos responsables por decisiones de cobertura de las aseguradoras",
            "No garantizamos la aprobación de solicitudes",
            "No respondemos por cambios regulatorios o disponibilidad de planes",
            "Nuestra responsabilidad se limita a intermediación y asesoramiento",
          ],
        },

        /* 7 */
        privacy: {
          title: "7. Privacidad y Confidencialidad",
          content:
            "Nos comprometemos a proteger su privacidad conforme a nuestra Política de Privacidad:",
          items: [
            "Los números obtenidos para SMS no se comparten con terceros con fines de marketing",
            "Su información se usa exclusivamente para brindarle servicios de seguros",
            "Mantenemos estrictos estándares de confidencialidad",
            "Cumplimos con las normativas de protección de datos aplicables",
          ],
        },

        /* 8 */
        fees: {
          title: "8. Honorarios y Compensación",
          content:
            "Nuestros servicios suelen ser gratuitos para el consumidor. Recibimos compensación de las aseguradoras, lo cual no afecta el costo de su prima.",
        },

        /* 9 */
        termination: {
          title: "9. Terminación de Servicios",
          content:
            "Cualquiera de las partes puede terminar esta relación con notificación por escrito. Las pólizas vigentes continúan según sus propios términos.",
        },

        /* 10 */
        compliance: {
          title: "10. Cumplimiento Legal",
          content: "Operamos en cumplimiento total con:",
          items: [
            "Regulaciones estatales de seguros",
            "Ley de Cuidado de Salud Asequible (ACA)",
            "Regulaciones de Medicare y Medicaid",
            "Leyes de protección al consumidor",
            "Requisitos de licencias profesionales",
          ],
        },

        /* 11 */
        modifications: {
          title: "11. Modificaciones",
          content:
            "Nos reservamos el derecho de actualizar estos términos en cualquier momento. Las modificaciones serán efectivas tras su publicación.",
        },

        /* 12 */
        contact: {
          title: "12. Información de Contacto",
          content: "Para preguntas sobre estos Términos:",
          details: [
            "Agente: Isaac Orraiz",
            "Email: info@isaacplans.com",
            "Tel: (540) 681-3507",
          ],
        },
      },
    },

    /* ─────────────  ENGLISH VERSION ───────────── */
    en: {
      title: "Terms and Conditions",
      lastUpdated: "Last updated: June 20, 2025",
      backToHome: "Back to Home",
      sections: {
        /* 1 */
        sms: {
          title: "1. SMS Terms and Conditions",
          content:
            "The following policies govern all SMS communications issued by Isaac Plans:",
          items: [
            "1 – SMS Consent Communication: phone numbers collected for SMS consent are not shared with third parties for marketing purposes.",
            "2 – Types of SMS: payment reminders, enrollment notices and service notifications. Examples: “Dear Client: we remind you that your policy is about to lapse…” or “Hi, this is a friendly reminder of your upcoming appointment…”. You may reply STOP at any time to opt out.",
            "3 – Message Frequency: frequency may vary; for example, up to 3 SMS per week related to your policy or enrollment period.",
            "4 – Possible Charges: standard message and data rates may apply, and may vary for domestic or international SMS.",
            "5 – Opt-In Method: by checking the SMS-consent box in our online forms.",
            "6 – Opt-Out Method: you may stop receiving SMS at any time by replying “STOP” or contacting us directly to be removed.",
            "7 – Help: reply “HELP” or visit https://www.isaacplans.com/contact if you need assistance.",
            "8 – Standard Disclosure: message/data rates may apply. For help text HELP to (956) 302-1451. Message frequency varies.",
          ],
        },

        /* 2 */
        introduction: {
          title: "2. Introduction and Acceptance",
          content:
            "Welcome to Isaac Plans. These Terms and Conditions (“Terms”) govern the use of our insurance services and website. By using our services, you agree to these terms.",
        },

        /* 3 */
        services: {
          title: "3. Description of Services",
          content: "Isaac Plans provides the following services:",
          items: [
            "ACA (Obamacare) insurance consulting and advisory",
            "Medicare insurance services (Parts A, B, C and D)",
            "Life, dental and vision insurance",
            "Plan comparison and analysis",
            "Enrollment and renewal assistance",
            "Ongoing support and customer service",
            "Cost-optimisation and subsidy analysis",
          ],
        },

        /* 4 */
        eligibility: {
          title: "4. Eligibility and Licenses",
          content:
            "Our services are available in the states where Isaac Orraiz holds active licenses—currently 9+ U.S. states.",
        },

        /* 5 */
        responsibilities: {
          title: "5. Client Responsibilities",
          content: "As a client, you agree to:",
          items: [
            "Provide accurate and complete information during the quote process",
            "Notify changes that may affect your coverage",
            "Review all policy documents carefully before signing",
            "Pay premiums directly to the insurer as agreed",
            "Comply with all policy terms",
            "Maintain confidentiality of your account information",
          ],
        },

        /* 6 */
        limitations: {
          title: "6. Liability Limitations",
          content:
            "Isaac Plans acts as an intermediary between you and insurance companies. Our responsibilities include:",
          items: [
            "Providing accurate information about available plans",
            "Assisting with application and enrollment",
            "Offering support during the policy term",
            "Keeping your information confidential",
          ],
          limitations: [
            "Not responsible for coverage decisions by insurers",
            "No guarantee of application approval",
            "Not responsible for regulatory changes or plan availability",
            "Liability limited to intermediation and advisory services",
          ],
        },

        /* 7 */
        privacy: {
          title: "7. Privacy and Confidentiality",
          content:
            "We are committed to protecting your privacy according to our Privacy Policy:",
          items: [
            "Numbers collected for SMS consent are not shared with third parties for marketing",
            "Your data is used solely to provide insurance services",
            "We maintain strict confidentiality standards",
            "We comply with all applicable data-protection regulations",
          ],
        },

        /* 8 */
        fees: {
          title: "8. Fees and Compensation",
          content:
            "Our consulting services are generally free to consumers. We are compensated by insurers, which does not affect your premium.",
        },

        /* 9 */
        termination: {
          title: "9. Service Termination",
          content:
            "Either party may terminate this relationship with written notice. Policies in force remain subject to their own terms.",
        },

        /* 10 */
        compliance: {
          title: "10. Legal Compliance",
          content: "Isaac Plans operates in full compliance with:",
          items: [
            "State insurance regulations",
            "Affordable Care Act (ACA)",
            "Medicare and Medicaid regulations",
            "Federal and state consumer-protection laws",
            "Professional licensing requirements",
          ],
        },

        /* 11 */
        modifications: {
          title: "11. Modifications",
          content:
            "We reserve the right to update these terms at any time. Changes take effect once posted on this page.",
        },

        /* 12 */
        contact: {
          title: "12. Contact Information",
          content: "For questions about these Terms:",
          details: [
            "Agent: Isaac Orraiz",
            "Email: info@isaacplans.com",
            "Phone: (540) 681-3507",
          ],
        },
      },
    },
  };

  const t = content[language];

  /** ─────────────  RENDER  ───────────── */
  return (
    <div className="min-h-screen bg-white">
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-4xl">
          {/* Back link */}
          <div className="mb-6">
            <Link
              href="/"
              className="inline-flex items-center text-blue-600 hover:text-blue-700 transition-colors"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              {t.backToHome}
            </Link>
          </div>

          {/* Title */}
          <div className="mb-8">
            <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-2">
              {t.title}
            </h1>
            <p className="text-gray-600">{t.lastUpdated}</p>
          </div>

          {/* Sections */}
          <div className="prose prose-lg max-w-none">
            {Object.values(t.sections).map((section, idx) => (
              <div key={idx} className="mb-8">
                <h2 className="text-xl lg:text-2xl font-semibold text-gray-900 mb-4">
                  {section.title}
                </h2>

                <p className="text-gray-700 mb-4 leading-relaxed">
                  {section.content}
                </p>

                {"items" in section && Array.isArray(section.items) && (
                  <ul className="list-disc pl-6 space-y-2 mb-4">
                    {section.items.map((item, i) => (
                      <li key={i} className="text-gray-700">
                        {item}
                      </li>
                    ))}
                  </ul>
                )}

                {"limitations" in section &&
                  Array.isArray(section.limitations) && (
                    <div className="mt-4">
                      <p className="text-gray-700 font-medium mb-2">
                        {language === "es"
                          ? "Sin embargo, no somos responsables por:"
                          : "However, we are not responsible for:"}
                      </p>
                      <ul className="list-disc pl-6 space-y-2 mb-4">
                        {section.limitations.map((lim, i) => (
                          <li key={i} className="text-gray-700">
                            {lim}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                {"details" in section && Array.isArray(section.details) && (
                  <ul className="list-none space-y-2 mb-4">
                    {section.details.map((det, i) => (
                      <li key={i} className="text-gray-700 font-medium">
                        {det}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="mt-12 p-6 bg-blue-50 rounded-lg border border-blue-200">
            <h3 className="text-lg font-semibold text-blue-800 mb-2">
              {language === "es"
                ? "¿Preguntas sobre los Términos?"
                : "Questions About the Terms?"}
            </h3>
            <p className="text-blue-700 mb-4">
              {language === "es"
                ? "Si tiene alguna pregunta sobre estos términos y condiciones, estamos aquí para ayudarle."
                : "If you have any questions about these terms and conditions, we're here to help."}
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <a
                href="tel:5406813507"
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors text-center"
              >
                {language === "es" ? "Llamar Ahora" : "Call Now"}
              </a>
              <a
                href="mailto:info@isaacplans.com"
                className="bg-white text-blue-600 border border-blue-600 px-6 py-2 rounded-lg hover:bg-blue-50 transition-colors text-center"
              >
                {language === "es" ? "Enviar Email" : "Send Email"}
              </a>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
