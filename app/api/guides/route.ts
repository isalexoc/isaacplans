import { NextRequest, NextResponse } from "next/server";

// Mock data - Replace with database once dependencies are installed
const TEST_PDF_URL = 'https://res.cloudinary.com/isaacdev/image/upload/v1763440698/Compare_Health_Plans_-_Virginia_s_Insurance_Marketplace_Mariella_kqgszl.pdf';

const MOCK_GUIDES = [
  // ACA Guides (3)
  {
    id: 'aca-guide-1',
    category: 'aca',
    title: 'Compare Health Plans - Virginia Insurance Marketplace',
    title_es: 'Comparar Planes de Salud - Mercado de Seguros de Virginia',
    description: 'Complete guide to comparing and selecting the best ACA health insurance plan for your needs in Virginia.',
    description_es: 'Guía completa para comparar y seleccionar el mejor plan de seguro de salud ACA para sus necesidades en Virginia.',
    thumbnail: 'guide_aca_1',
    pdf_url: TEST_PDF_URL,
    order: 0,
    active: true,
  },
  {
    id: 'aca-guide-2',
    category: 'aca',
    title: 'Understanding ACA Plan Options',
    title_es: 'Entendiendo las Opciones de Planes ACA',
    description: 'Learn about different ACA plan tiers, coverage levels, and how to choose the right plan for your family.',
    description_es: 'Aprenda sobre los diferentes niveles de planes ACA, niveles de cobertura y cómo elegir el plan adecuado para su familia.',
    thumbnail: 'guide_aca_2',
    pdf_url: TEST_PDF_URL,
    order: 1,
    active: true,
  },
  {
    id: 'aca-guide-3',
    category: 'aca',
    title: 'ACA Enrollment Guide 2024',
    title_es: 'Guía de Inscripción ACA 2024',
    description: 'Step-by-step guide to enrolling in ACA health insurance, including deadlines and eligibility requirements.',
    description_es: 'Guía paso a paso para inscribirse en el seguro de salud ACA, incluyendo fechas límite y requisitos de elegibilidad.',
    thumbnail: 'guide_aca_3',
    pdf_url: TEST_PDF_URL,
    order: 2,
    active: true,
  },
  // Short Term Medical Guides (3)
  {
    id: 'shortterm-guide-1',
    category: 'shortTerm',
    title: 'Short Term Health Insurance Comparison Guide',
    title_es: 'Guía de Comparación de Seguro de Salud a Corto Plazo',
    description: 'Compare short-term medical insurance options and find the best temporary coverage for your situation.',
    description_es: 'Compare las opciones de seguro médico a corto plazo y encuentre la mejor cobertura temporal para su situación.',
    thumbnail: 'guide_stm_1',
    pdf_url: TEST_PDF_URL,
    order: 0,
    active: true,
  },
  {
    id: 'shortterm-guide-2',
    category: 'shortTerm',
    title: 'Understanding Short Term Medical Plans',
    title_es: 'Entendiendo los Planes Médicos a Corto Plazo',
    description: 'Learn when short-term medical insurance makes sense and what coverage options are available.',
    description_es: 'Aprenda cuándo tiene sentido el seguro médico a corto plazo y qué opciones de cobertura están disponibles.',
    thumbnail: 'guide_stm_2',
    pdf_url: TEST_PDF_URL,
    order: 1,
    active: true,
  },
  {
    id: 'shortterm-guide-3',
    category: 'shortTerm',
    title: 'Short Term Coverage Options',
    title_es: 'Opciones de Cobertura a Corto Plazo',
    description: 'Explore temporary health insurance solutions for gaps in coverage or transitional periods.',
    description_es: 'Explore soluciones de seguro de salud temporal para brechas en la cobertura o períodos de transición.',
    thumbnail: 'guide_stm_3',
    pdf_url: TEST_PDF_URL,
    order: 2,
    active: true,
  },
  // Dental & Vision Guides (3)
  {
    id: 'dentalvision-guide-1',
    category: 'dentalVision',
    title: 'Dental & Vision Insurance Guide',
    title_es: 'Guía de Seguro Dental y de Visión',
    description: 'Complete guide to dental and vision insurance plans, coverage options, and how to choose the right plan.',
    description_es: 'Guía completa de planes de seguro dental y de visión, opciones de cobertura y cómo elegir el plan adecuado.',
    thumbnail: 'guide_dv_1',
    pdf_url: TEST_PDF_URL,
    order: 0,
    active: true,
  },
  {
    id: 'dentalvision-guide-2',
    category: 'dentalVision',
    title: 'Comparing Dental & Vision Plans',
    title_es: 'Comparando Planes Dentales y de Visión',
    description: 'Learn how to compare dental and vision insurance plans and find the best coverage for your needs.',
    description_es: 'Aprenda cómo comparar planes de seguro dental y de visión y encuentre la mejor cobertura para sus necesidades.',
    thumbnail: 'guide_dv_2',
    pdf_url: TEST_PDF_URL,
    order: 1,
    active: true,
  },
  {
    id: 'dentalvision-guide-3',
    category: 'dentalVision',
    title: 'Dental & Vision Benefits Explained',
    title_es: 'Beneficios Dentales y de Visión Explicados',
    description: 'Understand what dental and vision insurance covers and how to maximize your benefits.',
    description_es: 'Entienda qué cubre el seguro dental y de visión y cómo maximizar sus beneficios.',
    thumbnail: 'guide_dv_3',
    pdf_url: TEST_PDF_URL,
    order: 2,
    active: true,
  },
  // Hospital Indemnity Guides (3)
  {
    id: 'hospitalindemnity-guide-1',
    category: 'hospitalIndemnity',
    title: 'Hospital Indemnity Insurance Guide',
    title_es: 'Guía de Seguro de Indemnización Hospitalaria',
    description: 'Learn about hospital indemnity insurance and how it can supplement your health coverage.',
    description_es: 'Aprenda sobre el seguro de indemnización hospitalaria y cómo puede complementar su cobertura de salud.',
    thumbnail: 'guide_hi_1',
    pdf_url: TEST_PDF_URL,
    order: 0,
    active: true,
  },
  {
    id: 'hospitalindemnity-guide-2',
    category: 'hospitalIndemnity',
    title: 'Understanding Hospital Indemnity Plans',
    title_es: 'Entendiendo los Planes de Indemnización Hospitalaria',
    description: 'Discover how hospital indemnity insurance works and when it makes sense for your situation.',
    description_es: 'Descubra cómo funciona el seguro de indemnización hospitalaria y cuándo tiene sentido para su situación.',
    thumbnail: 'guide_hi_2',
    pdf_url: TEST_PDF_URL,
    order: 1,
    active: true,
  },
  {
    id: 'hospitalindemnity-guide-3',
    category: 'hospitalIndemnity',
    title: 'Hospital Indemnity Coverage Options',
    title_es: 'Opciones de Cobertura de Indemnización Hospitalaria',
    description: 'Compare hospital indemnity insurance options and find the right plan for your needs.',
    description_es: 'Compare las opciones de seguro de indemnización hospitalaria y encuentre el plan adecuado para sus necesidades.',
    thumbnail: 'guide_hi_3',
    pdf_url: TEST_PDF_URL,
    order: 2,
    active: true,
  },
  // IUL Guides (3)
  {
    id: 'iul-guide-1',
    category: 'iul',
    title: 'Indexed Universal Life Insurance Guide',
    title_es: 'Guía de Seguro de Vida Universal Indexado',
    description: 'Complete guide to Indexed Universal Life (IUL) insurance and how it can help build wealth while providing protection.',
    description_es: 'Guía completa del seguro de vida universal indexado (IUL) y cómo puede ayudar a generar riqueza mientras proporciona protección.',
    thumbnail: 'guide_iul_1',
    pdf_url: TEST_PDF_URL,
    order: 0,
    active: true,
  },
  {
    id: 'iul-guide-2',
    category: 'iul',
    title: 'Understanding IUL Benefits',
    title_es: 'Entendiendo los Beneficios IUL',
    description: 'Learn about the unique benefits of Indexed Universal Life insurance and how it compares to other life insurance options.',
    description_es: 'Aprenda sobre los beneficios únicos del seguro de vida universal indexado y cómo se compara con otras opciones de seguro de vida.',
    thumbnail: 'guide_iul_2',
    pdf_url: TEST_PDF_URL,
    order: 1,
    active: true,
  },
  {
    id: 'iul-guide-3',
    category: 'iul',
    title: 'IUL Investment Strategy Guide',
    title_es: 'Guía de Estrategia de Inversión IUL',
    description: 'Discover how Indexed Universal Life insurance can be part of your long-term wealth-building strategy.',
    description_es: 'Descubra cómo el seguro de vida universal indexado puede ser parte de su estrategia de generación de riqueza a largo plazo.',
    thumbnail: 'guide_iul_3',
    pdf_url: TEST_PDF_URL,
    order: 2,
    active: true,
  },
  // Final Expense Guides (3)
  {
    id: 'finalexpense-guide-1',
    category: 'finalExpense',
    title: 'Final Expense Insurance Guide',
    title_es: 'Guía de Seguro de Gastos Finales',
    description: 'Complete guide to final expense (burial) insurance and how it can protect your family from financial burden.',
    description_es: 'Guía completa del seguro de gastos finales (funeral) y cómo puede proteger a su familia de la carga financiera.',
    thumbnail: 'guide_fe_1',
    pdf_url: TEST_PDF_URL,
    order: 0,
    active: true,
  },
  {
    id: 'finalexpense-guide-2',
    category: 'finalExpense',
    title: 'Understanding Final Expense Plans',
    title_es: 'Entendiendo los Planes de Gastos Finales',
    description: 'Learn about final expense insurance options and how to choose the right coverage amount for your needs.',
    description_es: 'Aprenda sobre las opciones de seguro de gastos finales y cómo elegir la cantidad de cobertura adecuada para sus necesidades.',
    thumbnail: 'guide_fe_2',
    pdf_url: TEST_PDF_URL,
    order: 1,
    active: true,
  },
  {
    id: 'finalexpense-guide-3',
    category: 'finalExpense',
    title: 'Final Expense Coverage Comparison',
    title_es: 'Comparación de Cobertura de Gastos Finales',
    description: 'Compare final expense insurance plans and find the best option to protect your loved ones.',
    description_es: 'Compare los planes de seguro de gastos finales y encuentre la mejor opción para proteger a sus seres queridos.',
    thumbnail: 'guide_fe_3',
    pdf_url: TEST_PDF_URL,
    order: 2,
    active: true,
  },
];

export async function GET(request: NextRequest) {
  try {
    // TODO: Uncomment once drizzle-orm is installed
    // const { db } = await import("@/lib/db");
    // const { guides } = await import("@/lib/db/schema");
    // const { eq, and } = await import("drizzle-orm");
    
    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get("category");
    const active = searchParams.get("active") !== "false";

    // Temporary: Use mock data until database is set up
    let result = MOCK_GUIDES.filter(g => active ? g.active : true);
    
    if (category) {
      result = result.filter(g => g.category === category);
    }

    // TODO: Replace with database query once dependencies are installed
    // let conditions = [];
    // if (category) {
    //   conditions.push(eq(guides.category, category));
    // }
    // if (active) {
    //   conditions.push(eq(guides.active, true));
    // }
    // const result = conditions.length > 0
    //   ? await db.select().from(guides).where(and(...conditions)).orderBy(guides.order)
    //   : await db.select().from(guides).orderBy(guides.order);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching guides:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

