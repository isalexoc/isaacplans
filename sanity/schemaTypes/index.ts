import { type SchemaTypeDefinition } from 'sanity'
import {postType} from './postType'
import {stateType} from './stateType'
import {presentationScriptType} from './presentationScriptType'
import {objectionType} from './objectionType'
import {leadMagnetType} from './leadMagnetType'
import {socialPostType} from './socialPostType'
import {agentLicenseType} from './agentLicenseType'
import {iulPresentationTypes} from './iulPresentation'

export const schema: { types: SchemaTypeDefinition[] } = {
  types: [
    postType,
    stateType,
    presentationScriptType,
    objectionType,
    leadMagnetType,
    socialPostType,
    agentLicenseType,
    ...iulPresentationTypes,
  ],
}
