/**
 * Per-state ACH routing numbers for the banks where the state actually matters.
 *
 * ─── Why this file exists at all ───
 *
 * The Federal Reserve's directory carries a state for every institution, but it is the bank's
 * **administrative address**, not the customer's. Measured against the real file: 103 of Bank of
 * America's 106 routing numbers say Virginia, 83 of Wells Fargo's 86 say Minnesota, all 70 of
 * Capital One's say Virginia, all 44 of U.S. Bank's say Minnesota. So "Bank of America" + "Texas"
 * searched against Fed data returns nothing useful — and every paid routing-search API is built on
 * that same file, which is why paying would not have fixed it either.
 *
 * What Google returns for "Bank of America routing number Texas" comes from tables like this one:
 * assembled from each bank's own customer-service pages. So we keep our own.
 *
 * ─── How every number here was checked ───
 *
 * Two gates, both of which rejected real entries rather than being decoration:
 *   1. **ABA checksum** — caught `081000033`, published as Bank of America Missouri and simply wrong.
 *   2. **Present in the FedACH directory under this bank's own name** — caught `064103707`,
 *      published as U.S. Bank North Carolina but absent from the Fed file entirely.
 *
 * 213 per-state entries survived both gates.
 *
 * ─── Read this before "fixing" a state with two numbers ───
 *
 * Several states legitimately map to more than one number — a bank that grew by acquisition keeps
 * the acquired bank's number for accounts opened at those branches. Illinois really does have two
 * live Bank of America numbers. The list is ordered most-likely-first and the UI shows all of them
 * for the client to confirm; collapsing it to one would silently pick wrong for half those clients.
 *
 * Nothing here is ever auto-filled. It is read back to the client, who confirms against their own
 * cheque or banking app. A wrong routing number is a failed draft and a lapsed policy, so a
 * suggestion the client rejects costs nothing while a silent auto-fill could cost the policy.
 */

export type CuratedBank = {
  /** Display name, shown beside a suggestion. */
  name: string;
  /** Lowercase fragments matched against whatever the agent types. Order does not matter. */
  aliases: string[];
  /** One ACH number for the whole country. Mutually exclusive with `byState` in practice. */
  nationwide?: string[];
  /** Two-letter state → ACH routing numbers, most likely first. */
  byState?: Record<string, string[]>;
};

/**
 * Banks that use a single ACH number everywhere.
 *
 * Worth stating explicitly rather than leaving to the directory: when a client says "Wells Fargo"
 * the answer is 121000248 whatever state they name, and saying so with confidence is the whole
 * point of the lookup. Every number below passes the checksum and appears in the FedACH directory
 * under the bank's own name.
 */
const NATIONWIDE: CuratedBank[] = [
  { name: "Wells Fargo", aliases: ["wells fargo", "wells"], nationwide: ["121000248"] },
  { name: "Regions Bank", aliases: ["regions"], nationwide: ["062005690"] },
  { name: "M&T Bank", aliases: ["m&t", "m and t", "mt bank"], nationwide: ["022000046"] },
  { name: "BMO Harris Bank", aliases: ["bmo", "harris bank"], nationwide: ["071000288"] },
  { name: "Santander Bank", aliases: ["santander"], nationwide: ["231372691"] },
  { name: "Navy Federal Credit Union", aliases: ["navy federal", "nfcu"], nationwide: ["256074974"] },
  { name: "USAA Federal Savings Bank", aliases: ["usaa"], nationwide: ["314074269"] },
  { name: "Ally Bank", aliases: ["ally"], nationwide: ["124003116"] },
  { name: "Discover Bank", aliases: ["discover"], nationwide: ["031100649"] },
  { name: "Charles Schwab Bank", aliases: ["schwab"], nationwide: ["121202211"] },
  { name: "American Express National Bank", aliases: ["american express", "amex"], nationwide: ["124085066"] },
  { name: "Frost Bank", aliases: ["frost"], nationwide: ["114000093"] },
  { name: "First Citizens Bank", aliases: ["first citizens"], nationwide: ["053100300"] },
  { name: "Huntington National Bank", aliases: ["huntington"], nationwide: ["044000024"] },
  /**
   * Both legacy numbers still run. Truist was BB&T + SunTrust, and accounts opened before the
   * merger kept the number they were opened under — so the client's vintage decides, not ours.
   */
  { name: "Truist Bank", aliases: ["truist", "bb&t", "bbt", "suntrust"], nationwide: ["061000104", "053101121"] },
  /** Capital One Bank (USA) and Capital One N.A. are separate charters; both are live. */
  { name: "Capital One", aliases: ["capital one", "capitalone"], nationwide: ["051405515", "065000090"] },
  /** TD split New England from the mid-Atlantic; neither is a nationwide number. */
  {
    name: "TD Bank",
    aliases: ["td bank", "td"],
    byState: {
      CT: ["011400071"], DC: ["031201360"], DE: ["031201360"], FL: ["067014822"],
      MA: ["011400071"], MD: ["031201360"], ME: ["011400071"], NC: ["031201360"],
      NH: ["011400071"], NJ: ["031201360"], NY: ["026013673"], PA: ["031201360"],
      RI: ["011400071"], SC: ["031201360"], VA: ["031201360"], VT: ["011400071"],
    },
  },
  /** Comerica registers a separate charter per region; the Fed lists all three in Detroit. */
  {
    name: "Comerica Bank",
    aliases: ["comerica"],
    byState: { MI: ["072000096"], TX: ["111000753"], CA: ["121137522"] },
  },
];

/** Banks whose ACH number genuinely differs by the state the account was opened in. */
const BY_STATE: CuratedBank[] = [
  {
    name: "Bank of America",
    aliases: ["bank of america", "bofa", "b of a"],
    byState: {
      AR: ["082000073"],
      AZ: ["122101706"],
      CA: ["121000358"],
      CO: ["123103716"],
      CT: ["011900254"],
      DC: ["054001204"],
      DE: ["031202084"],
      FL: ["063100277"],
      GA: ["061000052"],
      IA: ["073000176"],
      ID: ["123103716"],
      IL: ["081904808", "071000505"],
      IN: ["071214579"],
      KS: ["101100045"],
      KY: ["051000017"],
      MA: ["011000138"],
      MD: ["052001633"],
      ME: ["011200365"],
      MI: ["072000805"],
      MN: ["071214579"],
      MO: ["081000032"],
      NC: ["053000196"],
      NE: ["051000017"],
      NH: ["011400495"],
      NJ: ["021200339"],
      NM: ["107000327"],
      NV: ["122400724"],
      NY: ["021000322"],
      OH: ["051000017"],
      OK: ["103000017"],
      OR: ["323070380"],
      PA: ["031202084"],
      RI: ["011500010"],
      SC: ["053904483"],
      TN: ["064000020"],
      TX: ["111000025"],
      UT: ["051000017"],
      VA: ["051000017"],
      WA: ["125000024"],
    },
  },
  {
    name: "Chase",
    aliases: ["chase", "jpmorgan", "jp morgan", "jpmorgan chase"],
    byState: {
      AL: ["065400137"],
      AR: ["065400137"],
      AZ: ["122100024"],
      CA: ["322271627"],
      CO: ["102001017"],
      CT: ["021100361"],
      DC: ["044000037"],
      DE: ["083000137"],
      FL: ["267084131"],
      GA: ["061092387"],
      IA: ["075000019"],
      ID: ["123271978"],
      IL: ["071000013"],
      IN: ["074000010"],
      KS: ["103000648"],
      KY: ["083000137"],
      LA: ["065400137"],
      MA: ["021000021"],
      MD: ["044000037"],
      ME: ["083000137"],
      MI: ["072000326"],
      MN: ["075000019"],
      MO: ["103000648"],
      MS: ["065400137"],
      MT: ["102001017"],
      NC: ["072000326"],
      ND: ["103000648"],
      NE: ["103000648"],
      NH: ["083000137"],
      NJ: ["021202337"],
      NM: ["102001017"],
      NV: ["322271627"],
      NY: ["021000021", "022300173"],
      OH: ["044000037"],
      OK: ["103000648"],
      OR: ["325070760"],
      PA: ["083000137"],
      RI: ["083000137"],
      SC: ["072000326"],
      SD: ["103000648"],
      TN: ["065400137"],
      TX: ["111000614"],
      UT: ["124001545"],
      VA: ["044000037"],
      VT: ["083000137"],
      WA: ["325070760"],
      WI: ["075000019"],
      WV: ["051900366"],
      WY: ["102001017"],
    },
  },
  {
    name: "U.S. Bank",
    aliases: ["us bank", "u.s. bank", "usbank", "us bancorp"],
    byState: {
      AR: ["082000549"],
      AZ: ["122105155"],
      CA: ["121122676", "122235821"],
      CO: ["102000021", "102101645"],
      IA: ["104000029"],
      ID: ["123103729"],
      IL: ["071904779", "081202759"],
      IN: ["074900783"],
      KS: ["101000187"],
      KY: ["042100175", "083900363"],
      MN: ["091000022", "091215927", "091300023"],
      MO: ["081000210", "101200453"],
      MT: ["092900383"],
      ND: ["091300023"],
      NE: ["104000029"],
      NM: ["107002312"],
      NV: ["121201694"],
      OH: ["042000013"],
      OR: ["123000220"],
      SD: ["091408501"],
      TN: ["064000059"],
      UT: ["124302150"],
      WA: ["125000105"],
      WI: ["075000022"],
      WY: ["307070115"],
    },
  },
  {
    name: "PNC Bank",
    aliases: ["pnc"],
    byState: {
      AL: ["043000096"],
      DC: ["054000030"],
      DE: ["031100089"],
      FL: ["267084199"],
      GA: ["053100850", "061192630"],
      IL: ["071921891"],
      IN: ["043000096"],
      KY: ["083000108"],
      MD: ["054000030"],
      MI: ["041000124"],
      MO: ["071921891"],
      NC: ["043000096"],
      NJ: ["031207607"],
      OH: ["042000398", "041000124"],
      PA: ["043000096"],
      SC: ["053100850"],
      VA: ["054000030"],
      WI: ["071921891"],
      WV: ["271971560"],
    },
  },
  {
    name: "Citibank",
    aliases: ["citibank", "citi"],
    byState: {
      CA: ["321171184", "322271724"],
      CT: ["221172610"],
      DC: ["254070116"],
      DE: ["031100209"],
      FL: ["266086554"],
      IL: ["271070801"],
      MD: ["052002166"],
      NJ: ["021272655"],
      NV: ["122401710"],
      NY: ["021000089", "021001486"],
      PR: ["021502040"],
      SD: ["021000089"],
      VA: ["254070116"],
    },
  },
  {
    name: "Fifth Third Bank",
    aliases: ["fifth third", "5/3", "53 bank"],
    byState: {
      FL: ["063109935", "063113057", "067091719", "063103915"],
      GA: ["263190812"],
      IL: ["071923909"],
      IN: ["074908594", "086300041", "083002342"],
      KY: ["042101190", "042100230"],
      MI: ["072405455", "072401404", "072400052"],
      NC: ["053100737"],
      OH: ["042000314", "044002161", "041002711", "041200050", "042207735", "042202196"],
      TN: ["064103833"],
      WV: ["051504665", "042207735"],
    },
  },
  {
    name: "KeyBank",
    aliases: ["keybank", "key bank"],
    byState: {
      AK: ["125200879"],
      CO: ["307070267"],
      CT: ["021300077"],
      FL: ["041001039"],
      ID: ["124101555"],
      IN: ["041001039"],
      MA: ["021300077"],
      ME: ["011200608"],
      MI: ["041001039"],
      NY: ["021300077"],
      OH: ["041001039"],
      OR: ["123002011"],
      PA: ["021300077"],
      UT: ["124000737"],
      VT: ["211672531"],
      WA: ["125000574"],
    },
  },
  {
    name: "Citizens Bank",
    aliases: ["citizens"],
    byState: {
      CT: ["211170114"],
      DC: ["241070417"],
      DE: ["241070417"],
      FL: ["241070417"],
      MA: ["211070175"],
      MD: ["241070417"],
      MI: ["241070417"],
      NH: ["011401533"],
      NJ: ["036076150"],
      NY: ["021313103"],
      OH: ["241070417"],
      PA: ["036076150"],
      RI: ["011500120"],
      VA: ["011500120"],
      VT: ["021313103"],
    },
  },];

export const CURATED_BANKS: CuratedBank[] = [...BY_STATE, ...NATIONWIDE];
