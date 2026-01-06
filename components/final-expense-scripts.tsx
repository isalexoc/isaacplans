"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ScriptSection {
  title: string;
  titleEs: string;
  content: string;
  contentEs: string;
  tips?: string;
  tipsEs?: string;
}

const sections: Record<string, ScriptSection> = {
  opening: {
    title: "Opening & Introduction",
    titleEs: "Apertura e Introducción",
    content: `**TELEVISION COMMERCIAL OUTBOUND:**
Hello, Mr./Mrs. ___________, I'm ___________ from the Senior Care Plan, are you doing well today?
(Read and respond positively) You recently requested INFORMATION from our television commercial.
Were you looking for INFORMATION for yourself or for a loved one?

**MULTIPLE SOURCES OUTBOUND:**
Hello Mr./Mrs. ___________, I'm ___________, from the Senior Care Plan. Are you doing well today? (Read the response and respond positively). First of all, I'm not a telemarketer. You spoke with us recently about how to get information about final expense protection.
Is the information for you or for a loved one? ___________

**WEBSITE OUTBOUND:**
Hello Mr./Mrs. ___________, this is ___________, from the Senior Care Plan, are you doing well today? (read and Respond affirmatively) I'm not a telemarketer, you recently requested information ONLINE about plans that help cover the High cost of Funerals and Final Expenses. Will this information be for you or for a loved one?

**FACEBOOK OUTBOUND:**
Hello Mr./Mrs. ___________, I'm ___________, from the Senior Care Plan. Are you doing well today? (Read the response and respond positively). First of all, I'm not a telemarketer. You requested information about plans to help cover the high cost of funerals and final expenses the other day. Is the information for you or for a loved one? ___________

**TELEPHONE SURVEY OUTBOUND:**
Hello Mr./Mrs. ___________, I'm ___________, from the Senior Care Plan. Are you doing well today? (Read the response and respond positively). First of all, I'm not a telemarketer. You spoke with us the other day, and as you probably remember during your survey. We mentioned that Social Security only pays $255 when you pass away. There is beneficial information in your state that allows you other options to cover your final arrangements. Will this information be for you or for a loved one?

**INCOMING TRANSFERS:**
Hello Mr./Mrs. ___________, this is ___________. I'm the licensed agent for your state and I'll help you today.
Will this information be for you or for a loved one?`,
    contentEs: `**SALIENTE DE COMERCIAL DE TELEVISIÓN:**
Hola, Sr./Sra. ___________, soy ___________ del Plan de Cuidado para Personas Mayores, ¿te va bien hoy?
(Lea y responda positivamente) Recientemente solicitó INFORMACIÓN de nuestro comercial de televisión.
¿Estabas buscando INFORMACIÓN para ti o para un ser querido?

**SALIENTE DE MÚLTIPLES FUENTES:**
Hola Sr./Sra. ___________, soy ___________, del Plan de Cuidado para Personas Mayores. ¿Estás bien hoy? (Lea la respuesta y responda positivamente). En primer lugar, no soy un vendedor por teléfono. Habló con nosotros recientemente sobre cómo obtener información sobre la protección de gastos finales.
¿La información es para usted o para un ser querido? ___________

**SALIENTE DEL SITIO WEB:**
Hola Sr./Sra. ___________, habla ___________, del Plan de Cuidado para Personas Mayores, ¿estás bien hoy? (leer y Responder afirmativamente) No soy teleoperador, recientemente solicitaste información ONLINE sobre planes que ayudan a solventar el Alto costo de Funerales y Gastos Finales. ¿Esta información será para usted o para un ser querido?

**SALIENTE DE FACEBOOK:**
Hola Sr./Sra. ___________, soy ___________, del Plan de Cuidado para Personas Mayores. ¿Estás bien hoy? (Lea la respuesta y responda positivamente). En primer lugar, no soy un vendedor por teléfono. Solicitó información sobre planes para ayudar a cubrir el alto costo de los funerales y los gastos finales el otro día. ¿La información es para usted o para un ser querido? ___________

**SALIDA DE TELEENCUESTA:**
Hola Sr./Sra. ___________, soy ___________, del Plan de Cuidado para Personas Mayores. ¿Estás bien hoy? (Lea la respuesta y responda positivamente). En primer lugar, no soy un vendedor por teléfono. Habló con nosotros el otro día, y como probablemente recordará durante su encuesta. Mencionamos que el Seguro Social solo paga $255 cuando falleces. Hay información beneficiosa en su estado que le permite otras opciones para cubrir sus arreglos finales. ¿La información será para usted o para un ser querido?

**TRANSFERENCIAS ENTRANTES:**
Hola Sr./Sra. ___________, esto es ___________. Soy el agente con licencia de su estado y lo ayudaré hoy.
¿Esta información será para usted o para un ser querido?`,
    tips: `**KEY TIPS:**
• Always establish you're NOT a telemarketer immediately
• Use their name frequently to build rapport
• Respond positively to their initial greeting
• Confirm if it's for them or a loved one - this sets the tone
• Move to Step 2 (Warm-up) after confirming`,
    tipsEs: `**CONSEJOS CLAVE:**
• Siempre establezca que NO es un teleoperador inmediatamente
• Use su nombre con frecuencia para generar confianza
• Responda positivamente a su saludo inicial
• Confirme si es para ellos o para un ser querido - esto establece el tono
• Pase al Paso 2 (Calentamiento) después de confirmar`
  },
  discovery: {
    title: "Discovery Questions & Qualification",
    titleEs: "Preguntas de Descubrimiento y Calificación",
    content: `**STEP 1: GET INFORMATION IN 1 MINUTE**
I CAN GET YOU THAT INFORMATION IN JUST 1 MINUTE. I SEE YOU LIVE IN ___________?

**STEP 2: WARM-UP (1-2 MINUTES)**
Take 1-2 minutes of warm-up (WEATHER, WHERE THEY LIVE AND HOW LONG THEY'VE LIVED THERE, MARRIED, HOW LONG, CHILDREN, GRANDCHILDREN, FAMILY) END BY TALKING "ABOUT FAMILY..."

"Speaking of family...

What this plan is all about is taking care of your family and giving you a little peace of mind. First I'm going to see how many discounts I can get you, I'm going to try to get you as many as I can. I'll share with you the features and benefits of your plan, and then I'll go over a couple of different protection amounts so you can see which one is best to leave to your family. And if it's something I can help you with, all I do is an application that qualifies you. It only takes two minutes.

**QUALIFYING QUESTIONS:**
• What is your Date of Birth + City, State.
• When was the last time you were in the hospital?
  (Within what they remember) (2 times in the last 6 months)
  - If yes... talk about how that experience was for them with concern (ask questions)
  - If no... comment on how that's a blessing.
• Have you had any heart, liver, or lung problems like COPD or emphysema?
• And have you been treated for any cancer, stroke, or circulation or kidney problems? (In the last 3 years?)
• Do you smoke or use any tobacco or nicotine products? (In the last 12 months?)
• How tall are you and how much do you weigh?
• Are you currently taking any medications?
  - If so... can you do me a favor? Can you go get them, so I can make sure I get the right information to help you qualify?

**MEDICATIONS ENTRY:**
[List medications as they provide them]

Based on what you've told me so far, it looks like you can qualify for one of our best plans. That's really great!`,
    contentEs: `**PASO 1: CONSEGUIR INFORMACIÓN EN 1 MINUTO**
PUEDO CONSEGUIRTE ESA INFORMACIÓN EN SOLO 1 MINUTO. VEO QUE VIVES EN ___________?

**PASO 2: CALENTAMIENTO (1-2 MINUTOS)**
TOME 1-2 MINUTOS DE CALENTAMIENTO (CLIMA, DÓNDE VIVEN Y CUÁNTO TIEMPO HAN VIVIDO AHI, CASADOS, CUÁNTO TIEMPO, HIJOS, NIETOS, FAMILIA) TERMINE HABLANDO "DE FAMILIA..."

"Hablando de la familia...

De lo que se trata este plan es de cuidar a tu familia y darte un poco de tranquilidad. Primero voy a ver cuantos descuentos puedo conseguirte, voy a tratar de conseguirte tantos como pueda. Compartiré con usted las características y los beneficios de su plan, y luego repasaré un par de montos de protección diferentes para que pueda ver cuál es el mejor para dejarle a su familia. Y si es algo en lo que puedo ayudarte, todo lo que hago es una aplicación que te califica. Sólo toma dos minutos.

**PREGUNTAS CALIFICATIVAS:**
• Cuál es su Fecha de Nacimiento + Ciudad, Estado.
• ¿Cuándo fue la última vez que estuvo en el hospital?
  (Dentro lo que recuerda) (2 veces en los últimos 6 meses)
  - En caso afirmativo... hable sobre cómo fue esa experiencia para ellos con preocupación (haga preguntas)
  - Si no... comenta cómo eso es una bendición.
• ¿Ha tenido algún problema cardíaco, hepático o pulmonar como EPOC o enfisema?
• ¿Y ha sido tratado por algún cáncer, derrame cerebral o problemas de circulación o riñón? (¿En los últimos 3 años?)
• ¿Fuma o usa algún producto de tabaco o nicotina? (¿En los últimos 12 meses?)
• ¿Cuánto mides y cuánto pesas?
• ¿Actualmente está tomando algún medicamento?
  - Si es así... ¿puedes hacerme un favor? ¿Puedes ir a buscarlos, así puedo asegurarme de obtener la información correcta para ayudarte a calificar?

**INGRESO DE MEDICAMENTOS:**
[Liste los medicamentos según los proporcionen]

Basado en lo que me dijo hasta ahora, parece que puede calificar para uno de nuestros mejores planes. ¡Eso es realmente genial!`,
    tips: `**KEY TIPS:**
• Build rapport through warm-up conversation
• Always end warm-up talking about "family"
• Ask qualifying questions naturally in conversation
• If they need to get medications, have them do it - shows commitment
• Be positive when they qualify - "That's really great!"`,
    tipsEs: `**CONSEJOS CLAVE:**
• Genere confianza a través de la conversación de calentamiento
• Siempre termine el calentamiento hablando de "familia"
• Haga preguntas calificativas de forma natural en la conversación
• Si necesitan obtener medicamentos, que lo hagan - muestra compromiso
• Sea positivo cuando califiquen - "¡Eso es realmente genial!"`
  },
  presentation: {
    title: "Product Presentation",
    titleEs: "Presentación del Producto",
    content: `**NOW, I'm sure you can agree with me that...**

Everyone's needs are different, (pause)

BUT what I've discovered is that no matter who I'm talking to... one thing we all have in common is... we all want to take care of our family (pause)

I'm sure you're like many of my other clients. You just want to make sure you have some protection for your family, when they need it most, AND that's right when God finally decides to call you home. Right? (pause)

**THE PROBLEM today is the High Cost of Funerals.**

I'm not sure how much they cost in your area, but the average cost of a funeral today nationwide is between 7 and 12 thousand dollars!

They've really gone up quite a bit over the years, haven't they?

You know something I hear a lot about, are those families that end up having to come up with all kinds of ways to pay for this, when a loved one passes away with nothing or not enough. (i.e., offering plate, Loans, Go Funds, ETC)

Obviously, it says a lot about yourself that you don't want to put your family or anyone through that. And I'd like to congratulate you for taking care of this!

**MOST people will respond with a "thank you."** This is a good way to know if they're listening. If you get Crickets... keep moving forward, but be aware you may get objections at closing.

**LEGACY ASSURANCE:**

That said: we'll help you be prepared by providing you with your policy a memorial guide.

This plan will help you with pre-planning your funeral and any last wishes you may have. You'll be able to write down all the wishes and desires you'd want for your funeral service.

Things like songs to sing, casket selection, pallbearers, obituary writing or maybe even a favorite scripture to read during your service. Just about everything.

Mr. Mrs. _____, have you ever lost a loved one before / like a family member or a loved one? Respond accordingly. "Oh, I'm so sorry" ... ETC.

Well, you've seen firsthand how helpful a memorial guide can be for your family by having all those things arranged in advance.

Do you plan to have a traditional burial or cremation or have you thought about that?

Answer this question. Let's go back to the cost of whichever they mention.

**Another benefit that comes with your policy is through Legacy Assurance.**

What Legacy does for you and your family is provide certain funeral items along with your policy at a fraction of what they cost at the funeral home. Your family can save thousands of dollars on the cost of the funeral, whether it's a cremation or traditional. This is a revocable item, so your family doesn't have to use it. Items like the casket, vault, headstone, monument or marker are locked in at reduced prices.

So, not only will you save thousands today, but you'll save even more in 10, 20, or 30 years. I'll send you a brochure about that.

**Let me go over the other features and benefits of your plan:**

• Your policy is a permanent whole life plan, which means you have guaranteed protection for the rest of your life.
• Your premium, which I'm going to go over with you in a second, will never increase and your Benefits will never decrease.
• (Premier or Classic) Your policy has Day One coverage or Immediate Benefits. That means THERE IS NO WAITING PERIOD.
• If you pass away from an accidental death, your policy will pay double the amount. Double indemnity
• We don't do any medical exam to qualify you, we just ask you some Yes or No questions. And I can do it right over the phone, it's that easy to qualify.
• Your policy builds cash value every year that you have access to at any time.

**Most importantly, we pay our clients' claims in 24 hours!**

Do you know why we pay our claims so fast?

Most people know it's because the family needs it immediately... So say "that's exactly right"!

If they "don't know" ... Tell them!
• Funerals ask for $$ upfront.
• It's not something you can just put off.`,
    contentEs: `**AHORA, estoy seguro de que puedes estar de acuerdo conmigo en que...**

Las necesidades de todos son diferentes, (pausa)

PERO lo que descubrí es que no importa con quién esté hablando... una cosa que todos tenemos en común es... todos queremos cuidar de nuestra familia (pausa)

Estoy seguro de que eres como muchos de mis otros clientes. Solo quiere asegurarse de tener alguna protección para su familia, cuándo más la necesitan, Y es justo cuando Dios finalmente decide llamarlo a casa. ¿No es así? (pausa)

**El PROBLEMA hoy es el Alto Costo de los Funerales.**

No estoy seguro de cuánto cuestan en su área, ¡pero el costo promedio de un funeral hoy en día a nivel nacional es entre 7 y 12 mil dólares!

**Realmente han subido bastante a lo largo de los años, ¿no es así?**

Sabes algo de lo que escucho mucho, son esas familias que terminan teniendo que idear todo tipo de formas de pagar esto, cuando un ser querido fallece sin nada o sin lo suficiente. (Es decir, placa de oferta, Préstamos, Go Funds, ETC)

Obviamente, dice mucho sobre ti mismo que no quieres hacer pasar a tu familia ni a nadie por eso. ¡Y me gustaría felicitarlo por encargarse de esto!

**LA MAYORÍA de la gente responderá con un "gracias".** Es una buena manera de saber si están escuchando. Si obtiene Crickets... siga avanzando, pero tenga en cuenta que puede obtener objeciones al cierre.

**LEGACY ASSURANCE:**

Dicho esto: lo ayudaremos a estar preparado brindándole con su póliza una guía conmemorativa.

Este plan lo ayudará con la planificación previa de su funeral y cualquier último deseo que pueda tener. Podrás anotar todos los deseos y anhelos que quisieras para tu servicio funerario.

Cosas como canciones para cantar, selección de ataúdes, portadores del féretro, redacción de obituarios o tal vez incluso una escritura favorita para leer durante su servicio. Sólo acerca de todo.

Sr. Sra._____, ¿alguna vez ha perdido a un ser querido antes / como un miembro de la familia o un ser querido? Responde en consecuencia. "Oh, lo siento mucho" ... ETC.

Bueno, usted ha visto de primera mano lo útil que puede ser una guía conmemorativa para su familia al tener todas esas cosas arregladas con anticipación.

¿Planea tener un entierro o cremación tradicional o ha pensado en eso?

Responda a esta pregunta. Volvamos al costo de cualquiera que mencionen.

**Otro beneficio que viene con su póliza es a través de Legacy Assurance.**

Lo que Legacy hace por usted y su familia es proporcionar ciertos artículos funerarios junto con su póliza a una fracción de lo que cuestan en la funeraria. Su familia puede ahorrar miles de dólares en el costo del funeral, ya sea una cremación o tradicional. Este es un artículo revocable, por lo que su familia no tiene que usarlo. Los artículos como el ataúd, la bóveda, la lápida, el monumento o la lápida están bloqueados a precios reducidos.

Entonces, no solo ahorrará miles hoy, sino que ahorrará aún más dentro de 10, 20 o 30 años. Te enviaré un folleto sobre eso.

**Permítanme repasar las otras características y beneficios de su plan:**

• Su póliza es un plan permanente de vida entera, lo que significa que tiene protección garantizada por el resto de su vida.
• Su prima, que voy a repasar con usted en un segundo, nunca aumentará y sus Beneficios nunca disminuirán.
• (Premier o Classic) Su póliza tiene cobertura de Día Uno o Beneficios Inmediatos. Eso significa que NO HAY PERÍODO DE ESPERA.
• Si fallece por una muerte accidental, su póliza pagará el doble de la cantidad. Doble indemnización
• No hacemos ningún examen médico para calificarlo, solo le hacemos algunas preguntas de Sí o No. Y puedo hacerlo directamente por teléfono, es así de fácil calificar.
• Su póliza genera valor en efectivo cada año al que tiene acceso en cualquier momento.

**¡Lo más importante es que pagamos las reclamaciones de nuestros clientes en 24 horas!**

¿Sabe por qué pagamos nuestras reclamaciones tan rápido?

La mayoría de la gente lo sabe porque la familia lo necesita de inmediato... ¡Así que diga "eso es exactamente correcto"!

Si ellos "no saben" ... ¡Diles!
• Funerales pide $$ por adelantado.
• No es algo que simplemente puedas posponer.`,
    tips: `**KEY TIPS:**
• SLOW DOWN during presentation - this is critical
• Use pauses effectively - let them process
• Connect emotionally with "taking care of family"
• Use the $7,000-$12,000 funeral cost statistic
• Most will say "thank you" - shows they're listening
• If silence (crickets), they may object at closing - be prepared
• Emphasize 24-hour claim payment - this is HUGE`,
    tipsEs: `**CONSEJOS CLAVE:**
• VAYA MÁS DESPACIO durante la presentación - esto es crítico
• Use pausas efectivamente - déjelos procesar
• Conecte emocionalmente con "cuidar de la familia"
• Use la estadística de costo de funeral de $7,000-$12,000
• La mayoría dirá "gracias" - muestra que están escuchando
• Si silencio (grillos), pueden objetar al cierre - esté preparado
• Enfatice el pago de reclamos en 24 horas - esto es ENORME`
  },
  closing: {
    title: "Closing - Three Options",
    titleEs: "Cierre - Tres Opciones",
    content: `**CHOICE CLOSE!**

Mr./Mrs. __________, keeping affordability in mind, I'm going to show you 3 different plans. Now you can always add more coverage later, whether it's within 2 weeks or 2 years. You simply don't want to be one of those individuals who die and there's nothing. Something is better than nothing.

**1st plan $50-75**
**2nd plan $75-99**
**3rd plan $100-150**

*The first plan I'm going to share with you is _______ in natural protection that also pays _______ in Accidental protection, the monthly enrollment is only _______, which stays the same and never increases.

If it's Day One coverage (Super, Preferred and Standard), get immediate benefits with absolutely no waiting period. Also, if they want a traditional funeral, highlight that the casket, vault and headstone are included through the Legacy program.

*The second plan I'm going to share with you is _______ in natural protection that pays _______ in Accidental protection also, the monthly enrollment is only _______ which stays the same and never goes up

*The third plan I'm going to share with you is _______ in natural protection that pays _______ in Accidental protection also, the monthly enrollment is only _______ which stays the same and never goes up

While you're looking at them, let me get a little more information. I have your mailing address as _______ OR What's a good mailing address? (Write this down for INSURED PAGE later)

Mr./Mrs. _______ Whenever I can qualify you, who would you like to leave as your beneficiary to receive these benefits when you pass away? And that's your _______?

**Now, Mr./Mrs. _______ of those three plans I've shown you, which one do you want me to qualify you for to leave to _______ your _______ when you pass away?**

**THIS IS THE CLOSE!** This is where they choose a plan or give an objection, so be prepared for the objection and move forward. Always returning to the Close. AS SOON AS THEY SELECT A PLAN... go to Step 5`,
    contentEs: `**¡ELECCIÓN CERRADA!**

Sr./Sra. __________, teniendo en cuenta la asequibilidad, le mostraré 3 planes diferentes. Ahora siempre puede agregar más cobertura más adelante, ya sea dentro de 2 semanas o 2 años. Simplemente no quieres ser uno de esos individuos que mueren y no hay nada. Algo es mejor que nada.

**1° plan $50-75**
**2° plan $75-99**
**3° plan $100-150**

*El primer plan que voy a compartir con usted _______ en protección de la naturaleza que también paga _______ en protección Accidental, la inscripción mensual es solo _______, que se mantiene igual y nunca aumenta.

Si se trata de la cobertura del primer día (Super, Preferred y Standard), obtenga beneficios inmediatos sin absolutamente ningún período de espera. Además, si quieren un funeral tradicional, resalten que el ataúd, la bóveda y la lápida están incluidos a través del programa Legacy.

*El segundo plan que voy a compartir con ustedes es _______ en protección natural que paga _______ en protección Accidental también, la inscripción mensual es solo _______ que se mantiene igual y nunca sube

*El tercer plan que voy a compartir con ustedes es _______ en protección natural que paga _______ en protección Accidental también, la inscripción mensual es solo _______ que se mantiene igual y nunca sube

Mientras los miras, déjame obtener un poco más de información. Tengo su dirección postal como _______ O ¿Cuál es una buena dirección postal? (Anote esto para PÁGINA ASEGURADA más adelante)

Sr./Sra. _______ Siempre que pueda calificarlo, ¿a quién le gustaría dejar como su beneficiario para recibir estos beneficios cuando fallezca? ¿Y ese es tu _______?

**Ahora, Sr./Sra. _______ de esos tres planes que le he mostrado, ¿cuál quiere que lo califique para dejar a _______ su _______ cuando fallezca?**

**¡ESTO ES EL CIERRE!** Es donde eligen un plan o dan una objeción, así que prepárate para la objeción y sigue adelante. Siempre volviendo al Cierre. TAN PRONTO COMO SELECCIONEN UN PLAN...vaya al Paso 5`,
    tips: `**KEY TIPS:**
• Always present 3 options - gives them choice
• Price ranges: $50-75, $75-99, $100-150
• Get beneficiary information while they're thinking
• "Something is better than nothing" - powerful phrase
• AS SOON AS they select - move to application (Step 5)
• If objection - handle it, then return to close`,
    tipsEs: `**CONSEJOS CLAVE:**
• Siempre presente 3 opciones - les da elección
• Rangos de precio: $50-75, $75-99, $100-150
• Obtenga información del beneficiario mientras piensan
• "Algo es mejor que nada" - frase poderosa
• TAN PRONTO COMO seleccionen - pase a la aplicación (Paso 5)
• Si objeción - manéjela, luego regrese al cierre`
  },
  objections: {
    title: "Objection Handling",
    titleEs: "Manejo de Objeciones",
    content: `**COMMON OBJECTIONS & RESPONSES:**

**"Can't you just send me something in the mail?"**
Absolutely! I'd be happy to send something in the mail and I will once we know what plan you qualify for. I'm a licensed agent for the state of ___ and an insurer, so what I do is find out what you qualify for so we can give you the best plan. How's your health today, Mr./Mrs. ___?

Yes, Mrs. Jones, that's what I'm working on, however, our plans aren't one-size-fits-all, where you pick an amount and send a money order and hope to be covered. Our goal is to qualify you for one of our Day One coverages and, to do that, we just ask you some simple yes or no's, a description of your height and weight and the names of the medications you take. That's it, no health exam. I can tell you, down to the last penny, in a matter of a couple of minutes exactly how you qualify. You sound healthy to me, tell me something in the last 10 years, have you been hospitalized 2 or more times? Go straight to application.

**"Can you call me back?"**
Yes, ma'am/sir, I certainly can. I know you're obviously a busy person with little time. That's why it only takes me 3 minutes to find out what you qualify for, so I can get you the information you requested. I know how important this is to you. When was the last time you were in a hospital?

**"I didn't call or don't remember calling."**
I understand that maybe you don't remember. I'm not a telemarketer, so let me make sure we have the right information. Your birthday is ___? Perfect, at some point you requested information using your date of birth. Were you looking for this information for yourself or for a loved one?

**"I already have life insurance."**
Great. We hope most people have life insurance. That tells me you love your family.
What you called about was the high cost of dying. As you well know, funeral and final expense costs are higher than ever. That's why it's so important to have a program like this to take care of your final expenses. That way, you can leave your life insurance for your family to continue living and not have to use it for your funeral expenses. How's your health these days?

**"I'm not interested / I changed my mind."**
Mr./Mrs. ___ I can understand that most people aren't interested in thinking about death. However, that doesn't change the fact that we're all going to die someday. Let me ask you this: Do you want your family to face the burden of paying your final expenses? ... Of course not. How's your health?

**"I can't afford it."**
I totally understand Mr./Mrs. ___. Let me share this with you. When death occurs there are two sacrifices that have to be made: emotional and economic. Only God and time can take care of the emotional side of losing a loved one. However, we must take care of the financial part. ___, it's much easier to take care of this little by little instead of leaving it ALL to our loved ones. I'm sure you don't want them burdened with your final expenses, right? Of course not because you love them. (Back to application.)

Mr./Mrs. ___, I understand how you feel. I know that when you have a limited income it's difficult, but most of the people we talk to live on a fixed income. What we must realize and understand is that death is something that is certain. There are no buts about it. There comes a time when we must take care of the inevitable. Mr./Mrs. ___, who would you like to be your beneficiary when you pass away? (Back to application)

**"I want to talk to my children first / my children make all my decisions:"**
Mr./Mrs. ___ if I were in your place, I'd probably want to talk to my children too. However, let me share with you that your children will probably tell you that they'll take care of it. However, what you're probably not thinking about is that they don't want to think about your death or want to talk about it. We also have to realize that it's not our children's responsibility. They have to take care of their own families. It's our responsibility to take that burden off our children. And I know from talking to you, Mr./Mrs. ___, you don't want your children to be burdened tomorrow With something you can take care of today, right? Of course not because you love them.
(Back to application.)

**"I want to think about it."**
Mr./Mrs. ___ I understand. However, thinking about taking care of our family isn't really a luxury we have. None of us, not even me, are promised tomorrow. Mr./Mrs. ___, if everyone Knew when they would pass, they'd call me the day before and take care of this. The truth is "thinking about it" becomes "thinking about it" which then becomes "too late" And you pass without coverage. There are families at the funeral home right now wondering "how the hell am I going to pay for this?" And their loved ones were "thinking" about protecting them, but never did. Mr./Mrs. ___, You don't want your family to be in that situation, right? Of course not because you love them. So, of those 3 amounts I shared with you, which one do you want me to qualify you for to leave when you pass away? (Back to application.)`,
    contentEs: `**OBJECIONES COMUNES Y RESPUESTAS:**

**"¿No puedes enviarme algo por correo?"**
¡Absolutamente! Estaré encantado de enviar algo por correo y lo haré una vez que sepamos para qué plan califica. Soy un agente con licencia para el estado de ___ y un asegurador, así que lo que hago es averiguar para qué califica para que podamos brindarle el mejor plan. ¿Cómo está su salud hoy, Sr./Sra. ___?

Sí, Sra. Jones, eso es en lo que estoy trabajando, sin embargo, nuestros planes no son de talla única, en los que elige una cantidad y envía un giro postal y espera estar cubierto. Nuestro objetivo es calificarlo para una de nuestras coberturas del primer día y, para ello, solo le pedimos unos simples sí o no, una descripción de su altura y peso y los nombres de los medicamentos que toma. Eso es todo, sin examen de salud. Puedo decirte, hasta el último centavo, en cuestión de un par de minutos exactamente cómo calificas. Me suenas saludable, dime algo en los últimos 10 años, ¿has sido hospitalizado 2 o más veces? Directo a la aplicación.

**"¿Puedes llamarme de vuelta?"**
Sí, señora/señor, ciertamente puedo. Sé que obviamente eres una persona ocupada y con poco tiempo. Es por eso que solo me toma 3 minutos averiguar para qué calificas, para que pueda obtener la información que solicitaste. Sé lo importante que es esto para ti. ¿Cuándo fue la última vez que estuvo en un hospital?

**"No llamé ni recuerdo haber llamado."**
Entiendo que tal vez no lo recuerdes. No soy un vendedor telefónico, así que permítanme asegurarme de que tenemos la información correcta. Tu cumpleaños es ___? Perfecto, en algún momento solicitaste información usando tu fecha de nacimiento. ¿Buscabas esta información para ti o para un ser querido?

**"Ya obtuve un seguro de vida."**
Genial. Esperamos que la mayoría de las personas tengan un seguro de vida. Eso me dice que amas a tu familia.
Lo que usted llamó fue el alto costo de morir. Como bien sabes, los costos de funeral y gastos finales son más altos que nunca. Por eso es tan importante contar con un programa como este para hacerse cargo de los gastos finales. De esta manera, puede dejar su seguro de vida para su familia y no tener que usarlo para sus gastos funerarios. ¿Cómo está tu salud estos días?

**"No me interesa/cambié de opinión."**
Sr./Sra. ___ Puedo entender que a la mayoría de la gente no le interese pensar en la muerte. Sin embargo, eso no cambia el hecho de que todos vamos a morir algún día. Déjame preguntarte esto: ¿Quieres que tu familia se enfrente a la carga de pagar tus gastos finales? ... Claro que no. ¿Cómo está tu salud?

**"No me lo puedo permitir."**
Entiendo totalmente al Sr./Sra. ___. Permítanme compartir esto con ustedes. Cuando la muerte ocurre allí son dos sacrificios que hay que hacer: emocional y económico. Solo Dios y el tiempo pueden encargarse del lado emocional de la pérdida de un ser querido. Sin embargo, debemos ocuparnos de la parte financiera. ___, es mucho más fácil ocuparse de esto poco a poco en lugar de dejarlo TODO a nuestros seres queridos. Estoy seguro de que no quieres que se carguen con tus gastos finales, ¿verdad? Por supuesto, no porque los ames. (Volver a la aplicación.)

Sr./Sra. ___, entiendo que te sientas así. Sé que cuando tienes un ingreso limitado es difícil, pero la mayoría de las personas con las que hablamos viven con un ingreso fijo. Lo que debemos darnos cuenta y entender es que la muerte es algo que es seguro. No hay peros al respecto. Llega un momento en el que debemos ocuparnos de lo inevitable. Sr./Sra. ___, ¿quién le gustaría que fuera su beneficiario cuando usted fallezca? (Volver a la aplicación)

**"Quiero hablar primero con mis hijos / mis hijos toman todas mis decisiones:"**
Sr./Sra. ___ si yo estuviera en tu lugar, probablemente también querría hablar con mis hijos. Sin embargo, déjame compartir contigo que tus hijos probablemente te dirán que ellos se encargarán de ello. Sin embargo, lo que probablemente no estés pensando es que no quieren pensar en tu muerte ni quieren hablar de ello. También tenemos que darnos cuenta de que no es responsabilidad de nuestros hijos. Tienen que cuidar de sus propias familias. Es nuestra responsabilidad quitarles esa carga a nuestros hijos. Y sé por hablar con usted, Sr./Sra. ___, no quieres que tus hijos sean agobiados mañana Con algo de lo que puedes ocuparte hoy, ¿verdad? Por supuesto que no porque los ames. (Volver a la aplicación.)

**"Quiero pensarlo."**
Sr./Sra. ___ Entiendo. Sin embargo, pensar en cuidar de nuestra familia no es realmente un lujo que tengamos. A ninguno de nosotros, ni siquiera a mí, se nos promete el mañana. Sr./Sra. ___, si todo el mundo Supiera cuándo pasarían, me llamarían el día anterior y se encargarían de esto. La verdad es que "pensar en ello" se convierte en "pensar en ello" que luego se convierte en "demasiado tarde" Y pasas sin cobertura. Hay familias en la funeraria en este momento preguntándose "¿cómo diablos voy a pagar por esto?" Y sus seres queridos estaban "pensando" en protegerlos, pero nunca lo hicieron. Sr./Sra. ___, No quieres que tu familia esté en esa situación, ¿verdad? Claro que no porque los ames. Entonces, de esas 3 cantidades que compartí contigo, ¿para cuál quieres que califique para irte cuando falleces? (Volver a la aplicación.)`,
    tips: `**KEY TIPS:**
• Always acknowledge the objection - "I understand..."
• Use "A-T-L-B" method: Agree, Tell the truth, Loaded question, Back to application
• Never argue - always redirect
• Use emotional appeals - "because you love them"
• Always return to the application after handling objection
• Most objections are actually buying signals`,
    tipsEs: `**CONSEJOS CLAVE:**
• Siempre reconozca la objeción - "Entiendo..."
• Use el método "A-T-L-B": De acuerdo, Di la verdad, Pregunta cargada, Volver a la aplicación
• Nunca discuta - siempre redirija
• Use apelaciones emocionales - "porque los amas"
• Siempre regrese a la aplicación después de manejar la objeción
• La mayoría de las objeciones son en realidad señales de compra`
  },
  psychology: {
    title: "Psychology & Sales Tips",
    titleEs: "Psicología y Consejos de Ventas",
    content: `**ADVANCED PHONE SALES PSYCHOLOGY:**

**1. BUILDING RAPPORT:**
• Use their name frequently (every 2-3 sentences)
• Mirror their energy level and speaking pace
• Find common ground in warm-up conversation
• Show genuine interest in their family

**2. CREATING URGENCY:**
• "None of us are promised tomorrow"
• "Today is the only day we know for certain"
• Funeral costs are rising 227% (use statistics)
• Social Security only pays $255

**3. EMOTIONAL TRIGGERS:**
• Family protection - strongest emotional driver
• Not burdening loved ones
• Peace of mind
• Being responsible vs. irresponsible

**4. PAUSE STRATEGY:**
• After asking important questions - PAUSE
• After presenting key benefits - PAUSE
• Let silence work for you - they'll fill it
• Don't rush - slow down during presentation

**5. ASSUMING THE SALE:**
• "When I can qualify you..." (not "if")
• "Your policy will..." (not "would")
• "Your beneficiary will receive..." (assume they're buying)
• Get beneficiary info during close (shows confidence)

**6. HANDLING SILENCE:**
• If they're quiet after presentation - they're processing
• If quiet after close - they may be deciding
• Don't fill every silence - let them think
• If too long, ask: "What questions do you have?"

**7. VOICE TONE & ENERGY:**
• Match their energy (if low, bring them up gradually)
• Sound confident, not pushy
• Show enthusiasm for helping them
• Smile while talking (they can hear it)

**8. CLOSING PSYCHOLOGY:**
• Give them 3 choices (not 1 or 2)
• "Something is better than nothing" - removes perfectionism
• Get commitment on beneficiary first (psychological commitment)
• Once they choose a plan, immediately move to application

**9. OBJECTION PSYCHOLOGY:**
• Most objections = buying signals
• "I need to think" = "I want it but need reassurance"
• "I can't afford it" = "Show me the value"
• "Talk to family" = "I'm interested but need validation"

**10. FINAL TIPS:**
• Record yourself and listen back
• Practice the script until it's natural
• Know your product inside and out
• Believe in what you're selling
• Every "no" gets you closer to "yes"`,
    contentEs: `**PSICOLOGÍA AVANZADA DE VENTAS POR TELÉFONO:**

**1. CONSTRUIR CONFIANZA:**
• Use su nombre con frecuencia (cada 2-3 oraciones)
• Refleje su nivel de energía y ritmo de habla
• Encuentre puntos en común en la conversación de calentamiento
• Muestre interés genuino en su familia

**2. CREAR URGENCIA:**
• "A ninguno de nosotros se nos promete el mañana"
• "Hoy es el único día que sabemos con certeza"
• Los costos funerarios están aumentando 227% (use estadísticas)
• El Seguro Social solo paga $255

**3. DESENCADENANTES EMOCIONALES:**
• Protección familiar - el impulsor emocional más fuerte
• No cargar a los seres queridos
• Tranquilidad
• Ser responsable vs. irresponsable

**4. ESTRATEGIA DE PAUSA:**
• Después de hacer preguntas importantes - PAUSA
• Después de presentar beneficios clave - PAUSA
• Deje que el silencio trabaje para usted - lo llenarán
• No se apresure - vaya más despacio durante la presentación

**5. ASUMIR LA VENTA:**
• "Cuando pueda calificarlo..." (no "si")
• "Su póliza..." (no "sería")
• "Su beneficiario recibirá..." (asuma que están comprando)
• Obtenga información del beneficiario durante el cierre (muestra confianza)

**6. MANEJAR EL SILENCIO:**
• Si están callados después de la presentación - están procesando
• Si callado después del cierre - pueden estar decidiendo
• No llene cada silencio - déjelos pensar
• Si es demasiado largo, pregunte: "¿Qué preguntas tiene?"

**7. TONO DE VOZ Y ENERGÍA:**
• Coincida con su energía (si es baja, súbala gradualmente)
• Suene confiado, no insistente
• Muestre entusiasmo por ayudarlos
• Sonría mientras habla (pueden oírlo)

**8. PSICOLOGÍA DE CIERRE:**
• Déles 3 opciones (no 1 o 2)
• "Algo es mejor que nada" - elimina el perfeccionismo
• Obtenga compromiso en beneficiario primero (compromiso psicológico)
• Una vez que elijan un plan, inmediatamente pase a la aplicación

**9. PSICOLOGÍA DE OBJECIÓN:**
• La mayoría de las objeciones = señales de compra
• "Necesito pensarlo" = "Lo quiero pero necesito tranquilidad"
• "No puedo pagarlo" = "Muéstrame el valor"
• "Hablar con la familia" = "Estoy interesado pero necesito validación"

**10. CONSEJOS FINALES:**
• Grábese y escuche de nuevo
• Practique el guión hasta que sea natural
• Conozca su producto de adentro hacia afuera
• Crea en lo que está vendiendo
• Cada "no" te acerca más al "sí"`,
    tips: `**KEY TIPS:**
• Psychology is 80% of sales success
• People buy on emotion, justify with logic
• Your confidence creates their confidence
• Practice until the script becomes second nature
• Every call is a learning opportunity`,
    tipsEs: `**CONSEJOS CLAVE:**
• La psicología es el 80% del éxito en ventas
• La gente compra por emoción, justifica con lógica
• Su confianza crea su confianza
• Practique hasta que el guión se convierta en segunda naturaleza
• Cada llamada es una oportunidad de aprendizaje`
  }
};

export default function FinalExpenseScripts() {
  const [language, setLanguage] = useState<"en" | "es">("en");
  const [expandedSection, setExpandedSection] = useState<string | null>("opening");

  const toggleSection = (sectionKey: string) => {
    setExpandedSection(expandedSection === sectionKey ? null : sectionKey);
  };

  const formatContent = (text: string) => {
    return text.split('\n').map((line, idx) => {
      if (line.startsWith('**') && line.endsWith('**')) {
        return <strong key={idx} className="font-bold text-foreground">{line.replace(/\*\*/g, '')}</strong>;
      }
      if (line.trim() === '') {
        return <br key={idx} />;
      }
      return <p key={idx} className="mb-2">{line}</p>;
    });
  };

  return (
    <div className="w-full space-y-4">
      {/* Language Toggle */}
      <div className="flex items-center justify-end gap-2 mb-4">
        <Languages className="h-4 w-4 text-muted-foreground" />
        <div className="flex gap-1 bg-muted rounded-lg p-1">
          <Button
            variant={language === "en" ? "default" : "ghost"}
            size="sm"
            onClick={() => setLanguage("en")}
            className="h-7 px-3 text-xs"
          >
            English
          </Button>
          <Button
            variant={language === "es" ? "default" : "ghost"}
            size="sm"
            onClick={() => setLanguage("es")}
            className="h-7 px-3 text-xs"
          >
            Español
          </Button>
        </div>
      </div>

      {/* Script Sections */}
      <div className="space-y-3">
        {Object.entries(sections).map(([key, section]) => (
          <div
            key={key}
            className="bg-card rounded-lg border overflow-hidden"
          >
            <button
              onClick={() => toggleSection(key)}
              className="w-full p-4 text-left flex items-center justify-between hover:bg-muted/50 transition-colors"
            >
              <h4 className="font-semibold text-sm md:text-base">
                {language === "en" ? section.title : section.titleEs}
              </h4>
              <span className="text-muted-foreground text-xs">
                {expandedSection === key ? "−" : "+"}
              </span>
            </button>
            
            {expandedSection === key && (
              <div className="p-4 pt-0 space-y-4 border-t">
                <div className="prose prose-sm max-w-none text-xs md:text-sm leading-relaxed">
                  {formatContent(language === "en" ? section.content : section.contentEs)}
                </div>
                
                {(section.tips || section.tipsEs) && (
                  <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md border border-blue-200 dark:border-blue-800">
                    <div className="prose prose-sm max-w-none text-xs md:text-sm">
                      {formatContent(language === "en" ? section.tips! : section.tipsEs!)}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

