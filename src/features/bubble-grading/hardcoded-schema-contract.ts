import { hardcodedBubbleGradingSchema } from './hardcoded-schema';
import {
  formatSchemaValidationErrors,
  validateBubbleGradingSchema,
  type ImageDimensions,
} from './schema-validator';

export class CanonicalCropContractError extends Error {
  readonly code = 'canonical_crop_contract_error';

  constructor(message: string) {
    super(`Erro no contrato da imagem canónica: ${message}`);
    this.name = 'CanonicalCropContractError';
  }
}

/** Rejects schema/image drift. This function never resizes the supplied image. */
export function assertHardcodedSchemaImageContract(imageDimensions: ImageDimensions) {
  const validation = validateBubbleGradingSchema(hardcodedBubbleGradingSchema, {
    inputImage: imageDimensions,
  });
  if (!validation.valid) {
    throw new CanonicalCropContractError(formatSchemaValidationErrors(validation.errors));
  }
  return validation;
}
