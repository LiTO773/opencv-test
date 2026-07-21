const HIERARCHY_VALUES_PER_CONTOUR = 4;

export type ContourHierarchyEntry = {
  next: number;
  previous: number;
  firstChild: number;
  parent: number;
};

export function readContourHierarchyEntry(
  hierarchy: Int32Array,
  contourIndex: number,
): ContourHierarchyEntry {
  'worklet';
  const offset = contourIndex * HIERARCHY_VALUES_PER_CONTOUR;
  return {
    next: hierarchy[offset] ?? -1,
    previous: hierarchy[offset + 1] ?? -1,
    firstChild: hierarchy[offset + 2] ?? -1,
    parent: hierarchy[offset + 3] ?? -1,
  };
}

function countAncestors(hierarchy: Int32Array, contourIndex: number) {
  'worklet';
  let count = 0;
  let current = readContourHierarchyEntry(hierarchy, contourIndex).parent;
  while (current >= 0 && count < 3) {
    count += 1;
    current = readContourHierarchyEntry(hierarchy, current).parent;
  }
  return count;
}

function countFirstChildDescendants(hierarchy: Int32Array, contourIndex: number) {
  'worklet';
  let count = 0;
  let current = readContourHierarchyEntry(hierarchy, contourIndex).firstChild;
  while (current >= 0 && count < 3) {
    count += 1;
    current = readContourHierarchyEntry(hierarchy, current).firstChild;
  }
  return count;
}

/**
 * Returns how deeply a contour participates in a nested shape. A QR finder
 * pattern produces the characteristic black -> white -> black chain, so every
 * contour in that three-level family has at least two combined ancestor/child
 * links. A plain filled page marker should have none.
 */
export function countQrFinderNestingLevels(hierarchy: Int32Array, contourIndex: number) {
  'worklet';
  return (
    countAncestors(hierarchy, contourIndex) +
    countFirstChildDescendants(hierarchy, contourIndex)
  );
}

