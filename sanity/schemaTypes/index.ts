import { type SchemaTypeDefinition } from 'sanity'
import {postType} from './postType'
import {stateType} from './stateType'

export const schema: { types: SchemaTypeDefinition[] } = {
  types: [postType, stateType],
}