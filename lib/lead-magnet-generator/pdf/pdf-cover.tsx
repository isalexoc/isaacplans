import { Page, View, Text, Image } from "@react-pdf/renderer";
import { BRAND, FONT_SIZES } from "./pdf-styles";

interface PdfCoverProps {
  title: string;
  subtitle: string;
  coverImageUrl: string;
  publishedAt: string;
}

export function PdfCover({ title, subtitle, coverImageUrl, publishedAt }: PdfCoverProps) {
  return (
    <Page size="A4" style={{ backgroundColor: BRAND.blue, padding: 0 }}>
      {/* Top white band */}
      <View
        style={{
          backgroundColor: BRAND.white,
          paddingHorizontal: 40,
          paddingVertical: 16,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Text
          style={{
            fontSize: FONT_SIZES.small,
            color: BRAND.gray,
            letterSpacing: 1,
            textTransform: "uppercase",
          }}
        >
          A FREE GUIDE FROM
        </Text>
        <Text
          style={{
            fontSize: FONT_SIZES.body,
            fontFamily: "Helvetica-Bold",
            color: BRAND.blue,
            letterSpacing: 1,
          }}
        >
          ISAAC PLANS INSURANCE
        </Text>
      </View>

      {/* Cover image or fallback */}
      <View style={{ flex: 1, backgroundColor: BRAND.blue }}>
        {coverImageUrl ? (
          <Image
            src={coverImageUrl}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <View
            style={{
              flex: 1,
              backgroundColor: BRAND.blue,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <View
              style={{
                width: 120,
                height: 4,
                backgroundColor: BRAND.accent,
                marginBottom: 16,
              }}
            />
          </View>
        )}
      </View>

      {/* Bottom white band with title */}
      <View
        style={{
          backgroundColor: BRAND.white,
          paddingHorizontal: 40,
          paddingTop: 24,
          paddingBottom: 32,
        }}
      >
        <View
          style={{
            height: 3,
            backgroundColor: BRAND.accent,
            marginBottom: 16,
          }}
        />
        <Text
          style={{
            fontSize: FONT_SIZES.h1,
            fontFamily: "Helvetica-Bold",
            color: BRAND.dark,
            marginBottom: 8,
            lineHeight: 1.2,
          }}
        >
          {title}
        </Text>
        <Text
          style={{
            fontSize: FONT_SIZES.h4,
            color: BRAND.gray,
            marginBottom: 8,
            lineHeight: 1.4,
          }}
        >
          {subtitle}
        </Text>
        <Text
          style={{
            fontSize: FONT_SIZES.caption,
            color: BRAND.gray,
            marginTop: 8,
          }}
        >
          {publishedAt}
        </Text>
      </View>

      {/* Bottom strip */}
      <View
        style={{
          backgroundColor: BRAND.blue,
          paddingHorizontal: 40,
          paddingVertical: 10,
          alignItems: "center",
        }}
      >
        <Text
          style={{
            fontSize: FONT_SIZES.small,
            color: BRAND.white,
            letterSpacing: 1,
          }}
        >
          isaacplans.com
        </Text>
      </View>
    </Page>
  );
}
