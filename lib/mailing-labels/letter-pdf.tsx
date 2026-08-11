import "server-only";
import { renderToBuffer, Document, Page, View, Text, Image } from "@react-pdf/renderer";
import type { DocumentProps } from "@react-pdf/renderer";
import type { ReactElement } from "react";
import { formatAddressBlock } from "./format";
import { letterClosing, letterDate, type LetterAgentInfo } from "./letter";
import { loadSeniorLifeLogo } from "./pdf";
import { SENIOR_LIFE } from "./theme";
import type { MailingLabelRecord } from "./types";

/**
 * The letter that goes inside the envelope, one prospect per page.
 *
 * Set noticeably larger than a business letter — 13.5 pt on 1.65 line height — because the reader
 * is a senior and this is the one piece they actually sit down with. Generous margins and paragraph
 * spacing do as much for readability as the type size does.
 *
 * The gold Senior Life logo is washed out on white, so it sits in a navy band like the mailing
 * label does. That also makes the letter and the label read as one piece of mail.
 */

const FONT = "Helvetica";
const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN_X = 62;
const HEADER_H = 74;
const ACCENT_H = 3;
const LOGO_H = 42;

const BODY_SIZE = 13.5;
const BODY_LEADING = 1.65;

/** Split the stored plain-text letter into paragraphs on blank lines. */
export function letterParagraphs(body: string): string[] {
  return body
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s*\n\s*/g, " ").trim())
    .filter(Boolean);
}

function LetterPage({
  record,
  agent,
  logo,
}: {
  record: MailingLabelRecord;
  agent: LetterAgentInfo;
  logo: Buffer | null;
}) {
  const paragraphs = letterParagraphs(record.letterBody);
  const to = formatAddressBlock(record);

  return (
    <Page size={[PAGE_W, PAGE_H]} style={{ backgroundColor: "#FFFFFF", fontFamily: FONT }}>
      <View
        style={{
          height: HEADER_H,
          backgroundColor: SENIOR_LIFE.blue,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {logo ? (
          <Image src={{ data: logo, format: "png" }} style={{ height: LOGO_H, objectFit: "contain" }} />
        ) : (
          <Text style={{ color: SENIOR_LIFE.gold, fontSize: 20, fontWeight: "bold" }}>
            SENIOR LIFE
          </Text>
        )}
      </View>
      <View style={{ height: ACCENT_H, backgroundColor: SENIOR_LIFE.gold }} />

      <View style={{ paddingHorizontal: MARGIN_X, paddingTop: 34, paddingBottom: 40, flexGrow: 1 }}>
        <Text style={{ fontSize: 10.5, color: SENIOR_LIFE.muted, marginBottom: 20 }}>
          {letterDate(record.language)}
        </Text>

        <View style={{ marginBottom: 26 }}>
          <Text style={{ fontSize: 11, color: SENIOR_LIFE.ink, lineHeight: 1.4 }}>
            {to.nameLine}
          </Text>
          <Text style={{ fontSize: 11, color: SENIOR_LIFE.ink, lineHeight: 1.4 }}>{to.line1}</Text>
          {to.line2 ? (
            <Text style={{ fontSize: 11, color: SENIOR_LIFE.ink, lineHeight: 1.4 }}>
              {to.line2}
            </Text>
          ) : null}
          <Text style={{ fontSize: 11, color: SENIOR_LIFE.ink, lineHeight: 1.4 }}>
            {to.cityStateZip}
          </Text>
        </View>

        {paragraphs.map((para, i) => (
          <Text
            key={i}
            style={{
              fontSize: BODY_SIZE,
              lineHeight: BODY_LEADING,
              color: SENIOR_LIFE.ink,
              marginBottom: 13,
            }}
          >
            {para}
          </Text>
        ))}

        <View style={{ marginTop: 18 }}>
          <Text style={{ fontSize: BODY_SIZE, color: SENIOR_LIFE.ink, marginBottom: 26 }}>
            {letterClosing(record.language)}
          </Text>
          <Text style={{ fontSize: 15, fontWeight: "bold", color: SENIOR_LIFE.blue }}>
            {agent.name}
          </Text>
          {agent.phone ? (
            <Text style={{ fontSize: 12.5, color: SENIOR_LIFE.ink, marginTop: 4 }}>
              {agent.phone}
            </Text>
          ) : null}
          {agent.email ? (
            <Text style={{ fontSize: 11, color: SENIOR_LIFE.muted, marginTop: 2 }}>
              {agent.email}
            </Text>
          ) : null}
        </View>
      </View>

      {/* Phone repeated at the foot: the whole point of the letter is that they pick up and call. */}
      {agent.phone ? (
        <View
          style={{
            paddingHorizontal: MARGIN_X,
            paddingBottom: 26,
            borderTopWidth: 1,
            borderTopColor: SENIOR_LIFE.gold,
            paddingTop: 12,
            marginHorizontal: MARGIN_X - 20,
          }}
        >
          <Text style={{ fontSize: 11.5, color: SENIOR_LIFE.blue, textAlign: "center" }}>
            {record.language === "es"
              ? `Llámeme cuando guste — ${agent.phone}`
              : `Call me anytime — ${agent.phone}`}
          </Text>
        </View>
      ) : null}
    </Page>
  );
}

export async function renderProspectLetters(params: {
  records: MailingLabelRecord[];
  agent: LetterAgentInfo;
}): Promise<Buffer> {
  const { records, agent } = params;
  const logo = await loadSeniorLifeLogo();

  const doc: ReactElement<DocumentProps> = (
    <Document title="Prospect letters" author="Isaac Plans Insurance">
      {records.map((record) => (
        <LetterPage key={record.id} record={record} agent={agent} logo={logo} />
      ))}
    </Document>
  );

  return renderToBuffer(doc);
}
