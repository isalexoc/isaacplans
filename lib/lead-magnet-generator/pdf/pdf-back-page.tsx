import { Page, View, Text } from "@react-pdf/renderer";
import { BRAND, FONT_SIZES } from "./pdf-styles";

const LABELS = {
  en: {
    headline: "Ready to Protect What Matters Most?",
    subtext: "Get a free consultation with an Isaac Plans insurance specialist —\nno pressure, just answers.",
    bullets: [
      "📞  No-obligation phone consultation",
      "✉   Personalized coverage recommendations by email",
      "✓   Licensed agents — real answers, no sales scripts",
    ],
    footer: "Licensed Insurance Agency",
  },
  es: {
    headline: "¿Listo para Proteger lo que Más Importa?",
    subtext: "Obtén una consulta gratuita con un especialista de Isaac Plans —\nsin presión, solo respuestas.",
    bullets: [
      "📞  Consulta telefónica sin obligación",
      "✉   Recomendaciones de cobertura personalizadas por email",
      "✓   Agentes con licencia — respuestas reales, sin guiones de ventas",
    ],
    footer: "Agencia de Seguros con Licencia",
  },
};

export function PdfBackPage({ locale = "en" }: { locale?: "en" | "es" }) {
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

        {/* Benefit bullets */}
        {t.bullets.map((item, i) => (
          <Text
            key={i}
            style={{
              fontSize: FONT_SIZES.body,
              color: BRAND.white,
              marginBottom: 8,
              opacity: 0.9,
            }}
          >
            {item}
          </Text>
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
            Call us: (800) 000-0000
          </Text>
          <Text
            style={{
              fontSize: FONT_SIZES.body,
              color: BRAND.gray,
            }}
          >
            Visit: isaacplans.com
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
