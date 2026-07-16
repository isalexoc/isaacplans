/**
 * Seeds the singleton `iulPresentation` document (_id: "iulPresentation") from
 * the legacy next-intl message snapshots (scripts/data/iul-presentation-*.json)
 * plus the values that were hardcoded in components/iul-slide-content.tsx
 * (slide images, company statistics, chart label placements).
 *
 * Slide images are uploaded from Cloudinary into Sanity assets (deduped by
 * original filename) so they are editable in Studio.
 *
 * Default run is idempotent (createIfNotExists). Pass --force to
 * createOrReplace — WARNING: --force clobbers any edits made in Studio.
 *
 * Run: pnpm add:iul-presentation [--force]
 */
import "dotenv/config";
import { createClient } from "next-sanity";
import enMessages from "./data/iul-presentation-en.json";
import esMessages from "./data/iul-presentation-es.json";

const client = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || "anetxoet",
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || "production",
  apiVersion: "2024-01-01",
  token: process.env.SANITY_API_WRITE_TOKEN,
  useCdn: false,
});

const en = enMessages.iulPresentation;
const es = esMessages.iulPresentation;

/* ───────── Images (previously hardcoded in TSX / JSON URLs) ───────── */

const IMAGE_URLS = {
  headshot: "https://res.cloudinary.com/isaacdev/image/upload/isaacpic_c8kca5.png",
  discovery: "https://res.cloudinary.com/isaacdev/image/upload/v1762887079/discovery_ddgd3v.jpg",
  product401k: "https://res.cloudinary.com/isaacdev/image/upload/v1762887006/401k_yr3t1y.png",
  productIra: "https://res.cloudinary.com/isaacdev/image/upload/v1762886951/traditional_ira_1_xbidkk.png",
  productRothIra: "https://res.cloudinary.com/isaacdev/image/upload/v1762886953/roth_ira_1_r5igct.png",
  productRoth401k: "https://res.cloudinary.com/isaacdev/image/upload/v1762886952/Roth_401K_1_ghnmti.png",
  productSepIra: "https://res.cloudinary.com/isaacdev/image/upload/v1762886952/SEP_IRA_1_cnbfun.png",
  scenarioPenalty: "https://res.cloudinary.com/isaacdev/image/upload/v1762886951/first_example_1_ywh1u1.png",
  scenarioRmd: "https://res.cloudinary.com/isaacdev/image/upload/v1762886951/second_example_1_scjof2.png",
  scenarioMarket: "https://res.cloudinary.com/isaacdev/image/upload/v1762886951/thirt_example_1_kybuno.png",
  scenarioIllness: "https://res.cloudinary.com/isaacdev/image/upload/v1762886952/fouth_example_1_lljvly.png",
  iulHero: en.slides.slide17.imagePlaceholder,
  companyLogo: en.slides.slide26.logoUrl,
} as const;

type ImageKey = keyof typeof IMAGE_URLS;

interface SanityImage {
  _type: "image";
  asset: { _type: "reference"; _ref: string };
  altEn?: string;
  altEs?: string;
}

const assetIds = new Map<ImageKey, string>();

async function uploadImages(): Promise<void> {
  for (const [key, url] of Object.entries(IMAGE_URLS) as [ImageKey, string][]) {
    const filename = url.split("/").pop() || `${key}.png`;
    const existing: string | null = await client.fetch(
      `*[_type == "sanity.imageAsset" && originalFilename == $fn][0]._id`,
      { fn: filename }
    );
    if (existing) {
      console.log(`⏭️  Image "${filename}" already uploaded`);
      assetIds.set(key, existing);
      continue;
    }
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to download ${url}: ${res.status}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    const asset = await client.assets.upload("image", buffer, { filename });
    assetIds.set(key, asset._id);
    console.log(`✅ Uploaded image "${filename}"`);
  }
}

function img(key: ImageKey, altEn?: string, altEs?: string): SanityImage {
  const _ref = assetIds.get(key);
  if (!_ref) throw new Error(`Image asset not uploaded: ${key}`);
  return { _type: "image", asset: { _type: "reference", _ref }, altEn, altEs };
}

/* ───────── Slide builders ───────── */

type Slide = Record<string, unknown> & { _type: string; _key: string };

function buildAgent(): Slide {
  const e = en.slides.slide1;
  const s = es.slides.slide1;
  return {
    _type: "iulSlideAgent",
    _key: "slide1",
    titleEn: e.title, titleEs: s.title,
    subtitleEn: e.subtitle, subtitleEs: s.subtitle,
    roleEn: e.role, roleEs: s.role,
    introductionEn: e.introduction, introductionEs: s.introduction,
    headshot: img("headshot", e.contact.name, s.contact.name),
    contact: {
      name: e.contact.name,
      phone: e.contact.phone,
      email: e.contact.email,
      website: e.contact.website,
    },
    credentials: {
      titleEn: e.credentials.title, titleEs: s.credentials.title,
      listEn: e.credentials.list, listEs: s.credentials.list,
    },
    stateLicense: {
      titleEn: e.stateLicense.title, titleEs: s.stateLicense.title,
      selectLabelEn: e.stateLicense.selectLabel, selectLabelEs: s.stateLicense.selectLabel,
      placeholderEn: e.stateLicense.placeholder, placeholderEs: s.stateLicense.placeholder,
    },
    driversLicense: {
      titleEn: e.driversLicense.title, titleEs: s.driversLicense.title,
      placeholderEn: e.driversLicense.placeholder, placeholderEs: s.driversLicense.placeholder,
    },
    download: {
      asImageEn: e.download.asImage, asImageEs: s.download.asImage,
      asPDFEn: e.download.asPDF, asPDFEs: s.download.asPDF,
      downloadingEn: e.download.downloading, downloadingEs: s.download.downloading,
    },
    unlock: {
      unlockedEn: e.unlock.unlocked, unlockedEs: s.unlock.unlocked,
      lockedMessageEn: e.unlock.lockedMessage, lockedMessageEs: s.unlock.lockedMessage,
      // Reveal is now Clerk-admin gated — the old "click reveal" copy is replaced.
      lockedSubmessageEn: "Sign in as an admin to view",
      lockedSubmessageEs: "Inicie sesión como administrador para ver",
    },
  };
}

function buildDiscovery(): Slide {
  const e = en.slides.slide2;
  const s = es.slides.slide2;
  return {
    _type: "iulSlideDiscovery",
    _key: "slide2",
    titleEn: e.title, titleEs: s.title,
    subtitleEn: e.subtitle, subtitleEs: s.subtitle,
    descriptionEn: e.description, descriptionEs: s.description,
    questionsEn: e.questions, questionsEs: s.questions,
    image: img("discovery", e.title, s.title),
  };
}

interface RetirementProductJson {
  title: string;
  subtitle: string;
  product: { name: string; description: string; contributionLimit?: string; catchUp?: string };
  advantages: string[];
  disadvantages: string[];
}

function buildRetirementProduct(
  key: string,
  e: RetirementProductJson,
  s: RetirementProductJson,
  imageKey: ImageKey
): Slide {
  return {
    _type: "iulSlideRetirementProduct",
    _key: key,
    titleEn: e.title, titleEs: s.title,
    subtitleEn: e.subtitle, subtitleEs: s.subtitle,
    product: {
      nameEn: e.product.name, nameEs: s.product.name,
      descriptionEn: e.product.description, descriptionEs: s.product.description,
      ...(e.product.contributionLimit ? { contributionLimit: e.product.contributionLimit } : {}),
      ...(e.product.catchUp ? { catchUpEn: e.product.catchUp, catchUpEs: s.product.catchUp } : {}),
    },
    image: img(imageKey, e.product.name, s.product.name),
    advantagesEn: e.advantages, advantagesEs: s.advantages,
    disadvantagesEn: e.disadvantages, disadvantagesEs: s.disadvantages,
  };
}

interface ScenarioJson {
  title: string;
  subtitle: string;
  warning: string;
  scenario: {
    title: string;
    situation: string;
    problem: string;
    impact: string;
    keyNumbers: { value: string; label: string; type: string }[];
  };
}

function buildScenario(
  key: string,
  e: ScenarioJson,
  s: ScenarioJson,
  scenarioKind: "penalty" | "rmd" | "market" | "illness",
  imageKey: ImageKey
): Slide {
  return {
    _type: "iulSlideScenario",
    _key: key,
    titleEn: e.title, titleEs: s.title,
    subtitleEn: e.subtitle, subtitleEs: s.subtitle,
    warningEn: e.warning, warningEs: s.warning,
    scenarioKind,
    image: img(imageKey, e.scenario.title, s.scenario.title),
    scenario: {
      titleEn: e.scenario.title, titleEs: s.scenario.title,
      situationEn: e.scenario.situation, situationEs: s.scenario.situation,
      problemEn: e.scenario.problem, problemEs: s.scenario.problem,
      impactEn: e.scenario.impact, impactEs: s.scenario.impact,
      keyNumbers: e.scenario.keyNumbers.map((kn, i) => ({
        _type: "keyNumber",
        _key: `kn${i}`,
        valueEn: kn.value, valueEs: s.scenario.keyNumbers[i].value,
        labelEn: kn.label, labelEs: s.scenario.keyNumbers[i].label,
        numberType: kn.type,
      })),
    },
  };
}

function buildBank(): Slide {
  const e = en.slides.slide12;
  const s = es.slides.slide12;
  return {
    _type: "iulSlideBank",
    _key: "slide12",
    titleEn: e.title, titleEs: s.title,
    subtitleEn: e.subtitle, subtitleEs: s.subtitle,
    questionsEn: e.questions, questionsEs: s.questions,
    descriptionEn: e.description, descriptionEs: s.description,
  };
}

interface BankExampleJson {
  title: string;
  subtitle: string;
  example: {
    scenario: string;
    loanAmount: string;
    interestRate: string;
    loanTerm: string;
    monthlyPayment: string;
    totalPaid: string;
    interestPaid: string;
    problem: string;
  };
}

function buildBankExample(key: string, e: BankExampleJson, s: BankExampleJson): Slide {
  return {
    _type: "iulSlideBankExample",
    _key: key,
    titleEn: e.title, titleEs: s.title,
    subtitleEn: e.subtitle, subtitleEs: s.subtitle,
    example: {
      scenarioEn: e.example.scenario, scenarioEs: s.example.scenario,
      loanAmount: e.example.loanAmount,
      interestRate: e.example.interestRate,
      loanTermEn: e.example.loanTerm, loanTermEs: s.example.loanTerm,
      monthlyPayment: e.example.monthlyPayment,
      totalPaid: e.example.totalPaid,
      interestPaid: e.example.interestPaid,
      problemEn: e.example.problem, problemEs: s.example.problem,
    },
  };
}

function buildBankCosts(): Slide {
  const e = en.slides.slide15;
  const s = es.slides.slide15;
  return {
    _type: "iulSlideBankCosts",
    _key: "slide15",
    titleEn: e.title, titleEs: s.title,
    subtitleEn: e.subtitle, subtitleEs: s.subtitle,
    costs: e.costs.map((cost, i) => ({
      _type: "costItem",
      _key: `cost${i}`,
      itemEn: cost.item, itemEs: s.costs[i].item,
      amount: cost.amount,
      descriptionEn: cost.description, descriptionEs: s.costs[i].description,
    })),
    total: e.total,
    summaryEn: e.summary, summaryEs: s.summary,
  };
}

function buildBankTeaser(): Slide {
  const e = en.slides.slide16;
  const s = es.slides.slide16;
  return {
    _type: "iulSlideBankTeaser",
    _key: "slide16",
    titleEn: e.title, titleEs: s.title,
    subtitleEn: e.subtitle, subtitleEs: s.subtitle,
    questionsEn: e.questions, questionsEs: s.questions,
    descriptionEn: e.description, descriptionEs: s.description,
  };
}

function buildIulHero(): Slide {
  const e = en.slides.slide17;
  const s = es.slides.slide17;
  return {
    _type: "iulSlideIulHero",
    _key: "slide17",
    titleEn: e.title, titleEs: s.title,
    subtitleEn: e.subtitle, subtitleEs: s.subtitle,
    descriptionEn: e.description, descriptionEs: s.description,
    highlightsEn: e.highlights, highlightsEs: s.highlights,
    image: img("iulHero", e.subtitle, s.subtitle),
    ctaEn: e.cta, ctaEs: s.cta,
  };
}

function buildIulWho(): Slide {
  const e = en.slides.slide18;
  const s = es.slides.slide18;
  return {
    _type: "iulSlideIulWho",
    _key: "slide18",
    titleEn: e.title, titleEs: s.title,
    subtitleEn: e.subtitle, subtitleEs: s.subtitle,
    descriptionEn: e.description, descriptionEs: s.description,
    characteristics: e.characteristics.map((c, i) => ({
      _type: "characteristic",
      _key: `char${i}`,
      titleEn: c.title, titleEs: s.characteristics[i].title,
      descriptionEn: c.description, descriptionEs: s.characteristics[i].description,
      icon: c.icon,
    })),
    ctaEn: e.cta, ctaEs: s.cta,
  };
}

function buildIulComparison(): Slide {
  const e = en.slides.slide19;
  const s = es.slides.slide19;
  // Label placements were hardcoded per investment name in the old chart code.
  const placementByName: Record<string, string> = {
    Banks: "topLeft",
    "Treasury Bonds": "bottom",
    "Whole Life": "topRight",
    Stocks: "top",
    Crypto: "bottom",
    IUL: "top",
  };
  return {
    _type: "iulSlideIulComparison",
    _key: "slide19",
    titleEn: e.title, titleEs: s.title,
    subtitleEn: e.subtitle, subtitleEs: s.subtitle,
    descriptionEn: e.description, descriptionEs: s.description,
    investments: e.investments.map((inv, i) => ({
      _type: "investment",
      _key: `inv${i}`,
      nameEn: inv.name, nameEs: s.investments[i].name,
      risk: inv.risk,
      reward: inv.reward,
      isIul: inv.name === "IUL",
      labelPlacement: placementByName[inv.name] ?? "top",
    })),
    legend: {
      traditionalEn: e.legend.traditional, traditionalEs: s.legend.traditional,
      iulEn: e.legend.iul, iulEs: s.legend.iul,
      typicalLineEn: e.legend.typicalLine, typicalLineEs: s.legend.typicalLine,
    },
    axis: {
      riskEn: e.axis.risk, riskEs: s.axis.risk,
      rewardEn: e.axis.reward, rewardEs: s.axis.reward,
    },
    insightEn: e.insight, insightEs: s.insight,
  };
}

function buildIulStructure(): Slide {
  const e = en.slides.slide20;
  const s = es.slides.slide20;
  return {
    _type: "iulSlideIulStructure",
    _key: "slide20",
    titleEn: e.title, titleEs: s.title,
    subtitleEn: e.subtitle, subtitleEs: s.subtitle,
    descriptionEn: e.description, descriptionEs: s.description,
    twoComponents: {
      titleEn: e.twoComponents.title, titleEs: s.twoComponents.title,
      deathBenefit: {
        nameEn: e.twoComponents.deathBenefit.name, nameEs: s.twoComponents.deathBenefit.name,
        descriptionEn: e.twoComponents.deathBenefit.description, descriptionEs: s.twoComponents.deathBenefit.description,
      },
      cashValue: {
        nameEn: e.twoComponents.cashValue.name, nameEs: s.twoComponents.cashValue.name,
        descriptionEn: e.twoComponents.cashValue.description, descriptionEs: s.twoComponents.cashValue.description,
      },
    },
    relationship: {
      titleEn: e.relationship.title, titleEs: s.relationship.title,
      explanationEn: e.relationship.explanation, explanationEs: s.relationship.explanation,
      pointsEn: e.relationship.points, pointsEs: s.relationship.points,
    },
    cashValueFeatures: {
      titleEn: e.cashValueFeatures.title, titleEs: s.cashValueFeatures.title,
      pointsEn: e.cashValueFeatures.points, pointsEs: s.cashValueFeatures.points,
    },
    whyStructureMatters: {
      titleEn: e.whyStructureMatters.title, titleEs: s.whyStructureMatters.title,
      pointsEn: e.whyStructureMatters.points, pointsEs: s.whyStructureMatters.points,
    },
    ctaEn: e.cta, ctaEs: s.cta,
  };
}

function buildIulIndexing(): Slide {
  const e = en.slides.slide21;
  const s = es.slides.slide21;
  return {
    _type: "iulSlideIulIndexing",
    _key: "slide21",
    titleEn: e.title, titleEs: s.title,
    subtitleEn: e.subtitle, subtitleEs: s.subtitle,
    descriptionEn: e.description, descriptionEs: s.description,
    keyPoints: e.keyPoints.map((kp, i) => ({
      _type: "keyPoint",
      _key: `kp${i}`,
      icon: kp.icon,
      titleEn: kp.title, titleEs: s.keyPoints[i].title,
      descriptionEn: kp.description, descriptionEs: s.keyPoints[i].description,
    })),
    visualNoteEn: e.visualNote, visualNoteEs: s.visualNote,
    visualLabels: {
      yourMoneyEn: e.visualLabels.yourMoney, yourMoneyEs: s.visualLabels.yourMoney,
      inIULPolicyEn: e.visualLabels.inIULPolicy, inIULPolicyEs: s.visualLabels.inIULPolicy,
      followsEn: e.visualLabels.follows, followsEs: s.visualLabels.follows,
      marketIndexEn: e.visualLabels.marketIndex, marketIndexEs: s.visualLabels.marketIndex,
      performanceEn: e.visualLabels.performance, performanceEs: s.visualLabels.performance,
      yourGrowthEn: e.visualLabels.yourGrowth, yourGrowthEs: s.visualLabels.yourGrowth,
      protectedParticipatingEn: e.visualLabels.protectedParticipating,
      protectedParticipatingEs: s.visualLabels.protectedParticipating,
    },
  };
}

function buildIulTerms(): Slide {
  const e = en.slides.slide22;
  const s = es.slides.slide22;
  return {
    _type: "iulSlideIulTerms",
    _key: "slide22",
    titleEn: e.title, titleEs: s.title,
    subtitleEn: e.subtitle, subtitleEs: s.subtitle,
    floor: {
      titleEn: e.floor.title, titleEs: s.floor.title,
      descriptionEn: e.floor.description, descriptionEs: s.floor.description,
      explanationEn: e.floor.explanation, explanationEs: s.floor.explanation,
    },
    cap: {
      titleEn: e.cap.title, titleEs: s.cap.title,
      descriptionEn: e.cap.description, descriptionEs: s.cap.description,
      explanationEn: e.cap.explanation, explanationEs: s.cap.explanation,
    },
    noteEn: e.note, noteEs: s.note,
    visualLabels: {
      marketDropsEn: e.visualLabels.marketDrops, marketDropsEs: s.visualLabels.marketDrops,
      yourAccountEn: e.visualLabels.yourAccount, yourAccountEs: s.visualLabels.yourAccount,
      protectedEn: e.visualLabels.protected, protectedEs: s.visualLabels.protected,
      marketGainsEn: e.visualLabels.marketGains, marketGainsEs: s.visualLabels.marketGains,
      cappedAtEn: e.visualLabels.cappedAt, cappedAtEs: s.visualLabels.cappedAt,
    },
  };
}

function buildIulNotInvested(): Slide {
  const e = en.slides.slide23;
  const s = es.slides.slide23;
  return {
    _type: "iulSlideIulNotInvested",
    _key: "slide23",
    titleEn: e.title, titleEs: s.title,
    subtitleEn: e.subtitle, subtitleEs: s.subtitle,
    comparison: {
      directInvestment: {
        titleEn: e.comparison.directInvestment.title, titleEs: s.comparison.directInvestment.title,
        pointsEn: e.comparison.directInvestment.points, pointsEs: s.comparison.directInvestment.points,
      },
      indexing: {
        titleEn: e.comparison.indexing.title, titleEs: s.comparison.indexing.title,
        pointsEn: e.comparison.indexing.points, pointsEs: s.comparison.indexing.points,
      },
    },
    keyMessageEn: e.keyMessage, keyMessageEs: s.keyMessage,
    visualLabels: {
      yourMoneyStocksEn: e.visualLabels.yourMoneyStocks, yourMoneyStocksEs: s.visualLabels.yourMoneyStocks,
      yourMoneyPolicyEn: e.visualLabels.yourMoneyPolicy, yourMoneyPolicyEs: s.visualLabels.yourMoneyPolicy,
    },
  };
}

function buildIulHowItWorks(): Slide {
  const e = en.slides.slide24;
  const s = es.slides.slide24;
  return {
    _type: "iulSlideIulHowItWorks",
    _key: "slide24",
    titleEn: e.title, titleEs: s.title,
    subtitleEn: e.subtitle, subtitleEs: s.subtitle,
    scenarios: e.scenarios.map((sc, i) => ({
      _type: "yearScenario",
      _key: `year${i}`,
      yearEn: sc.year, yearEs: s.scenarios[i].year,
      marketReturn: sc.marketReturn,
      yourReturn: sc.yourReturn,
      explanationEn: sc.explanation, explanationEs: s.scenarios[i].explanation,
    })),
    summaryEn: e.summary, summaryEs: s.summary,
    visualLabels: {
      marketReturnEn: e.visualLabels.marketReturn, marketReturnEs: s.visualLabels.marketReturn,
      yourReturnEn: e.visualLabels.yourReturn, yourReturnEs: s.visualLabels.yourReturn,
    },
  };
}

function buildIulIllustrationCta(): Slide {
  const e = en.slides.slide25;
  const s = es.slides.slide25;
  return {
    _type: "iulSlideIulIllustrationCta",
    _key: "slide25",
    titleEn: e.title, titleEs: s.title,
    subtitleEn: e.subtitle, subtitleEs: s.subtitle,
    descriptionEn: e.description, descriptionEs: s.description,
    whatYoullSeeTitleEn: e.whatYoullSeeTitle, whatYoullSeeTitleEs: s.whatYoullSeeTitle,
    whatYoullSeeEn: e.whatYoullSee, whatYoullSeeEs: s.whatYoullSee,
    ctaEn: e.cta, ctaEs: s.cta,
  };
}

function buildCompany(): Slide {
  const e = en.slides.slide26;
  const s = es.slides.slide26;
  return {
    _type: "iulSlideCompany",
    _key: "slide26",
    titleEn: e.title, titleEs: s.title,
    subtitleEn: e.subtitle, subtitleEs: s.subtitle,
    descriptionEn: e.description, descriptionEs: s.description,
    companyName: e.companyName,
    logo: img("companyLogo", e.companyName, s.companyName),
    videoUrl: e.videoUrl,
    videoTitleEn: e.videoTitle, videoTitleEs: s.videoTitle,
    videoDescriptionEn: e.videoDescription, videoDescriptionEs: s.videoDescription,
    valuesTitleEn: e.valuesTitle, valuesTitleEs: s.valuesTitle,
    values: e.values.map((v, i) => ({
      _type: "companyValue",
      _key: `value${i}`,
      titleEn: v.title, titleEs: s.values[i].title,
      descriptionEn: v.description, descriptionEs: s.values[i].description,
    })),
    statistics: {
      // Values were hardcoded in CompanySlide TSX; labels come from the JSON.
      assetsValue: "$57.4B",
      assetsLabelEn: e.statistics.assets, assetsLabelEs: s.statistics.assets,
      yearsValue: "175+",
      yearsLabelEn: e.statistics.years, yearsLabelEs: s.statistics.years,
      ratingValue: "A+ Rating",
      ratingLabelEn: e.statistics.rating, ratingLabelEs: s.statistics.rating,
    },
    highlights: e.highlights.map((h, i) => ({
      _type: "companyHighlight",
      _key: `highlight${i}`,
      titleEn: h.title, titleEs: s.highlights[i].title,
      descriptionEn: h.description, descriptionEs: s.highlights[i].description,
    })),
    ownership: {
      titleEn: e.ownership.title, titleEs: s.ownership.title,
      descriptionEn: e.ownership.description, descriptionEs: s.ownership.description,
      whyTitleEn: e.ownership.whyTitle, whyTitleEs: s.ownership.whyTitle,
      benefits: e.ownership.benefits.map((b, i) => ({
        _type: "ownershipBenefit",
        _key: `benefit${i}`,
        labelEn: b.label, labelEs: s.ownership.benefits[i].label,
        textEn: b.text, textEs: s.ownership.benefits[i].text,
      })),
    },
    missionTitleEn: e.missionTitle, missionTitleEs: s.missionTitle,
    missionTextEn: e.missionText, missionTextEs: s.missionText,
    productsTitleEn: e.productsTitle, productsTitleEs: s.productsTitle,
    productFeaturesEn: e.productFeatures, productFeaturesEs: s.productFeatures,
  };
}

/* ───────── Document assembly ───────── */

function buildDocument() {
  return {
    _id: "iulPresentation",
    _type: "iulPresentation",
    title: "IUL Presentation",
    ui: {
      titleEn: en.title, titleEs: es.title,
      backButtonEn: en.backButton, backButtonEs: es.backButton,
      stepperPresentationEn: en.stepper.presentation, stepperPresentationEs: es.stepper.presentation,
      stepperApplicationEn: en.stepper.application, stepperApplicationEs: es.stepper.application,
      stepperReferralsEn: en.stepper.referrals, stepperReferralsEs: es.stepper.referrals,
      fullscreenEnterEn: en.fullscreen.enter, fullscreenEnterEs: es.fullscreen.enter,
      fullscreenExitEn: en.fullscreen.exit, fullscreenExitEs: es.fullscreen.exit,
      // Intake CTA strings were inline locale ternaries in page.tsx.
      intakeTitleEn: "Client data collection",
      intakeTitleEs: "Captura de datos del cliente",
      intakeDescriptionEn: "Start the secure form or send the client a link for the IUL application.",
      intakeDescriptionEs: "Inicie el formulario seguro o envíe un enlace al cliente para la solicitud IUL.",
      intakeButtonEn: "Collect client data",
      intakeButtonEs: "Capturar datos del cliente",
    },
    labels: {
      contributionLimitEn: en.labels.contributionLimit, contributionLimitEs: es.labels.contributionLimit,
      catchUpEn: en.labels.catchUp, catchUpEs: es.labels.catchUp,
      advantagesEn: en.labels.advantages, advantagesEs: es.labels.advantages,
      disadvantagesEn: en.labels.disadvantages, disadvantagesEs: es.labels.disadvantages,
      situationEn: en.labels.situation, situationEs: es.labels.situation,
      problemEn: en.labels.problem, problemEs: es.labels.problem,
      impactEn: en.labels.impact, impactEs: es.labels.impact,
      scenarioEn: en.labels.scenario, scenarioEs: es.labels.scenario,
      loanDetailsEn: en.labels.loanDetails, loanDetailsEs: es.labels.loanDetails,
      loanAmountEn: en.labels.loanAmount, loanAmountEs: es.labels.loanAmount,
      interestRateEn: en.labels.interestRate, interestRateEs: es.labels.interestRate,
      termEn: en.labels.term, termEs: es.labels.term,
      monthlyPaymentEn: en.labels.monthlyPayment, monthlyPaymentEs: es.labels.monthlyPayment,
      trueCostEn: en.labels.trueCost, trueCostEs: es.labels.trueCost,
      totalYoullPayEn: en.labels.totalYoullPay, totalYoullPayEs: es.labels.totalYoullPay,
      interestPaidToBankEn: en.labels.interestPaidToBank, interestPaidToBankEs: es.labels.interestPaidToBank,
      moneyNeverSeeAgainEn: en.labels.moneyNeverSeeAgain, moneyNeverSeeAgainEs: es.labels.moneyNeverSeeAgain,
      lifetimeInterestPaidEn: en.labels.lifetimeInterestPaid, lifetimeInterestPaidEs: es.labels.lifetimeInterestPaid,
      toBanksAndInstitutionsEn: en.labels.toBanksAndInstitutions, toBanksAndInstitutionsEs: es.labels.toBanksAndInstitutions,
      solutionExistsEn: en.labels.solutionExists, solutionExistsEs: es.labels.solutionExists,
    },
    meta: {
      titleEn: en.meta.title, titleEs: es.meta.title,
      descriptionEn: en.meta.description, descriptionEs: es.meta.description,
      keywordsEn: en.meta.keywords, keywordsEs: es.meta.keywords,
      imageEn: en.meta.image, imageEs: es.meta.image,
      imageAltEn: en.meta.imageAlt, imageAltEs: es.meta.imageAlt,
    },
    slides: [
      buildAgent(),
      buildDiscovery(),
      buildRetirementProduct("slide3", en.slides.slide3, es.slides.slide3, "product401k"),
      buildRetirementProduct("slide4", en.slides.slide4, es.slides.slide4, "productIra"),
      buildRetirementProduct("slide5", en.slides.slide5, es.slides.slide5, "productRothIra"),
      buildRetirementProduct("slide6", en.slides.slide6, es.slides.slide6, "productRoth401k"),
      buildRetirementProduct("slide7", en.slides.slide7, es.slides.slide7, "productSepIra"),
      buildScenario("slide8", en.slides.slide8, es.slides.slide8, "penalty", "scenarioPenalty"),
      buildScenario("slide9", en.slides.slide9, es.slides.slide9, "rmd", "scenarioRmd"),
      buildScenario("slide10", en.slides.slide10, es.slides.slide10, "market", "scenarioMarket"),
      buildScenario("slide11", en.slides.slide11, es.slides.slide11, "illness", "scenarioIllness"),
      buildBank(),
      buildBankExample("slide13", en.slides.slide13, es.slides.slide13),
      buildBankExample("slide14", en.slides.slide14, es.slides.slide14),
      buildBankCosts(),
      buildBankTeaser(),
      buildIulHero(),
      buildIulWho(),
      buildIulComparison(),
      buildIulStructure(),
      buildIulIndexing(),
      buildIulTerms(),
      buildIulNotInvested(),
      buildIulHowItWorks(),
      buildIulIllustrationCta(),
      buildCompany(),
    ],
  };
}

/* ───────── Main ───────── */

async function main() {
  if (!process.env.SANITY_API_WRITE_TOKEN) {
    throw new Error("SANITY_API_WRITE_TOKEN is not set in .env");
  }

  const force = process.argv.includes("--force");

  console.log("🚀 Seeding the IUL presentation document in Sanity...\n");
  console.log("📷 Uploading slide images...");
  await uploadImages();

  const doc = buildDocument();
  console.log(`\n📄 Document built with ${doc.slides.length} slides.`);

  if (force) {
    console.warn("⚠️  --force: replacing the existing document (Studio edits will be lost).");
    await client.createOrReplace(doc);
    console.log("✅ Document replaced.");
  } else {
    const result = await client.createIfNotExists(doc);
    if (result._createdAt === result._updatedAt) {
      console.log("✅ Document created.");
    } else {
      console.log("⏭️  Document already exists — left untouched (use --force to replace).");
    }
  }

  console.log("\n✨ Edit it in Studio: /studio/structure/iulPresentation");
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error("❌ Fatal error:", error instanceof Error ? error.message : error);
    process.exit(1);
  });
