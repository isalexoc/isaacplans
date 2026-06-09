import { Page, View, Text } from "@react-pdf/renderer";
import { BRAND, FONT_SIZES, styles } from "./pdf-styles";

interface PdfTocProps {
  guideTitle: string;
  sectionTitles: string[];
}

function dotLeader(length: number): string {
  return " " + ".".repeat(Math.max(0, length)) + " ";
}

export function PdfToc({ guideTitle, sectionTitles }: PdfTocProps) {
  const allItems = [
    { label: "Introduction", pageEst: 3 },
    ...sectionTitles.map((title, i) => ({
      label: title,
      pageEst: 3 + (i + 1) * 2,
    })),
    { label: "Conclusion", pageEst: 3 + (sectionTitles.length + 1) * 2 },
  ];

  return (
    <Page size="A4" style={styles.page}>
      <Text style={styles.h1}>Contents</Text>

      <View
        style={{
          height: 3,
          backgroundColor: BRAND.accent,
          marginBottom: 24,
          marginTop: 4,
        }}
      />

      {allItems.map((item, i) => {
        const numLabel = String(i).padStart(2, "0");
        const dots = dotLeader(40 - item.label.length);
        return (
          <View key={i} style={styles.tocItem}>
            <Text>
              <Text
                style={{
                  fontSize: FONT_SIZES.body,
                  fontFamily: "Helvetica-Bold",
                  color: BRAND.blue,
                }}
              >
                {numLabel} ·{" "}
              </Text>
              <Text style={{ fontSize: FONT_SIZES.body, color: BRAND.dark }}>
                {item.label}
              </Text>
              <Text style={{ fontSize: FONT_SIZES.caption, color: BRAND.gray }}>
                {dots}
              </Text>
            </Text>
            <Text style={{ fontSize: FONT_SIZES.body, color: BRAND.gray }}>
              p.{item.pageEst}
            </Text>
          </View>
        );
      })}

      <Text style={styles.footer}>{guideTitle}</Text>
      <Text
        style={styles.pageNumber}
        render={({ pageNumber }) => `${pageNumber}`}
        fixed
      />
    </Page>
  );
}
