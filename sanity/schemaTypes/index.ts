import { type SchemaTypeDefinition } from 'sanity'
import {postType} from './postType'
import {stateType} from './stateType'
import {presentationScriptType} from './presentationScriptType'
import {leadMagnetType} from './leadMagnetType'
import {socialPostType} from './socialPostType'

export const schema: { types: SchemaTypeDefinition[] } = {
  types: [postType, stateType, presentationScriptType, leadMagnetType, socialPostType],
}