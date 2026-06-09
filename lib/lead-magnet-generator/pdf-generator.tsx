import { renderToBuffer, Document, Page, View, Text } from "@react-pdf/renderer";
import type { ReactElement } from "react";
import type { DocumentProps } from "@react-pdf/renderer";
import cloudinary from "@/config/cloudinary";
import { createSlug } from "@/lib/blog-generator/portable-text";
import type {
  GeneratedLeadMagnet,
  LeadMagnetImages,
  LeadMagnetOutline,
  LeadMagnetCategory,
} from "./types";
import { BRAND, styles } from "./pdf/pdf-styles";
import { PdfCover } from "./pdf/pdf-cover";
import { PdfToc } from "./pdf/pdf-toc";
import { PdfSection } from "./pdf/pdf-section";
import { PdfBackPage } from "./pdf/pdf-back-page";

function formatDate(): string {
  return new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function portableTextToMarkdown(blocks: GeneratedLeadMagnet["introductionBlocks"]): string {
  return blocks
    .map((block) => {
      if (block.listItem === "bullet") {
        return "- " + block.children.map((s) => s.text).join("");
      }
      const styleMap: Record<string, string> = {
        h2: "## ",
        h3: "### ",
        h4: "#### ",
        normal: "",
      };
      const prefix = styleMap[block.style] ?? "";
      const text = block.children
        .map((span) => (span.marks.includes("strong") ? `**${span.text}**` : span.text))
        .join("");
      return prefix + text;
    })
    .join("\n");
}

function renderMarkdownLines(markdown: string): ReactElement[] {
  return markdown
    .split("\n")
    .filter(Boolean)
    .map((line, i) => {
      if (line.startsWith("## ")) {
        return <Text key={i} style={styles.h2}>{line.slice(3)}</Text>;
      }
      if (line.startsWith("### ")) {
        return <Text key={i} style={styles.h3}>{line.slice(4)}</Text>;
      }
      if (line.startsWith("- ")) {
        return <Text key={i} style={styles.bulletItem}>{"• " + line.slice(2)}</Text>;
      }
      return <Text key={i} style={styles.body}>{line}</Text>;
    });
}

function buildDocument(params: {
  generatedContent: GeneratedLeadMagnet;
  images: LeadMagnetImages;
  outline: LeadMagnetOutline;
}): ReactElement<DocumentProps> {
  const { generatedContent, images, outline } = params;
  const { sections, introductionBlocks, conclusionBlocks } = generatedContent;
  const guideTitle = outline.title;
  const publishedAt = formatDate();

  const introMarkdown = portableTextToMarkdown(introductionBlocks);
  const conclusionMarkdown = portableTextToMarkdown(conclusionBlocks);

  return (
    <Document title={outline.title} author="Isaac Plans Insurance">
      <PdfCover
        title={outline.title}
        subtitle={outline.subtitle}
        coverImageUrl={images.coverImage}
        publishedAt={publishedAt}
      />

      <PdfToc
        guideTitle={guideTitle}
        sectionTitles={sections.map((s) => s.sectionTitle)}
      />

      <Page size="A4" style={styles.page}>
        <Text style={styles.h1}>Introduction</Text>
        <View style={{ height: 3, backgroundColor: BRAND.accent, marginBottom: 20, marginTop: 4 }} />
        {introductionBlocks.length > 0
          ? renderMarkdownLines(introMarkdown)
          : <Text style={styles.body}>{generatedContent.introduction}</Text>
        }
        <Text style={styles.footer}>{guideTitle}</Text>
        <Text style={styles.pageNumber} render={({ pageNumber }) => `${pageNumber}`} fixed />
      </Page>

      {sections.map((section, i) => (
        <PdfSection
          key={i}
          sectionTitle={section.sectionTitle}
          content={section.content ?? ""}
          sectionImage={images.sectionImages[i] ?? ""}
          guideTitle={guideTitle}
          sectionNumber={i + 1}
        />
      ))}

      <Page size="A4" style={styles.page}>
        <Text style={styles.h1}>Conclusion</Text>
        <View style={{ height: 3, backgroundColor: BRAND.accent, marginBottom: 20, marginTop: 4 }} />
        {conclusionBlocks.length > 0
          ? renderMarkdownLines(conclusionMarkdown)
          : <Text style={styles.body}>{generatedContent.conclusion}</Text>
        }
        <Text style={styles.footer}>{guideTitle}</Text>
        <Text style={styles.pageNumber} render={({ pageNumber }) => `${pageNumber}`} fixed />
      </Page>

      <PdfBackPage />
    </Document>
  );
}

export async function assemblePdf(params: {
  generatedContent: GeneratedLeadMagnet;
  images: LeadMagnetImages;
  outline: LeadMagnetOutline;
}): Promise<Buffer> {
  const document = buildDocument(params);
  return renderToBuffer(document);
}

export async function uploadPdfToCloudinary(
  pdfBuffer: Buffer,
  category: LeadMagnetCategory,
  title: string,
  sectionCount: number
): Promise<{ pdfUrl: string; pageCount: number }> {
  const base64 = pdfBuffer.toString("base64");
  const publicId = createSlug(title) + "-" + Date.now();

  const result = await cloudinary.uploader.upload(
    "data:application/pdf;base64," + base64,
    {
      resource_type: "raw",
      format: "pdf",
      folder: "lead-magnets/" + category,
      public_id: publicId,
    }
  );

  const pageCount = Math.ceil(sectionCount * 2 + 4);
  return { pdfUrl: result.secure_url, pageCount };
}

export async function generateAndUploadPdf(params: {
  generatedContent: GeneratedLeadMagnet;
  images: LeadMagnetImages;
  outline: LeadMagnetOutline;
}): Promise<{ pdfUrl: string; pageCount: number }> {
  const pdfBuffer = await assemblePdf(params);
  return uploadPdfToCloudinary(
    pdfBuffer,
    params.outline.category,
    params.outline.title,
    params.generatedContent.sections.length
  );
}
