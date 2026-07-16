import { type SchemaTypeDefinition } from 'sanity'
import {postType} from './postType'
import {stateType} from './stateType'
import {presentationScriptType} from './presentationScriptType'
import {leadMagnetType} from './leadMagnetType'
import {socialPostType} from './socialPostType'
import {agentLicenseType} from './agentLicenseType'
import {iulPresentationTypes} from './iulPresentation'

export const schema: { types: SchemaTypeDefinition[] } = {
  types: [
    postType,
    stateType,
    presentationScriptType,
    leadMagnetType,
    socialPostType,
    agentLicenseType,
    ...iulPresentationTypes,
  ],
}
