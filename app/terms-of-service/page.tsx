"use client";

import { useLanguage } from "@/hooks/useLanguage";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function TermsOfServicePage() {
  const { language } = useLanguage();

  const content = {
    es: {
      title: "Términos y Condiciones",
      lastUpdated: "Última actualización: 20 de junio de 2025",
      backToHome: "Volver al Inicio",
      sections: {
        introduction: {
          title: "1. Introducción y Aceptación",
          content: `Bienvenido a Dorraiz Insurance. Estos Términos y Condiciones ("Términos") rigen el uso de nuestros servicios de seguros y sitio web. Al utilizar nuestros servicios, usted acepta estar sujeto a estos términos. Daniel Orraiz, agente de seguros licenciado en más de 20 estados, opera bajo estas condiciones.`,
        },
        services: {
          title: "2. Descripción de Servicios",
          content: `Dorraiz Insurance proporciona los siguientes servicios:`,
          items: [
            "Consultoría y asesoramiento en seguros ACA (Obamacare)",
            "Servicios de seguros Medicare (Partes A, B, C, y D)",
            "Seguros de vida, dental y visión",
            "Comparación y análisis de planes de seguros",
            "Asistencia con inscripciones y renovaciones",
            "Soporte continuo y servicio al cliente",
            "Optimización de costos y análisis de subsidios",
          ],
        },
        eligibility: {
          title: "3. Elegibilidad y Licencias",
          content: `Nuestros servicios están disponibles para residentes de los estados donde Daniel Orraiz mantiene licencias activas de seguros. Actualmente estamos licenciados en más de 20 estados de Estados Unidos. La elegibilidad para planes específicos depende de regulaciones estatales y federales.`,
        },
        responsibilities: {
          title: "4. Responsabilidades del Cliente",
          content: `Como cliente, usted se compromete a:`,
          items: [
            "Proporcionar información precisa y completa durante el proceso de cotización",
            "Notificar cambios en su situación personal o financiera que puedan afectar su cobertura",
            "Revisar cuidadosamente todos los documentos de póliza antes de firmar",
            "Pagar las primas de seguros directamente a la compañía de seguros según los términos acordados",
            "Cumplir con todos los términos y condiciones de su póliza de seguro",
            "Mantener la confidencialidad de su información de cuenta y acceso",
          ],
        },
        limitations: {
          title: "5. Limitaciones de Responsabilidad",
          content: `Dorraiz Insurance actúa como intermediario entre usted y las compañías de seguros. Nuestras responsabilidades incluyen:`,
          items: [
            "Proporcionar información precisa sobre planes disponibles",
            "Asistir en el proceso de solicitud y inscripción",
            "Brindar soporte continuo durante la vigencia de su póliza",
            "Mantener la confidencialidad de su información personal",
          ],
          limitations: [
            "No somos responsables por decisiones de cobertura tomadas por las compañías de seguros",
            "No garantizamos la aprobación de solicitudes de seguros",
            "No somos responsables por cambios en regulaciones o disponibilidad de planes",
            "Nuestra responsabilidad se limita a los servicios de intermediación y asesoramiento",
          ],
        },
        privacy: {
          title: "6. Privacidad y Confidencialidad",
          content: `Nos comprometemos a proteger su privacidad según nuestra Política de Privacidad. Específicamente:`,
          items: [
            "SMS opt-in o números de teléfono para el propósito de SMS no están siendo compartidos con ningún tercero y empresa afiliada para propósitos de marketing",
            "Su información personal se utiliza exclusivamente para proporcionar servicios de seguros",
            "Mantenemos estrictos estándares de confidencialidad en todas nuestras comunicaciones",
            "Cumplimos con todas las regulaciones aplicables de protección de datos",
          ],
        },
        fees: {
          title: "7. Honorarios y Compensación",
          content: `Nuestros servicios de consultoría y asesoramiento son generalmente gratuitos para el consumidor. Recibimos compensación de las compañías de seguros por las pólizas vendidas. Esta compensación no afecta el costo de su prima de seguro.`,
        },
        termination: {
          title: "8. Terminación de Servicios",
          content: `Cualquiera de las partes puede terminar esta relación de servicios en cualquier momento con notificación por escrito. La terminación no afecta las pólizas de seguro ya en vigor, las cuales continúan según sus propios términos y condiciones.`,
        },
        compliance: {
          title: "9. Cumplimiento Legal",
          content: `Dorraiz Insurance opera en cumplimiento total con:`,
          items: [
            "Regulaciones estatales de seguros en todos los estados donde estamos licenciados",
            "Ley de Cuidado de Salud Asequible (ACA)",
            "Regulaciones de Medicare y Medicaid",
            "Leyes federales y estatales de protección al consumidor",
            "Requisitos de licencias profesionales de seguros",
          ],
        },
        modifications: {
          title: "10. Modificaciones a los Términos",
          content: `Nos reservamos el derecho de modificar estos términos en cualquier momento. Las modificaciones serán efectivas inmediatamente después de su publicación en nuestro sitio web. El uso continuado de nuestros servicios constituye aceptación de los términos modificados.`,
        },
        contact: {
          title: "11. Información de Contacto",
          content: `Para preguntas sobre estos Términos y Condiciones:`,
          details: [
            "Agente: Daniel Orraiz",
            "Email: info@dorraizinsurance.com",
            "Teléfono: (956) 302-1451 / (407) 785-9073",
            "Licenciado en: Más de 20 Estados de EE.UU.",
          ],
        },
      },
    },
    en: {
      title: "Terms and Conditions",
      lastUpdated: "Last updated: June 20, 2025",
      backToHome: "Back to Home",
      sections: {
        introduction: {
          title: "1. Introduction and Acceptance",
          content: `Welcome to Dorraiz Insurance. These Terms and Conditions ("Terms") govern the use of our insurance services and website. By using our services, you agree to be bound by these terms. Daniel Orraiz, licensed insurance agent in over 20 states, operates under these conditions.`,
        },
        services: {
          title: "2. Description of Services",
          content: `Dorraiz Insurance provides the following services:`,
          items: [
            "ACA (Obamacare) insurance consulting and advisory services",
            "Medicare insurance services (Parts A, B, C, and D)",
            "Life, dental, and vision insurance",
            "Insurance plan comparison and analysis",
            "Enrollment and renewal assistance",
            "Ongoing support and customer service",
            "Cost optimization and subsidy analysis",
          ],
        },
        eligibility: {
          title: "3. Eligibility and Licenses",
          content: `Our services are available to residents of states where Daniel Orraiz maintains active insurance licenses. We are currently licensed in over 20 US states. Eligibility for specific plans depends on state and federal regulations.`,
        },
        responsibilities: {
          title: "4. Client Responsibilities",
          content: `As a client, you agree to:`,
          items: [
            "Provide accurate and complete information during the quote process",
            "Notify changes in your personal or financial situation that may affect your coverage",
            "Carefully review all policy documents before signing",
            "Pay insurance premiums directly to the insurance company according to agreed terms",
            "Comply with all terms and conditions of your insurance policy",
            "Maintain confidentiality of your account information and access",
          ],
        },
        limitations: {
          title: "5. Liability Limitations",
          content: `Dorraiz Insurance acts as an intermediary between you and insurance companies. Our responsibilities include:`,
          items: [
            "Providing accurate information about available plans",
            "Assisting in the application and enrollment process",
            "Providing ongoing support during your policy term",
            "Maintaining confidentiality of your personal information",
          ],
          limitations: [
            "We are not responsible for coverage decisions made by insurance companies",
            "We do not guarantee approval of insurance applications",
            "We are not responsible for changes in regulations or plan availability",
            "Our liability is limited to intermediation and advisory services",
          ],
        },
        privacy: {
          title: "6. Privacy and Confidentiality",
          content: `We are committed to protecting your privacy according to our Privacy Policy. Specifically:`,
          items: [
            "SMS opt-in or phone numbers for the purpose of SMS are not being shared with any third party and affiliate company for marketing purposes",
            "Your personal information is used exclusively to provide insurance services",
            "We maintain strict confidentiality standards in all our communications",
            "We comply with all applicable data protection regulations",
          ],
        },
        fees: {
          title: "7. Fees and Compensation",
          content: `Our consulting and advisory services are generally free to the consumer. We receive compensation from insurance companies for policies sold. This compensation does not affect the cost of your insurance premium.`,
        },
        termination: {
          title: "8. Service Termination",
          content: `Either party may terminate this service relationship at any time with written notice. Termination does not affect insurance policies already in force, which continue according to their own terms and conditions.`,
        },
        compliance: {
          title: "9. Legal Compliance",
          content: `Dorraiz Insurance operates in full compliance with:`,
          items: [
            "State insurance regulations in all states where we are licensed",
            "Affordable Care Act (ACA)",
            "Medicare and Medicaid regulations",
            "Federal and state consumer protection laws",
            "Professional insurance licensing requirements",
          ],
        },
        modifications: {
          title: "10. Modifications to Terms",
          content: `We reserve the right to modify these terms at any time. Modifications will be effective immediately after posting on our website. Continued use of our services constitutes acceptance of the modified terms.`,
        },
        contact: {
          title: "11. Contact Information",
          content: `For questions about these Terms and Conditions:`,
          details: [
            "Agent: Daniel Orraiz",
            "Email: dorraizinsurance@gmail.com",
            "Phone: (956) 302-1451 / (407) 785-9073",
            "Licensed in: 20+ US States",
          ],
        },
      },
    },
  };

  const t = content[language];

  return (
    <div className="min-h-screen bg-white">
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-4xl">
          {/* Back to Home Link */}
          <div className="mb-6">
            <Link
              href="/"
              className="inline-flex items-center text-blue-600 hover:text-blue-700 transition-colors"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              {t.backToHome}
            </Link>
          </div>

          <div className="mb-8">
            <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
              {t.title}
            </h1>
            <p className="text-gray-600">{t.lastUpdated}</p>
          </div>

          <div className="prose prose-lg max-w-none">
            {Object.entries(t.sections).map(([key, section]) => (
              <div key={key} className="mb-8">
                <h2 className="text-xl lg:text-2xl font-semibold text-gray-900 mb-4">
                  {section.title}
                </h2>
                <p className="text-gray-700 mb-4 leading-relaxed">
                  {section.content}
                </p>

                {section.items && (
                  <ul className="list-disc pl-6 space-y-2 mb-4">
                    {section.items.map((item, index) => (
                      <li key={index} className="text-gray-700">
                        {item}
                      </li>
                    ))}
                  </ul>
                )}

                {section.limitations && (
                  <div className="mt-4">
                    <p className="text-gray-700 font-medium mb-2">
                      {language === "es"
                        ? "Sin embargo, no somos responsables por:"
                        : "However, we are not responsible for:"}
                    </p>
                    <ul className="list-disc pl-6 space-y-2 mb-4">
                      {section.limitations.map((limitation, index) => (
                        <li key={index} className="text-gray-700">
                          {limitation}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {section.details && (
                  <ul className="list-none space-y-2 mb-4">
                    {section.details.map((detail, index) => (
                      <li key={index} className="text-gray-700 font-medium">
                        {detail}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>

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
                href="tel:9563021451"
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors text-center"
              >
                {language === "es" ? "Llamar Ahora" : "Call Now"}
              </a>
              <a
                href="mailto:info@dorraizinsurance.com"
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
