import { type SchemaTypeDefinition } from 'sanity'
import {postType} from './postType'
import {stateType} from './stateType'
import {presentationScriptType} from './presentationScriptType'

export const schema: { types: SchemaTypeDefinition[] } = {
  types: [postType, stateType, presentationScriptType],
}