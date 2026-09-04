/**
 * GROQ queries for the Objection Library
 */

/**
 * Every published objection, in display order.
 *
 * Deliberately unfiltered by product: the presentations page renders six product tabs, and a
 * per-product query would send every universal objection's answer blocks down the wire six times.
 * Bucketing happens on the client via `appliesToLob()` — which also sidesteps the GROQ trap that
 * `count(undefinedField) == 0` is false, so "no products ticked" would filter to nothing.
 */
export const OBJECTIONS_QUERY = `*[
  _type == "objection"
  && status == "published"
]|order(order asc, _createdAt asc){
  _id,
  titleEn,
  titleEs,
  objectionType,
  linesOfBusiness,
  triggersEn,
  triggersEs,
  answerEn,
  answerEs
}`;
