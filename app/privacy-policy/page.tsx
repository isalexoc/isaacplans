"use client"

import { useLanguage } from "@/hooks/useLanguage"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"

export default function PrivacyPolicyPage() {
  const { language } = useLanguage()

  const content = {
    es: {
      title: "Política de Privacidad",
      lastUpdated: "Última actualización: 20 de junio de 2025",
      sections: {
        introduction: {
          title: "1. Introducción",
          content: `En Dorraiz Insurance, nos comprometemos a proteger su privacidad y la confidencialidad de su información personal. Esta Política de Privacidad describe cómo recopilamos, utilizamos, compartimos y protegemos su información cuando utiliza nuestros servicios de seguros o visita nuestro sitio web.`,
        },
        informationCollected: {
          title: "2. Tipos de Información Personal Recopilada",
          content: `Recopilamos los siguientes tipos de información personal:`,
          items: [
            "Información de identificación personal: Nombre completo, fecha de nacimiento, número de seguro social",
            "Información de contacto: Dirección postal, dirección de correo electrónico, números de teléfono (fijo y móvil)",
            "Información demográfica: Edad, género, estado civil, número de dependientes",
            "Información financiera: Ingresos, información de empleo, historial crediticio (cuando sea aplicable)",
            "Información de salud: Historial médico, condiciones preexistentes, medicamentos actuales (solo para seguros de salud)",
            "Información del navegador: Dirección IP, tipo de navegador, páginas visitadas, tiempo de permanencia",
            "Datos de ubicación: Ubicación geográfica para determinar elegibilidad de planes",
            "Información de comunicaciones: Registros de llamadas, mensajes de texto, correos electrónicos",
            "Información de preferencias: Preferencias de comunicación, tipos de cobertura de interés",
          ],
        },
        howWeUse: {
          title: "3. Cómo Utilizamos Su Información",
          content: `Utilizamos su información personal para los siguientes propósitos:`,
          items: [
            "Proporcionar cotizaciones de seguros personalizadas y precisas",
            "Procesar solicitudes de pólizas de seguro y administrar su cobertura",
            "Comunicarnos con usted sobre sus pólizas, renovaciones y cambios",
            "Brindar atención al cliente y soporte técnico",
            "Cumplir con requisitos legales y regulatorios de la industria de seguros",
            "Mejorar nuestros servicios y desarrollar nuevos productos",
            "Realizar análisis de mercado y investigación de la industria",
            "Prevenir fraudes y garantizar la seguridad de nuestros servicios",
            "Personalizar su experiencia en nuestro sitio web",
            "Enviar comunicaciones de marketing (solo con su consentimiento)",
          ],
        },
        sharingPractices: {
          title: "4. Prácticas de Compartir Información",
          content: `Podemos compartir su información personal en las siguientes circunstancias:`,
          items: [
            "Con compañías de seguros: Para obtener cotizaciones y procesar aplicaciones de pólizas",
            "Con proveedores de servicios: Empresas que nos ayudan a operar nuestro negocio (procesamiento de pagos, servicios de TI)",
            "Con autoridades regulatorias: Cuando sea requerido por ley o regulaciones estatales de seguros",
            "Con profesionales legales: Abogados y contadores que nos brindan servicios profesionales",
            "En caso de transferencia comercial: Si vendemos o transferimos nuestro negocio",
            "Para proteger derechos: Cuando sea necesario para proteger nuestros derechos legales o los de otros",
            "Con su consentimiento: Cuando usted nos autorice específicamente a compartir su información",
          ],
        },
        smsPolicy: {
          title: "5. Política de SMS y Números de Teléfono",
          content: `SMS opt-in o números de teléfono para el propósito de SMS no están siendo compartidos con ningún tercero y empresa afiliada para propósitos de marketing. Su número de teléfono se utiliza exclusivamente para comunicaciones relacionadas con sus servicios de seguros y consultas directas.`,
        },
        dataSecurity: {
          title: "6. Seguridad de Datos",
          content: `Implementamos medidas de seguridad técnicas, administrativas y físicas apropiadas para proteger su información personal contra acceso no autorizado, alteración, divulgación o destrucción.`,
        },
        yourRights: {
          title: "7. Sus Derechos",
          content: `Usted tiene derecho a:`,
          items: [
            "Acceder a su información personal que tenemos",
            "Solicitar correcciones a información inexacta",
            "Solicitar la eliminación de su información (sujeto a requisitos legales)",
            "Optar por no recibir comunicaciones de marketing",
            "Solicitar una copia de esta política de privacidad",
          ],
        },
        contact: {
          title: "8. Información de Contacto",
          content: `Si tiene preguntas sobre esta Política de Privacidad, puede contactarnos:`,
          details: [
            "Email: dorraizinsurance@gmail.com",
            "Teléfono: (956) 302-1451 / (407) 785-9073",
            "Agente: Daniel Orraiz, Licenciado en 20+ Estados",
          ],
        },
      },
    },
    en: {
      title: "Privacy Policy",
      lastUpdated: "Last updated: June 20, 2025",
      sections: {
        introduction: {
          title: "1. Introduction",
          content: `At Dorraiz Insurance, we are committed to protecting your privacy and the confidentiality of your personal information. This Privacy Policy describes how we collect, use, share, and protect your information when you use our insurance services or visit our website.`,
        },
        informationCollected: {
          title: "2. Types of Personal Information Collected",
          content: `We collect the following types of personal information:`,
          items: [
            "Personal identification information: Full name, date of birth, social security number",
            "Contact information: Mailing address, email address, phone numbers (landline and mobile)",
            "Demographic information: Age, gender, marital status, number of dependents",
            "Financial information: Income, employment information, credit history (when applicable)",
            "Health information: Medical history, pre-existing conditions, current medications (for health insurance only)",
            "Browser information: IP address, browser type, pages visited, time spent",
            "Location data: Geographic location to determine plan eligibility",
            "Communication information: Call logs, text messages, emails",
            "Preference information: Communication preferences, types of coverage of interest",
          ],
        },
        howWeUse: {
          title: "3. How We Use Your Information",
          content: `We use your personal information for the following purposes:`,
          items: [
            "Provide personalized and accurate insurance quotes",
            "Process insurance policy applications and manage your coverage",
            "Communicate with you about your policies, renewals, and changes",
            "Provide customer service and technical support",
            "Comply with legal and regulatory requirements of the insurance industry",
            "Improve our services and develop new products",
            "Conduct market analysis and industry research",
            "Prevent fraud and ensure the security of our services",
            "Personalize your experience on our website",
            "Send marketing communications (only with your consent)",
          ],
        },
        sharingPractices: {
          title: "4. Information Sharing Practices",
          content: `We may share your personal information in the following circumstances:`,
          items: [
            "With insurance companies: To obtain quotes and process policy applications",
            "With service providers: Companies that help us operate our business (payment processing, IT services)",
            "With regulatory authorities: When required by law or state insurance regulations",
            "With legal professionals: Attorneys and accountants who provide us professional services",
            "In case of business transfer: If we sell or transfer our business",
            "To protect rights: When necessary to protect our legal rights or those of others",
            "With your consent: When you specifically authorize us to share your information",
          ],
        },
        smsPolicy: {
          title: "5. SMS and Phone Number Policy",
          content: `SMS opt-in or phone numbers for the purpose of SMS are not being shared with any third party and affiliate company for marketing purposes. Your phone number is used exclusively for communications related to your insurance services and direct consultations.`,
        },
        dataSecurity: {
          title: "6. Data Security",
          content: `We implement appropriate technical, administrative, and physical security measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction.`,
        },
        yourRights: {
          title: "7. Your Rights",
          content: `You have the right to:`,
          items: [
            "Access your personal information that we have",
            "Request corrections to inaccurate information",
            "Request deletion of your information (subject to legal requirements)",
            "Opt out of marketing communications",
            "Request a copy of this privacy policy",
          ],
        },
        contact: {
          title: "8. Contact Information",
          content: `If you have questions about this Privacy Policy, you can contact us:`,
          details: [
            "Email: dorraizinsurance@gmail.com",
            "Phone: (956) 302-1451 / (407) 785-9073",
            "Agent: Daniel Orraiz, Licensed in 20+ States",
          ],
        },
      },
    },
  }

  const t = content[language]

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="mb-8">
            <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">{t.title}</h1>
            <p className="text-gray-600">{t.lastUpdated}</p>
          </div>

          <div className="prose prose-lg max-w-none">
            {Object.entries(t.sections).map(([key, section]) => (
              <div key={key} className="mb-8">
                <h2 className="text-xl lg:text-2xl font-semibold text-gray-900 mb-4">{section.title}</h2>
                <p className="text-gray-700 mb-4 leading-relaxed">{section.content}</p>

                {section.items && (
                  <ul className="list-disc pl-6 space-y-2 mb-4">
                    {section.items.map((item, index) => (
                      <li key={index} className="text-gray-700">
                        {item}
                      </li>
                    ))}
                  </ul>
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

          <div className="mt-12 p-6 bg-green-50 rounded-lg border border-green-200">
            <h3 className="text-lg font-semibold text-green-800 mb-2">
              {language === "es" ? "¿Preguntas sobre su Privacidad?" : "Questions About Your Privacy?"}
            </h3>
            <p className="text-green-700 mb-4">
              {language === "es"
                ? "Si tiene alguna pregunta sobre cómo manejamos su información personal, no dude en contactarnos."
                : "If you have any questions about how we handle your personal information, please don't hesitate to contact us."}
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <a
                href="tel:9563021451"
                className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors text-center"
              >
                {language === "es" ? "Llamar Ahora" : "Call Now"}
              </a>
              <a
                href="mailto:dorraizinsurance@gmail.com"
                className="bg-white text-green-600 border border-green-600 px-6 py-2 rounded-lg hover:bg-green-50 transition-colors text-center"
              >
                {language === "es" ? "Enviar Email" : "Send Email"}
              </a>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
