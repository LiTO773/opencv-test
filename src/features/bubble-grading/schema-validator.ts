import {
  SUPPORTED_SCHEMA_FORMAT_VERSION,
  type BubbleStyle,
  type BubbleGradingSchema,
  type PixelPoint,
} from './schema';

export type SchemaValidationError = {
  path: string;
  code: string;
  message: string;
};

export type ImageDimensions = {
  width: number;
  height: number;
};

export type SchemaValidationResult =
  | {
      valid: true;
      errors: [];
      schema: BubbleGradingSchema;
      imageDimensions: ImageDimensions;
    }
  | {
      valid: false;
      errors: SchemaValidationError[];
      schema: null;
      imageDimensions: ImageDimensions | null;
    };

type UnknownRecord = Record<string, unknown>;

const SUPPORTED_SELECTION_MODES = new Set(['single', 'multiple']);

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isPositiveNumber(value: unknown): value is number {
  return isFiniteNumber(value) && value > 0;
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && isPositiveNumber(value);
}

function pointFrom(value: unknown): PixelPoint | null {
  if (!isRecord(value) || !isFiniteNumber(value.x) || !isFiniteNumber(value.y)) return null;
  return { x: value.x, y: value.y };
}

function addError(
  errors: SchemaValidationError[],
  path: string,
  code: string,
  message: string,
) {
  errors.push({ path, code, message });
}

function validateRequiredString(
  value: unknown,
  path: string,
  errors: SchemaValidationError[],
) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    addError(errors, path, 'required_string', 'must be a non-empty string.');
    return false;
  }
  return true;
}

function resolveImageDimensions(
  canonicalImage: UnknownRecord | null,
  inputImage: ImageDimensions | undefined,
  errors: SchemaValidationError[],
): ImageDimensions | null {
  if (!canonicalImage) return null;

  if (canonicalImage.coordinateSystem !== 'canonical-crop-pixels') {
    addError(
      errors,
      'canonicalImage.coordinateSystem',
      'unsupported_coordinate_system',
      'must be "canonical-crop-pixels"; layout units such as PDF points are not supported.',
    );
  }
  if (canonicalImage.origin !== 'top-left') {
    addError(
      errors,
      'canonicalImage.origin',
      'unsupported_origin',
      'must be "top-left".',
    );
  }
  if (!isPositiveNumber(canonicalImage.pixelsPerMillimeter)) {
    addError(
      errors,
      'canonicalImage.pixelsPerMillimeter',
      'invalid_pixel_density',
      'must be a positive number.',
    );
  }

  if (!isRecord(canonicalImage.dimensions)) {
    addError(
      errors,
      'canonicalImage.dimensions',
      'required_object',
      'must describe fixed or unresolved canonical dimensions.',
    );
    return null;
  }

  const dimensions = canonicalImage.dimensions;
  if (dimensions.status === 'unresolved') {
    if (dimensions.widthPx !== null || dimensions.heightPx !== null) {
      addError(
        errors,
        'canonicalImage.dimensions',
        'invalid_unresolved_dimensions',
        'must use null widthPx and heightPx while status is "unresolved".',
      );
    }
    if (!inputImage) {
      addError(
        errors,
        'canonicalImage.dimensions',
        'input_dimensions_required',
        'are unresolved; provide input-image dimensions for workbench validation.',
      );
      return null;
    }
    return inputImage;
  }

  if (dimensions.status !== 'fixed') {
    addError(
      errors,
      'canonicalImage.dimensions.status',
      'unsupported_dimensions_status',
      'must be "fixed" or "unresolved".',
    );
    return null;
  }

  const widthPx = dimensions.widthPx;
  const heightPx = dimensions.heightPx;
  const widthValid = isPositiveInteger(widthPx);
  const heightValid = isPositiveInteger(heightPx);
  if (!widthValid) {
    addError(
      errors,
      'canonicalImage.dimensions.widthPx',
      'invalid_image_dimension',
      'must be a positive integer.',
    );
  }
  if (!heightValid) {
    addError(
      errors,
      'canonicalImage.dimensions.heightPx',
      'invalid_image_dimension',
      'must be a positive integer.',
    );
  }
  if (!widthValid || !heightValid) return null;

  const resolved = { width: widthPx as number, height: heightPx as number };
  if (inputImage && (inputImage.width !== resolved.width || inputImage.height !== resolved.height)) {
    addError(
      errors,
      'canonicalImage.dimensions',
      'image_dimension_mismatch',
      `declares ${resolved.width}x${resolved.height}px but input.jpg is ${inputImage.width}x${inputImage.height}px.`,
    );
  }
  return resolved;
}

function validateRectangle(
  value: unknown,
  path: string,
  imageDimensions: ImageDimensions | null,
  errors: SchemaValidationError[],
) {
  if (!isRecord(value)) {
    addError(errors, path, 'required_object', 'must be a pixel rectangle.');
    return;
  }
  const properties = ['x', 'y', 'width', 'height'] as const;
  for (const property of properties) {
    if (!isFiniteNumber(value[property])) {
      addError(
        errors,
        `${path}.${property}`,
        'invalid_number',
        'must be a finite number of canonical pixels.',
      );
    }
  }
  if (isFiniteNumber(value.width) && value.width <= 0) {
    addError(errors, `${path}.width`, 'invalid_size', 'must be greater than zero.');
  }
  if (isFiniteNumber(value.height) && value.height <= 0) {
    addError(errors, `${path}.height`, 'invalid_size', 'must be greater than zero.');
  }

  if (
    imageDimensions &&
    isFiniteNumber(value.x) &&
    isFiniteNumber(value.y) &&
    isPositiveNumber(value.width) &&
    isPositiveNumber(value.height) &&
    (value.x < 0 ||
      value.y < 0 ||
      value.x + value.width > imageDimensions.width ||
      value.y + value.height > imageDimensions.height)
  ) {
    addError(
      errors,
      path,
      'qr_out_of_bounds',
      `must fit completely inside the ${imageDimensions.width}x${imageDimensions.height}px canonical image.`,
    );
  }
}

function validateBubbleStyle(value: unknown, errors: SchemaValidationError[]): BubbleStyle | null {
  if (!isRecord(value)) {
    addError(errors, 'bubbleStyle', 'required_object', 'must declare the global bubble radius.');
    return null;
  }

  if (!isPositiveNumber(value.radiusPx)) {
    addError(
      errors,
      'bubbleStyle.radiusPx',
      'invalid_radius',
      'must be a positive number of canonical pixels.',
    );
    return null;
  }
  return { radiusPx: value.radiusPx };
}

export function validateBubbleGradingSchema(
  candidate: unknown,
  options: { inputImage?: ImageDimensions } = {},
): SchemaValidationResult {
  const errors: SchemaValidationError[] = [];
  if (!isRecord(candidate)) {
    return {
      valid: false,
      errors: [{ path: '$', code: 'required_object', message: 'schema must be an object.' }],
      schema: null,
      imageDimensions: null,
    };
  }

  if (candidate.formatVersion !== SUPPORTED_SCHEMA_FORMAT_VERSION) {
    addError(
      errors,
      'formatVersion',
      'unsupported_format_version',
      `must equal ${SUPPORTED_SCHEMA_FORMAT_VERSION}.`,
    );
  }

  const test = isRecord(candidate.test) ? candidate.test : null;
  if (!test) {
    addError(errors, 'test', 'required_object', 'must identify the generated test.');
  } else {
    validateRequiredString(test.id, 'test.id', errors);
    validateRequiredString(test.version, 'test.version', errors);
  }

  const canonicalImage = isRecord(candidate.canonicalImage) ? candidate.canonicalImage : null;
  if (!canonicalImage) {
    addError(
      errors,
      'canonicalImage',
      'required_object',
      'must describe the marker-free canonical image.',
    );
  }
  const imageDimensions = resolveImageDimensions(canonicalImage, options.inputImage, errors);
  validateRectangle(candidate.qrRegionPx, 'qrRegionPx', imageDimensions, errors);
  const bubbleStyle = validateBubbleStyle(candidate.bubbleStyle, errors);

  if (!Array.isArray(candidate.questions)) {
    addError(errors, 'questions', 'required_array', 'must be an array.');
  } else {
    const questionIds = new Map<string, string>();
    const bubbleIds = new Map<string, string>();
    candidate.questions.forEach((questionValue, questionIndex) => {
      const questionPath = `questions[${questionIndex}]`;
      if (!isRecord(questionValue)) {
        addError(errors, questionPath, 'required_object', 'must be a question object.');
        return;
      }

      if (validateRequiredString(questionValue.id, `${questionPath}.id`, errors)) {
        const existingPath = questionIds.get(questionValue.id as string);
        if (existingPath) {
          addError(
            errors,
            `${questionPath}.id`,
            'duplicate_question_id',
            `duplicates ${existingPath}.`,
          );
        } else {
          questionIds.set(questionValue.id as string, `${questionPath}.id`);
        }
      }
      validateRequiredString(questionValue.label, `${questionPath}.label`, errors);

      if (!SUPPORTED_SELECTION_MODES.has(questionValue.selectionMode as string)) {
        addError(
          errors,
          `${questionPath}.selectionMode`,
          'unsupported_selection_mode',
          'must be "single" or "multiple".',
        );
      }
      if (!Number.isInteger(questionValue.points) || (questionValue.points as number) < 0) {
        addError(
          errors,
          `${questionPath}.points`,
          'invalid_points',
          'must be a non-negative integer.',
        );
      }

      const questionBubbleIds = new Set<string>();
      if (!Array.isArray(questionValue.bubbles)) {
        addError(errors, `${questionPath}.bubbles`, 'required_array', 'must be an array.');
      } else {
        questionValue.bubbles.forEach((bubbleValue, bubbleIndex) => {
          const bubblePath = `${questionPath}.bubbles[${bubbleIndex}]`;
          if (!isRecord(bubbleValue)) {
            addError(errors, bubblePath, 'required_object', 'must be a bubble object.');
            return;
          }

          if (validateRequiredString(bubbleValue.id, `${bubblePath}.id`, errors)) {
            const bubbleId = bubbleValue.id as string;
            questionBubbleIds.add(bubbleId);
            const existingPath = bubbleIds.get(bubbleId);
            if (existingPath) {
              addError(
                errors,
                `${bubblePath}.id`,
                'duplicate_bubble_id',
                `duplicates ${existingPath}; bubble ids must be unique across the schema.`,
              );
            } else {
              bubbleIds.set(bubbleId, `${bubblePath}.id`);
            }
          }
          validateRequiredString(bubbleValue.label, `${bubblePath}.label`, errors);

          const center = pointFrom(bubbleValue.centerPx);
          if (!center) {
            addError(
              errors,
              `${bubblePath}.centerPx`,
              'invalid_point',
              'must contain finite x and y canonical-pixel coordinates.',
            );
            return;
          }
          if (
            imageDimensions &&
            bubbleStyle &&
            (center.x - bubbleStyle.radiusPx < 0 ||
              center.y - bubbleStyle.radiusPx < 0 ||
              center.x + bubbleStyle.radiusPx > imageDimensions.width ||
              center.y + bubbleStyle.radiusPx > imageDimensions.height)
          ) {
            addError(
              errors,
              `${bubblePath}.centerPx`,
              'bubble_out_of_bounds',
              `the complete ${bubbleStyle.radiusPx}px-radius circle must fit inside the ${imageDimensions.width}x${imageDimensions.height}px canonical image.`,
            );
          }
        });
      }

      if (!Array.isArray(questionValue.correctBubbleIds)) {
        addError(
          errors,
          `${questionPath}.correctBubbleIds`,
          'required_array',
          'must be an array of bubble ids.',
        );
      } else {
        const referencedIds = new Set<string>();
        questionValue.correctBubbleIds.forEach((correctId, correctIndex) => {
          const correctPath = `${questionPath}.correctBubbleIds[${correctIndex}]`;
          if (typeof correctId !== 'string' || correctId.length === 0) {
            addError(errors, correctPath, 'invalid_reference', 'must be a non-empty bubble id.');
          } else if (referencedIds.has(correctId)) {
            addError(errors, correctPath, 'duplicate_correct_answer', `repeats "${correctId}".`);
          } else if (!questionBubbleIds.has(correctId)) {
            addError(
              errors,
              correctPath,
              'unknown_correct_bubble',
              `references "${correctId}", which is not a bubble in this question.`,
            );
          }
          if (typeof correctId === 'string') referencedIds.add(correctId);
        });
      }
    });

  }

  if (errors.length > 0 || !imageDimensions) {
    return { valid: false, errors, schema: null, imageDimensions };
  }
  return {
    valid: true,
    errors: [],
    schema: candidate as BubbleGradingSchema,
    imageDimensions,
  };
}

export function formatSchemaValidationErrors(errors: SchemaValidationError[]) {
  return errors.map((error) => `${error.path}: ${error.message} [${error.code}]`).join('\n');
}
