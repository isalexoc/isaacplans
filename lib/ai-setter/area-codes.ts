/**
 * NANP area code → US state + dominant IANA zone, for leads whose phone is the only location
 * signal (no GHL timezone, no address). Overlays share their parent's state and zone.
 *
 * "Dominant" means the zone most of the area code's people live in. Split codes resolve to ONE
 * zone on purpose: 850/448 FL → Central, 915 TX → Mountain, 270/364 KY → Central, 219 IN →
 * Central, 208/986 ID → Boise, 541/458 OR → Pacific, 308 NE / 605 SD / 701 ND → Central,
 * 812/930 IN and 906 MI → Eastern. `resolveLeadZones` (compliance.ts) adds the address zone too,
 * so a lead on the far side of a split still gets the stricter of the two windows.
 *
 * Eastern Indiana, Michigan and Kentucky use America/New_York (identical rules since 2007) so the
 * union with the address zone de-duplicates.
 *
 * Source: NANPA geographic NPAs in service as of 2026-11, including the 2025–26 overlays (483 AL,
 * 471 MS, 621 TX, 729 TN, 837 CA, 821 SC, 748 CO, 457 LA, 465 NY). Codes planned for 2027+ are
 * not listed yet: add them here when they go live.
 *
 * Pure: no DB, no network.
 */

const EASTERN = "America/New_York";
const CENTRAL = "America/Chicago";
const MOUNTAIN = "America/Denver";
const BOISE = "America/Boise";
const ARIZONA = "America/Phoenix";
const PACIFIC = "America/Los_Angeles";
const ALASKA = "America/Anchorage";
const HAWAII = "Pacific/Honolulu";
const ATLANTIC = "America/Puerto_Rico";
const CHAMORRO = "Pacific/Guam";
const SAMOA = "Pacific/Pago_Pago";

/** [state, zone, area codes]: one row per state and zone. */
const AREA_CODE_ROWS: ReadonlyArray<readonly [string, string, string]> = [
  ["AL", CENTRAL, "205 251 256 334 483 659 938"],
  ["AK", ALASKA, "907"],
  ["AZ", ARIZONA, "480 520 602 623 928"],
  ["AR", CENTRAL, "327 479 501 870"],
  [
    "CA",
    PACIFIC,
    "209 213 279 310 323 341 350 357 369 408 415 424 442 510 530 559 562 619 626 628 650 657 661 669 707 714 " +
      "738 747 760 805 818 820 831 837 840 858 909 916 925 949 951",
  ],
  ["CO", MOUNTAIN, "303 719 720 748 970 983"],
  ["CT", EASTERN, "203 475 860 959"],
  ["DE", EASTERN, "302"],
  ["DC", EASTERN, "202 771"],
  ["FL", EASTERN, "239 305 321 324 352 386 407 561 645 656 689 727 728 754 772 786 813 863 904 941 954"],
  ["FL", CENTRAL, "448 850"],
  ["GA", EASTERN, "229 404 470 478 678 706 762 770 912 943"],
  ["HI", HAWAII, "808"],
  ["ID", BOISE, "208 986"],
  ["IL", CENTRAL, "217 224 309 312 331 447 464 618 630 708 730 773 779 815 847 861 872"],
  ["IN", EASTERN, "260 317 463 574 765 812 930"],
  ["IN", CENTRAL, "219"],
  ["IA", CENTRAL, "319 515 563 641 712"],
  ["KS", CENTRAL, "316 620 785 913"],
  ["KY", EASTERN, "502 606 859"],
  ["KY", CENTRAL, "270 364"],
  ["LA", CENTRAL, "225 318 337 457 504 985"],
  ["ME", EASTERN, "207"],
  ["MD", EASTERN, "227 240 301 410 443 667"],
  ["MA", EASTERN, "339 351 413 508 617 774 781 857 978"],
  ["MI", EASTERN, "231 248 269 313 517 586 616 679 734 810 906 947 989"],
  ["MN", CENTRAL, "218 320 507 612 651 763 924 952"],
  ["MS", CENTRAL, "228 471 601 662 769"],
  ["MO", CENTRAL, "235 314 417 557 573 636 660 816 975"],
  ["MT", MOUNTAIN, "406"],
  ["NE", CENTRAL, "308 402 531"],
  ["NV", PACIFIC, "702 725 775"],
  ["NH", EASTERN, "603"],
  ["NJ", EASTERN, "201 551 609 640 732 848 856 862 908 973"],
  ["NM", MOUNTAIN, "505 575"],
  ["NY", EASTERN, "212 315 329 332 347 363 465 516 518 585 607 624 631 646 680 716 718 838 845 914 917 929 934"],
  ["NC", EASTERN, "252 336 472 704 743 828 910 919 980 984"],
  ["ND", CENTRAL, "701"],
  ["OH", EASTERN, "216 220 234 283 326 330 380 419 436 440 513 567 614 740 937"],
  ["OK", CENTRAL, "405 539 572 580 918"],
  ["OR", PACIFIC, "458 503 541 971"],
  ["PA", EASTERN, "215 223 267 272 412 445 484 570 582 610 717 724 814 835 878"],
  ["RI", EASTERN, "401"],
  ["SC", EASTERN, "803 821 839 843 854 864"],
  ["SD", CENTRAL, "605"],
  ["TN", EASTERN, "423 729 865"],
  ["TN", CENTRAL, "615 629 731 901 931"],
  ["TX", CENTRAL, "210 214 254 281 325 346 361 409 430 432 469 512 621 682 713 726 737 806 817 830 832 903 936 940 945 956 972 979"],
  ["TX", MOUNTAIN, "915"],
  ["UT", MOUNTAIN, "385 435 801"],
  ["VT", EASTERN, "802"],
  ["VA", EASTERN, "276 434 540 571 686 703 757 804 826 948"],
  ["WA", PACIFIC, "206 253 360 425 509 564"],
  ["WV", EASTERN, "304 681"],
  ["WI", CENTRAL, "262 274 353 414 534 608 715 920"],
  ["WY", MOUNTAIN, "307"],
  ["PR", ATLANTIC, "787 939"],
  // Other US territories: never licensed, but knowing the zone keeps the reply window honest.
  ["VI", ATLANTIC, "340"],
  ["GU", CHAMORRO, "671"],
  ["MP", CHAMORRO, "670"],
  ["AS", SAMOA, "684"],
];

/** Where an area code is: 2-letter state (or territory) code and its dominant IANA zone. */
export type AreaCodeInfo = { state: string; timeZone: string };

function buildIndex(rows: ReadonlyArray<readonly [string, string, string]>): Map<string, AreaCodeInfo> {
  const index = new Map<string, AreaCodeInfo>();
  for (const [state, timeZone, codes] of rows) {
    for (const code of codes.split(" ")) index.set(code, { state, timeZone });
  }
  return index;
}

const BY_AREA_CODE: ReadonlyMap<string, AreaCodeInfo> = buildIndex(AREA_CODE_ROWS);

/** 8YY toll-free codes in service (800 833 844 855 866 877 888) and reserved for toll-free (822, 880–887, 889). */
const TOLL_FREE = new Set(["800", "822", "833", "844", "855", "866", "877", "880", "881", "882", "883", "884", "885", "886", "887", "888", "889"]);
const PREMIUM_RATE = "900";

/**
 * The 10-digit NANP national number, or null. "+1XXXXXXXXXX", "1XXXXXXXXXX", "XXXXXXXXXX" and
 * formatted versions ("(305) 555-0142") all work; a "+" with any other country code is not NANP.
 */
function nationalNumber(phone: string): string | null {
  const trimmed = phone.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (trimmed.startsWith("+")) return digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : null;
  if (digits.length === 10) return digits;
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1);
  return null;
}

/**
 * State and dominant IANA zone of a US phone number's area code. Null for non-NANP numbers,
 * Canada and the Caribbean, and non-geographic codes (8YY toll-free, 900, 5XX, 6XX, 7XX).
 *
 * @example areaCodeInfo("+13055550142") // { state: "FL", timeZone: "America/New_York" }
 * @example areaCodeInfo("850-555-0142") // { state: "FL", timeZone: "America/Chicago" }
 */
export function areaCodeInfo(phone: string | null | undefined): AreaCodeInfo | null {
  if (!phone) return null;
  const national = nationalNumber(phone);
  if (!national) return null;
  const info = BY_AREA_CODE.get(national.slice(0, 3));
  return info ? { state: info.state, timeZone: info.timeZone } : null;
}

/**
 * True for a 5–6 digit short code ("22395") or a toll-free / 900 number: senders that are
 * businesses or services, never a lead the AI should answer. Alphanumeric senders are false.
 */
export function isTollFreeOrShortCode(phoneOrSender: string | null | undefined): boolean {
  const raw = (phoneOrSender ?? "").trim();
  if (!raw || !/^[+\d\s().-]+$/.test(raw)) return false;
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 5 || digits.length === 6) return true;
  const national = nationalNumber(raw);
  if (!national) return false;
  const npa = national.slice(0, 3);
  return TOLL_FREE.has(npa) || npa === PREMIUM_RATE;
}
