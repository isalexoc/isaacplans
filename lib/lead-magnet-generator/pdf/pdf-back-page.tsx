import { Page, View, Text } from "@react-pdf/renderer";
import { BRAND, FONT_SIZES } from "./pdf-styles";

export function PdfBackPage() {
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
          Ready to Protect What Matters Most?
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
          Get a free consultation with an Isaac Plans insurance specialist —{"\n"}
          no pressure, just answers.
        </Text>

        {/* Benefit bullets */}
        {[
          "📞  No-obligation phone consultation",
          "✉   Personalized coverage recommendations by email",
          "✓   Licensed agents — real answers, no sales scripts",
        ].map((item, i) => (
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
          Licensed Insurance Agency
        </Text>
      </View>
    </Page>
  );
}
