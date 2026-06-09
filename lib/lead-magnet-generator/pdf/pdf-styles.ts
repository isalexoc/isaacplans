import { StyleSheet } from "@react-pdf/renderer";

export const BRAND = {
  blue: "#0077B6",
  accent: "#00B4D8",
  dark: "#1a1a2e",
  light: "#f0f8ff",
  white: "#ffffff",
  gray: "#6b7280",
  lightGray: "#f3f4f6",
  borderGray: "#e5e7eb",
};

export const FONT_SIZES = {
  h1: 28,
  h2: 20,
  h3: 16,
  h4: 13,
  body: 11,
  small: 9,
  caption: 8,
};

export const styles = StyleSheet.create({
  page: {
    backgroundColor: BRAND.white,
    paddingTop: 48,
    paddingBottom: 64,
    paddingHorizontal: 56,
    fontFamily: "Helvetica",
  },
  coverPage: {
    backgroundColor: BRAND.blue,
    padding: 0,
  },
  h1: {
    fontSize: FONT_SIZES.h1,
    fontFamily: "Helvetica-Bold",
    color: BRAND.dark,
    marginBottom: 8,
  },
  h2: {
    fontSize: FONT_SIZES.h2,
    fontFamily: "Helvetica-Bold",
    color: BRAND.blue,
    marginBottom: 6,
    marginTop: 20,
    paddingBottom: 4,
    borderBottomWidth: 2,
    borderBottomColor: BRAND.accent,
  },
  h3: {
    fontSize: FONT_SIZES.h3,
    fontFamily: "Helvetica-Bold",
    color: BRAND.dark,
    marginBottom: 4,
    marginTop: 14,
  },
  body: {
    fontSize: FONT_SIZES.body,
    color: BRAND.dark,
    lineHeight: 1.6,
    marginBottom: 8,
  },
  bulletItem: {
    fontSize: FONT_SIZES.body,
    color: BRAND.dark,
    lineHeight: 1.6,
    marginBottom: 4,
    paddingLeft: 12,
  },
  actionStep: {
    backgroundColor: BRAND.light,
    borderLeftWidth: 4,
    borderLeftColor: BRAND.accent,
    padding: 12,
    marginTop: 16,
    marginBottom: 8,
  },
  actionStepLabel: {
    fontSize: FONT_SIZES.small,
    fontFamily: "Helvetica-Bold",
    color: BRAND.accent,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 4,
  },
  tocItem: {
    fontSize: FONT_SIZES.body,
    color: BRAND.dark,
    marginBottom: 8,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  pageNumber: {
    position: "absolute",
    bottom: 24,
    right: 56,
    fontSize: FONT_SIZES.caption,
    color: BRAND.gray,
  },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 56,
    fontSize: FONT_SIZES.caption,
    color: BRAND.gray,
  },
});
