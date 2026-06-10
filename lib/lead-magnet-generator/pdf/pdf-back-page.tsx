import { Page, View, Text } from "@react-pdf/renderer";
import { BRAND, FONT_SIZES } from "./pdf-styles";

const LABELS = {
  en: {
    headline: "Ready to Protect What Matters Most?",
    subtext: "Get a free consultation with an Isaac Plans insurance specialist —\nno pressure, just answers.",
    bullets: [
      "No-obligation phone consultation",
      "Personalized coverage recommendations by email",
      "Licensed agents — real answers, no sales scripts",
    ],
    callLabel: "Call us:",
    visitLabel: "Visit:",
    footer: "Licensed Insurance Agency",
  },
  es: {
    headline: "¿Listo para Proteger lo que Más Importa?",
    subtext: "Obtén una consulta gratuita con un especialista de Isaac Plans —\nsin presión, solo respuestas.",
    bullets: [
      "Consulta telefónica sin obligación",
      "Recomendaciones de cobertura personalizadas por email",
      "Agentes con licencia — respuestas reales, sin guiones de ventas",
    ],
    callLabel: "Llámanos:",
    visitLabel: "Visita:",
    footer: "Agencia de Seguros con Licencia",
  },
};

export function PdfBackPage({
  locale = "en",
  phone = "540-426-1804",
}: {
  locale?: "en" | "es";
  phone?: string;
}) {
  const t = LABELS[locale];
  return (
    <Page size="A4" style={{ backgroundColor: BRAND.blue, padding: 0 }}>
      <View
        style={{
          flex: 1,
          paddingHorizontal: 60,
          paddingVertical: 56,
          justifyContent: "center",
        }}
      >
        {/* Accent line */}
        <View
          style={{
            height: 4,
            backgroundColor: BRAND.accent,
            marginBottom: 32,
            width: 80,
          }}
        />

        {/* Headline */}
        <Text
          style={{
            fontSize: 26,
            fontFamily: "Helvetica-Bold",
            color: BRAND.white,
            lineHeight: 1.3,
            marginBottom: 20,
          }}
        >
          {t.headline}
        </Text>

        {/* Subtext */}
        <Text
          style={{
            fontSize: FONT_SIZES.body,
            color: BRAND.white,
            lineHeight: 1.6,
            marginBottom: 32,
            opacity: 0.9,
          }}
        >
          {t.subtext}
        </Text>

        {/* Benefit bullets — colored square + text (PDF-safe, no emoji) */}
        {t.bullets.map((item, i) => (
          <View
            key={i}
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginBottom: 10,
            }}
          >
            <View
              style={{
                width: 7,
                height: 7,
                backgroundColor: BRAND.accent,
                marginRight: 10,
                flexShrink: 0,
              }}
            />
            <Text
              style={{
                fontSize: FONT_SIZES.body,
                color: BRAND.white,
                opacity: 0.9,
              }}
            >
              {item}
            </Text>
          </View>
        ))}

        {/* CTA box */}
        <View
          style={{
            backgroundColor: BRAND.white,
            borderRadius: 6,
            padding: 24,
            marginTop: 36,
          }}
        >
          <Text
            style={{
              fontSize: FONT_SIZES.h3,
              fontFamily: "Helvetica-Bold",
              color: BRAND.blue,
              marginBottom: 8,
            }}
          >
            {t.callLabel} {phone}
          </Text>
          <Text
            style={{
              fontSize: FONT_SIZES.body,
              color: BRAND.gray,
            }}
          >
            {t.visitLabel} isaacplans.com
          </Text>
        </View>
      </View>

      {/* Footer */}
      <View
        style={{
          backgroundColor: "#005f92",
          paddingHorizontal: 60,
          paddingVertical: 14,
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Text
          style={{
            fontSize: FONT_SIZES.small,
            fontFamily: "Helvetica-Bold",
            color: BRAND.white,
            letterSpacing: 1,
          }}
        >
          ISAAC PLANS INSURANCE
        </Text>
        <Text
          style={{
            fontSize: FONT_SIZES.caption,
            color: BRAND.white,
            opacity: 0.7,
          }}
        >
          {t.footer}
        </Text>
      </View>
    </Page>
  );
}
