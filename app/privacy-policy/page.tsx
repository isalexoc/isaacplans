"use client";

import { useLanguage } from "@/hooks/useLanguage";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function PrivacyPolicyPage() {
  const { language } = useLanguage();

  /** ─────────────  CONTENIDO MULTILENGUAJE  ───────────── */
  const content = {
    es: {
      title: "Política de Privacidad",
      lastUpdated: "Última actualización: 20 de junio de 2025",
      backToHome: "Volver al Inicio",
      sections: {
        /* 1 */
        introduction: {
          title: "1. Introducción",
          content:
            "En Isaac Plans, nos comprometemos a proteger su privacidad y la confidencialidad de su información personal. Esta Política de Privacidad describe cómo recopilamos, utilizamos, compartimos y protegemos su información cuando utiliza nuestros servicios de seguros o visita nuestro sitio web.",
        },

        /* 2 */
        informationCollected: {
          title: "2. Tipos de Información Personal Recopilada",
          content: "Recopilamos los siguientes tipos de información personal:",
          items: [
            "Información de identificación personal: Nombre completo, fecha de nacimiento, número de seguro social",
            "Información de contacto: Dirección postal, correo electrónico, números de teléfono",
            "Información demográfica: Edad, género, estado civil, dependientes",
            "Información financiera: Ingresos, empleo, historial crediticio (cuando aplique)",
            "Información de salud: Historial médico y condiciones preexistentes (para seguros de salud)",
            "Información del navegador: Dirección IP, tipo de navegador, páginas visitadas, tiempo de permanencia",
            "Datos de ubicación: Ubicación geográfica para determinar elegibilidad de planes",
            "Registros de comunicación: Llamadas, SMS y correos electrónicos",
            "Preferencias: Preferencias de comunicación y coberturas de interés",
          ],
        },

        /* 3 */
        howWeUse: {
          title: "3. Cómo Utilizamos Su Información",
          content:
            "Utilizamos su información personal para los siguientes fines:",
          items: [
            "Proporcionar cotizaciones de seguros personalizadas y precisas",
            "Procesar solicitudes y administrar su cobertura",
            "Comunicarnos sobre pólizas, renovaciones y cambios",
            "Brindar atención al cliente y soporte técnico",
            "Cumplir con obligaciones legales y regulatorias",
            "Mejorar nuestros servicios y desarrollar nuevos productos",
            "Realizar análisis de mercado e investigación",
            "Prevenir fraudes y garantizar la seguridad",
            "Personalizar su experiencia en el sitio web",
            "Enviar comunicaciones de marketing (solo con su consentimiento)",
          ],
        },

        /* 4 */
        sharingPractices: {
          title: "4. Prácticas de Compartir Información",
          content:
            "Podemos compartir su información personal en las siguientes circunstancias:",
          items: [
            "Con aseguradoras: Para obtener cotizaciones y procesar pólizas",
            "Con proveedores de servicios: Procesamiento de pagos, servicios de TI, etc.",
            "Con autoridades regulatorias: Cuando lo exija la ley",
            "Con asesores legales y contables",
            "En caso de transferencia empresarial",
            "Para proteger derechos legales",
            "Con su consentimiento explícito",
          ],
        },

        /* 5 */
        smsPolicy: {
          title: "5. Política de SMS y Números de Teléfono",
          content:
            "Regulamos el uso de su número telefónico y las comunicaciones por SMS conforme a las directrices del Registro de Campañas (TCR).",
          /* NUEVO BLOQUE DE 8 PUNTOS */
          items: [
            "1 – Comunicación de consentimiento de SMS: Los números obtenidos para consentimiento SMS no se comparten con terceros para fines de marketing.",
            "2 – Tipos de comunicaciones SMS: recordatorios de pago, avisos de inscripción y notificaciones de servicio. Ejemplos: «Estimado Cliente: su póliza caerá en inactividad…» o «Hola, este es un recordatorio de su próxima cita…». Puede responder STOP para cancelar en cualquier momento.",
            "3 – Frecuencia de mensajes: la frecuencia puede variar; por ejemplo, hasta 3 SMS por semana relacionados con su póliza o período de inscripción.",
            "4 – Posibles tarifas: se pueden aplicar cargos estándar de mensajes y datos según su plan de telefonía, nacionales o internacionales.",
            "5 – Método de inclusión (Opt-In): marcando la casilla de consentimiento en nuestros formularios en línea.",
            "6 – Método de exclusión (Opt-Out): responda «STOP» a cualquier SMS o contáctenos para ser eliminado.",
            "7 – Ayuda: responda «AYUDA» o visite https://www.isaacplans.com/contact para asistencia.",
            "8 – Divulgaciones estándar: mensaje y datos pueden costar. Para ayuda envíe AYUDA al (956) 302-1451. La frecuencia de mensajes puede variar.",
          ],
        },

        /* 6 */
        dataSecurity: {
          title: "6. Seguridad de Datos",
          content:
            "Implementamos medidas técnicas, administrativas y físicas para proteger su información contra acceso no autorizado, alteración o divulgación.",
        },

        /* 7 */
        yourRights: {
          title: "7. Sus Derechos",
          content: "Usted tiene derecho a:",
          items: [
            "Acceder a su información personal",
            "Solicitar correcciones",
            "Solicitar eliminación (sujeto a obligaciones legales)",
            "Optar por no recibir marketing",
            "Solicitar una copia de esta política",
          ],
        },

        /* 8 */
        contact: {
          title: "8. Información de Contacto",
          content: "Si tiene preguntas sobre esta Política de Privacidad:",
          details: [
            "Email: info@isaacplans.com",
            "Tel: (540) 681-3507",
            "Agente: Isaac Orraiz, Licenciado en 20+ Estados",
          ],
        },
      },
    },

    /* ─────────────  ENGLISH VERSION ───────────── */
    en: {
      title: "Privacy Policy",
      lastUpdated: "Last updated: June 20, 2025",
      backToHome: "Back to Home",
      sections: {
        /* 1 */
        introduction: {
          title: "1. Introduction",
          content:
            "At Isaac Plans we are committed to protecting your privacy. This policy explains how we collect, use, share, and safeguard your information when you use our services or visit our website.",
        },

        /* 2 */
        informationCollected: {
          title: "2. Types of Personal Information Collected",
          content: "We collect the following types of personal information:",
          items: [
            "Personal identification: Full name, date of birth, SSN",
            "Contact: Mailing address, email, phone numbers",
            "Demographics: Age, gender, marital status, dependents",
            "Financial: Income, employment details, credit history (if applicable)",
            "Health: Medical history, pre-existing conditions (for health insurance)",
            "Browser data: IP address, pages visited, time spent",
            "Location data: Geographic location to determine plan eligibility",
            "Communication logs: Calls, texts, emails",
            "Preferences: Communication preferences, coverage interests",
          ],
        },

        /* 3 */
        howWeUse: {
          title: "3. How We Use Your Information",
          content: "We use your personal information to:",
          items: [
            "Provide accurate insurance quotes",
            "Process policy applications and manage coverage",
            "Communicate about policies, renewals, and changes",
            "Offer customer service and technical support",
            "Meet legal and regulatory obligations",
            "Improve our services and develop new products",
            "Conduct market analysis and research",
            "Prevent fraud and ensure security",
            "Personalize your website experience",
            "Send marketing communications (with consent)",
          ],
        },

        /* 4 */
        sharingPractices: {
          title: "4. Information Sharing Practices",
          content:
            "We may share your personal information under these circumstances:",
          items: [
            "With insurers to obtain quotes and issue policies",
            "With service providers (payment processing, IT)",
            "With regulators when required by law",
            "With legal and accounting professionals",
            "In a business transfer or sale",
            "To protect legal rights",
            "With your explicit consent",
          ],
        },

        /* 5 */
        smsPolicy: {
          title: "5. SMS and Phone Number Policy",
          content:
            "Our use of your phone number and SMS communications follows The Campaign Registry (TCR) guidelines:",
          items: [
            "1 – SMS Consent Communication: phone numbers collected for SMS consent are not shared with third parties for marketing purposes.",
            "2 – Types of SMS: payment reminders, enrollment notices, and service notifications. Examples: “Dear Client: your policy may lapse…”, or “Hi, this is a reminder of your next appointment…”. Reply STOP at any time to opt-out.",
            "3 – Message Frequency: may vary; e.g., up to 3 SMS per week related to your policy or enrollment period.",
            "4 – Possible Charges: standard message/data rates may apply, domestic or international.",
            "5 – Opt-In Method: by checking the SMS-consent box in our online forms.",
            "6 – Opt-Out Method: reply “STOP” to any SMS or contact us to be removed.",
            "7 – Help: reply “HELP” or visit https://www.isaacplans.com/contact for assistance.",
            "8 – Standard Disclosure: message/data rates may apply. For help text HELP to (956) 302-1451. Message frequency varies.",
          ],
        },

        /* 6 */
        dataSecurity: {
          title: "6. Data Security",
          content:
            "We use technical, administrative, and physical safeguards to protect your information against unauthorized access, alteration, disclosure, or destruction.",
        },

        /* 7 */
        yourRights: {
          title: "7. Your Rights",
          content: "You have the right to:",
          items: [
            "Access the personal information we hold",
            "Request corrections to inaccurate data",
            "Request deletion (subject to legal obligations)",
            "Opt-out of marketing communications",
            "Request a copy of this privacy policy",
          ],
        },

        /* 8 */
        contact: {
          title: "8. Contact Information",
          content: "If you have questions about this Privacy Policy:",
          details: [
            "Email: info@isaacplans.com",
            "Phone: (540) 681-3507",
            "Agent: Isaac Orraiz, Licensed in 9+ States",
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
              className="inline-flex items-center text-green-600 hover:text-green-700 transition-colors"
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
          <div className="mt-12 p-6 bg-green-50 rounded-lg border border-green-200">
            <h3 className="text-lg font-semibold text-green-800 mb-2">
              {language === "es"
                ? "¿Preguntas sobre su Privacidad?"
                : "Questions About Your Privacy?"}
            </h3>
            <p className="text-green-700 mb-4">
              {language === "es"
                ? "Si tiene alguna pregunta sobre cómo manejamos su información personal, no dude en contactarnos."
                : "If you have any questions about how we handle your personal information, please contact us."}
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <a
                href="tel:9563021451"
                className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors text-center"
              >
                {language === "es" ? "Llamar Ahora" : "Call Now"}
              </a>
              <a
                href="mailto:info@isaacplans.com"
                className="bg-white text-green-600 border border-green-600 px-6 py-2 rounded-lg hover:bg-green-50 transition-colors text-center"
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
