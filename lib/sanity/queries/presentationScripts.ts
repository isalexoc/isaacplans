/**
 * GROQ queries for Presentation Scripts
 */

export const PRESENTATION_SCRIPT_QUERY = `*[
  _type == "presentationScript"
  && lineOfBusiness == $lineOfBusiness
  && status == "published"
]|order(updatedAt desc)[0]{
  _id,
  title,
  description,
  lineOfBusiness,
  openingIntroduction,
  discoveryQuestions,
  productPresentation,
  closingTechniques,
  objectionHandling,
  psychologySalesTips,
  updatedAt
}`;

export const ALL_PRESENTATION_SCRIPTS_QUERY = `*[
  _type == "presentationScript"
  && status == "published"
]|order(lineOfBusiness asc){
  _id,
  title,
  description,
  lineOfBusiness,
  updatedAt
}`;

