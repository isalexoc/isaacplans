import { Page, View, Text, Image } from "@react-pdf/renderer";
import { BRAND, FONT_SIZES, styles } from "./pdf-styles";
import type { ReactNode } from "react";

interface PdfSectionProps {
  sectionTitle: string;
  content: string;
  sectionImage: string;
  guideTitle: string;
  sectionNumber: number;
}

interface ParsedLine {
  type: "h2" | "h3" | "bullet" | "actionStep" | "body";
  text: string;
}

function parseLines(markdown: string): ParsedLine[] {
  const lines = markdown.split("\n");
  const result: ParsedLine[] = [];

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) continue;

    if (line.startsWith("## ")) {
      result.push({ type: "h2", text: line.slice(3).trim() });
    } else if (line.startsWith("### ")) {
      result.push({ type: "h3", text: line.slice(4).trim() });
    } else if (line.startsWith("- ")) {
      result.push({ type: "bullet", text: line.slice(2).trim() });
    } else if (line.startsWith("> ")) {
      result.push({ type: "actionStep", text: line.slice(2).trim() });
    } else {
      result.push({ type: "body", text: line.trim() });
    }
  }

  return result;
}

function renderInlineBold(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <Text key={i} style={{ fontFamily: "Helvetica-Bold" }}>
          {part.slice(2, -2)}
        </Text>
      );
    }
    return <Text key={i}>{part}</Text>;
  });
}

function stripActionStepPrefix(text: string): string {
  return text.replace(/^\*\*Action Step:\*\*\s*/i, "").replace(/^Action Step:\s*/i, "");
}

export function PdfSection({
  sectionTitle,
  content,
  sectionImage,
  guideTitle,
  sectionNumber,
}: PdfSectionProps) {
  const lines = parseLines(content);

  return (
    <Page size="A4" style={styles.page}>
      {/* Section header */}
      <View
        style={{
          borderLeftWidth: 4,
          borderLeftColor: BRAND.accent,
          paddingLeft: 12,
          marginBottom: 16,
        }}
      >
        <Text
          style={{
            fontSize: FONT_SIZES.caption,
            color: BRAND.accent,
            textTransform: "uppercase",
            letterSpacing: 1,
            marginBottom: 4,
            fontFamily: "Helvetica-Bold",
          }}
        >
          Section {sectionNumber}
        </Text>
        <Text style={styles.h2}>{sectionTitle}</Text>
      </View>

      {/* Content area with optional float image */}
      <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
        {/* Main content */}
        <View style={{ flex: 1 }}>
          {lines.map((line, i) => {
            if (line.type === "h2") {
              return (
                <Text key={i} style={styles.h2}>
                  {line.text}
                </Text>
              );
            }
            if (line.type === "h3") {
              return (
                <Text key={i} style={styles.h3}>
                  {line.text}
                </Text>
              );
            }
            if (line.type === "bullet") {
              return (
                <Text key={i} style={styles.bulletItem}>
                  {"• "}
                  {renderInlineBold(line.text)}
                </Text>
              );
            }
            if (line.type === "actionStep") {
              const body = stripActionStepPrefix(line.text);
              return (
                <View key={i} style={styles.actionStep}>
                  <Text style={styles.actionStepLabel}>ACTION STEP</Text>
                  <Text style={styles.body}>{renderInlineBold(body)}</Text>
                </View>
              );
            }
            return (
              <Text key={i} style={styles.body}>
                {renderInlineBold(line.text)}
              </Text>
            );
          })}
        </View>

        {/* Float image */}
        {sectionImage ? (
          <View style={{ width: 160, marginLeft: 16 }}>
            <Image
              src={sectionImage}
              style={{ width: 160, height: 120, objectFit: "cover", borderRadius: 4 }}
            />
          </View>
        ) : null}
      </View>

      <Text style={styles.footer}>{guideTitle}</Text>
      <Text
        style={styles.pageNumber}
        render={({ pageNumber }) => `${pageNumber}`}
        fixed
      />
    </Page>
  );
}
