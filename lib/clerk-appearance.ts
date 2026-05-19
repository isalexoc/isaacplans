import { dark } from "@clerk/themes";

/** Navy primary used across Isaac Plans / final expense UI */
const COLOR_PRIMARY = "#003366";

export function getClerkAppearance(isDark: boolean) {
  return {
    baseTheme: isDark ? dark : undefined,
    variables: {
      colorPrimary: COLOR_PRIMARY,
    },
  };
}
