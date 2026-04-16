import "dotenv/config";
import { createClient } from "next-sanity";

const client = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || "anetxoet",
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || "production",
  apiVersion: "2024-01-01",
  token: process.env.SANITY_API_WRITE_TOKEN,
  useCdn: false,
});

const finalExpensePostEs1 = {
  _type: "post",
  locale: "es",
  title: "Por qué el seguro de gastos finales puede proteger a tu familia de las deudas",
  slug: {
    _type: "slug",
    current: "por-que-el-seguro-de-gastos-finales-puede-proteger-a-tu-familia-de-las-deudas",
  },
  category: "final-expense",
  tags: [
    "seguro de gastos finales",
    "costos funerarios",
    "seguro de sepelio",
    "protección familiar",
    "planificación de fin de vida",
  ],
  featured: false,
  excerpt:
    "El seguro de gastos finales puede ayudar a proteger a tus seres queridos de costos funerarios, cuentas pendientes y estrés financiero repentino en un momento difícil.",
  body: [
    {
      _type: "block",
      style: "h1",
      children: [
        {
          _type: "span",
          text: "Por qué el seguro de gastos finales puede proteger a tu familia de deudas y estrés financiero",
          marks: [],
        },
      ],
      markDefs: [],
    },
    {
      _type: "block",
      style: "normal",
      children: [
        {
          _type: "span",
          text: "Perder a un ser querido ya es una de las experiencias más duras que una familia puede vivir. El dolor emocional por sí solo ya es bastante pesado. Pero para muchas familias, el duelo se vuelve aún más difícil cuando el dinero también se convierte en parte del problema.",
          marks: [],
        },
      ],
      markDefs: [],
    },
    {
      _type: "block",
      style: "normal",
      children: [
        {
          _type: "span",
          text: "Los costos del funeral, gastos de sepelio, transporte, flores, tarifas del cementerio y cuentas pendientes pueden aparecer todos al mismo tiempo. Cuando no hay un plan, los seres queridos suelen verse obligados a tomar decisiones financieras en uno de los peores momentos de sus vidas.",
          marks: [],
        },
      ],
      markDefs: [],
    },
    {
      _type: "block",
      style: "h2",
      children: [
        {
          _type: "span",
          text: "El problema que muchas familias no esperan",
          marks: [],
        },
      ],
      markDefs: [],
    },
    {
      _type: "block",
      style: "normal",
      children: [
        {
          _type: "span",
          text: "Muchas personas creen que su familia podrá resolverlo cuando llegue el momento. Otras asumen que sus ahorros serán suficientes. Algunas simplemente no saben lo caros que pueden ser los costos al final de la vida.",
          marks: [],
        },
      ],
      markDefs: [],
    },
    {
      _type: "block",
      style: "normal",
      children: [
        {
          _type: "span",
          text: "La realidad es que incluso un funeral sencillo puede costar miles de dólares. Si además sumas sepelio o cremación, servicios funerarios, transporte, flores, obituario y otros gastos relacionados, el total puede subir muy rápido.",
          marks: [],
        },
      ],
      markDefs: [],
    },
    {
      _type: "block",
      style: "h3",
      children: [
        {
          _type: "span",
          text: "Pagos de bolsillo",
          marks: [],
        },
      ],
      markDefs: [],
    },
    {
      _type: "block",
      style: "normal",
      children: [
        {
          _type: "span",
          text: "Un gasto repentino puede poner presión inmediata sobre los ahorros personales y las cuentas mensuales.",
          marks: [],
        },
      ],
      markDefs: [],
    },
    {
      _type: "block",
      style: "h3",
      children: [
        {
          _type: "span",
          text: "Deuda de tarjetas de crédito",
          marks: [],
        },
      ],
      markDefs: [],
    },
    {
      _type: "block",
      style: "normal",
      children: [
        {
          _type: "span",
          text: "Algunas familias recurren a tarjetas de crédito solo para cubrir costos funerarios y de sepelio urgentes.",
          marks: [],
        },
      ],
      markDefs: [],
    },
    {
      _type: "block",
      style: "h3",
      children: [
        {
          _type: "span",
          text: "Pedir ayuda a otros",
          marks: [],
        },
      ],
      markDefs: [],
    },
    {
      _type: "block",
      style: "normal",
      children: [
        {
          _type: "span",
          text: "A veces se les pide a familiares y amigos que contribuyan durante un momento muy emocional. En muchos casos, las familias incluso crean recaudaciones en línea solo para cubrir gastos funerarios básicos.",
          marks: [],
        },
      ],
      markDefs: [],
    },
    {
      _type: "block",
      style: "h2",
      children: [
        {
          _type: "span",
          text: "Cómo ayuda el seguro de gastos finales",
          marks: [],
        },
      ],
      markDefs: [],
    },
    {
      _type: "block",
      style: "normal",
      children: [
        {
          _type: "span",
          text: "El seguro de gastos finales está diseñado para ayudar a cubrir costos que llegan al final de la vida. Por lo general, es una póliza de vida más pequeña creada para brindar apoyo financiero cuando los seres queridos más lo necesitan.",
          marks: [],
        },
      ],
      markDefs: [],
    },
    {
      _type: "block",
      style: "normal",
      children: [
        {
          _type: "span",
          text: "En lugar de desesperarse para conseguir dinero, tu familia puede usar el beneficio para ayudar con costos funerarios, gastos de sepelio, cremación, tarifas del cementerio, deudas pequeñas, cuentas médicas o incluso viajes relacionados con los arreglos finales.",
          marks: [],
        },
      ],
      markDefs: [],
    },
    {
      _type: "block",
      style: "h2",
      children: [
        {
          _type: "span",
          text: "No se trata solo del funeral",
          marks: [],
        },
      ],
      markDefs: [],
    },
    {
      _type: "block",
      style: "normal",
      children: [
        {
          _type: "span",
          text: "Muchas personas escuchan 'seguro de gastos finales' y piensan solo en costos funerarios. Pero eso es solo una parte de la historia.",
          marks: [],
        },
      ],
      markDefs: [],
    },
    {
      _type: "block",
      style: "normal",
      children: [
        {
          _type: "span",
          text: "Los días después de una pérdida suelen traer muchos otros gastos y responsabilidades. La renta puede seguir venciendo. Los servicios no se detienen. Un cónyuge o un hijo puede necesitar tiempo fuera del trabajo. Familiares pueden necesitar viajar. Puede haber trámites, saldos pendientes y arreglos finales que requieren atención al mismo tiempo.",
          marks: [],
        },
      ],
      markDefs: [],
    },
    {
      _type: "block",
      style: "normal",
      children: [
        {
          _type: "span",
          text: "El seguro de gastos finales puede ayudar a reducir esa presión financiera en un momento en que tu familia ya está emocionalmente abrumada.",
          marks: [],
        },
      ],
      markDefs: [],
    },
    {
      _type: "block",
      style: "h2",
      children: [
        {
          _type: "span",
          text: "Un último regalo de amor",
          marks: [],
        },
      ],
      markDefs: [],
    },
    {
      _type: "block",
      style: "normal",
      children: [
        {
          _type: "span",
          text: "Para muchas personas, comprar un seguro de gastos finales no se trata realmente del dinero. Se trata de proteger a las personas que aman.",
          marks: [],
        },
      ],
      markDefs: [],
    },
    {
      _type: "block",
      style: "blockquote",
      children: [
        {
          _type: "span",
          text: "Me importaba lo suficiente como para prepararme.",
          marks: [],
        },
      ],
      markDefs: [],
    },
    {
      _type: "block",
      style: "h2",
      children: [
        {
          _type: "span",
          text: "Planificar con anticipación hace la diferencia",
          marks: [],
        },
      ],
      markDefs: [],
    },
    {
      _type: "block",
      style: "normal",
      children: [
        {
          _type: "span",
          text: "Esperar demasiado puede hacer que la cobertura sea más costosa, y los cambios de salud pueden reducir las opciones disponibles. Por eso, normalmente es mejor explorar el seguro de gastos finales más temprano que tarde.",
          marks: [],
        },
      ],
      markDefs: [],
    },
    {
      _type: "block",
      style: "normal",
      children: [
        {
          _type: "span",
          text: "No siempre necesitas una póliza enorme para marcar una diferencia real. Incluso una cobertura modesta puede quitarle una carga seria a tu familia. Lo más importante es tener algo establecido.",
          marks: [],
        },
      ],
      markDefs: [],
    },
    {
      _type: "block",
      style: "h2",
      children: [
        {
          _type: "span",
          text: "Reflexión final",
          marks: [],
        },
      ],
      markDefs: [],
    },
    {
      _type: "block",
      style: "normal",
      children: [
        {
          _type: "span",
          text: "A nadie le gusta pensar en gastos al final de la vida. No es un tema fácil. Pero evitar la conversación no hace que el costo desaparezca.",
          marks: [],
        },
      ],
      markDefs: [],
    },
    {
      _type: "block",
      style: "normal",
      children: [
        {
          _type: "span",
          text: "El seguro de gastos finales ayuda a las familias a prepararse para algo que eventualmente toca a todos los hogares. Puede aliviar el estrés financiero, reducir dificultades y proteger a los seres queridos de cargar con duelo y deuda al mismo tiempo.",
          marks: [],
        },
      ],
      markDefs: [],
    },
    {
      _type: "block",
      style: "normal",
      children: [
        {
          _type: "span",
          text: "Planificar con anticipación no se trata de miedo. Se trata de amor, dignidad y tranquilidad.",
          marks: [],
        },
      ],
      markDefs: [],
    },
  ],
  author: "Isaac Orraiz",
  readingTime: 4,
  seo: {
    metaTitle: "Cómo el seguro de gastos finales protege a las familias de deudas",
    metaDescription:
      "Descubre cómo el seguro de gastos finales puede ayudar a proteger a tu familia de costos funerarios, cuentas pendientes y estrés financiero después de una pérdida.",
    focusKeyword: "seguro de gastos finales",
    keywords: [
      "seguro de gastos finales",
      "seguro de sepelio",
      "seguro funerario",
      "costos funerarios",
      "proteger a la familia de deudas",
    ],
  },
  leadCapture: {
    enableCTA: true,
    ctaType: "consultation",
    ctaText: "Recibe ayuda para elegir cobertura de gastos finales",
    ctaPosition: "bottom",
  },
  publishedAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  status: "draft",
};

async function main() {
  if (!process.env.SANITY_API_WRITE_TOKEN) {
    throw new Error("SANITY_API_WRITE_TOKEN is not set in .env");
  }

  const created = await client.create(finalExpensePostEs1);
  console.log(`✅ Post created: ${created._id}`);
  console.log(`URL slug: /es/blog/${finalExpensePostEs1.slug.current}`);
}

main().catch((error: any) => {
  console.error("❌ Error creating post:", error.message);
  process.exit(1);
});

