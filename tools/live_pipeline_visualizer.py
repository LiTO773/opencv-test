#!/usr/bin/env python3
"""Live, inspectable OpenCV twin of the app's document/OMR pipeline.

The window deliberately spends screen space on intermediate images. It mirrors
the constants and decision order in:

* src/features/four-point/four-point-detection.ts
* src/features/four-point/four-point-layout.ts
* src/features/bubble-grading/bubble-analysis.ts

The current TypeScript schema, canonical dimensions, and detector thresholds
are read at startup so calibration edits do not need to be copied into Python.
OpenCV replaces jsQR only for the QR decoding panel; QR metadata does not choose
the grading schema in the prototype.
"""

from __future__ import annotations

import argparse
import math
import platform
import re
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable, Literal, Sequence

try:
    import cv2
    import numpy as np
except ImportError as exc:  # pragma: no cover - exercised on an unprepared machine.
    raise SystemExit(
        "OpenCV dependencies are missing. Run:\n"
        "  python3 -m pip install -r tools/requirements-opencv.txt\n"
        f"Original import error: {exc}"
    ) from exc


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SCHEMA_PATH = ROOT / "tools/schema-preview/schema.ts"
DEFAULT_CONTRACT_PATH = (
    ROOT / "src/features/bubble-grading/canonical-crop-contract.ts"
)
DEFAULT_CONFIG_PATH = ROOT / "src/features/bubble-grading/bubble-detector-config.ts"
WINDOW_NAME = "OMR pipeline — every live step"
QR_DETECTOR = cv2.QRCodeDetector()

# These values intentionally match four-point-detection.ts.
PAGE_WIDTH_FRACTION = 0.76
A4_HEIGHT_TO_WIDTH = 297 / 210
A4_WIDTH_TO_HEIGHT = 210 / 297
REGION_WIDTH_FRACTION = 0.25
MIN_DARKNESS = 145.0
MAX_MARKER_CANDIDATES_PER_REGION = 4
QR_FINDER_NESTING_LEVELS = 2
SINGLE_NESTING_SCORE_PENALTY = 0.72

Point = tuple[float, float]
Quadrilateral = tuple[Point, Point, Point, Point]
Decision = Literal["filled", "unfilled", "uncertain"]
QuestionStatus = Literal["correct", "incorrect", "needs_review"]

COLORS = {
    "white": (244, 247, 250),
    "muted": (160, 171, 186),
    "panel": (20, 27, 38),
    "panel_alt": (28, 37, 51),
    "green": (92, 211, 145),
    "red": (99, 106, 239),
    "orange": (63, 167, 250),
    "yellow": (78, 221, 250),
    "cyan": (226, 199, 65),
    "magenta": (222, 101, 206),
    "blue": (238, 142, 74),
}


@dataclass(frozen=True)
class Region:
    position: str
    x: int
    y: int
    width: int
    height: int

    @property
    def center(self) -> Point:
        return self.x + self.width / 2, self.y + self.height / 2


@dataclass
class Marker:
    center: Point
    corners: Quadrilateral
    size: float


@dataclass
class Candidate:
    marker: Marker
    appearance_score: float
    nesting_levels: int


@dataclass
class RegionDebug:
    gray: np.ndarray
    blurred: np.ndarray
    thresholded: np.ndarray
    contours: list[np.ndarray]
    hierarchy: np.ndarray
    candidates: list[Candidate]
    qr_rejected: list[np.ndarray]


@dataclass
class Layout:
    markers: tuple[Marker, Marker, Marker, Marker]
    crop: Quadrilateral
    score: float


@dataclass(frozen=True)
class BubbleStyle:
    radius: float
    outline_width: float
    roi_radius: float
    fill_radius: float
    background_inner: float
    background_outer: float
    center_tolerance: float


@dataclass(frozen=True)
class Bubble:
    id: str
    label: str
    center: Point


@dataclass(frozen=True)
class Question:
    id: str
    label: str
    points: int
    correct_ids: tuple[str, ...]
    bubbles: tuple[Bubble, ...]


@dataclass(frozen=True)
class Schema:
    width: int
    height: int
    qr_region: tuple[int, int, int, int]
    style: BubbleStyle
    questions: tuple[Question, ...]


@dataclass(frozen=True)
class DetectorConfig:
    detector_id: str
    dark_pixel_delta: float
    unfilled_max_ratio: float
    filled_min_ratio: float
    minimum_background_brightness: float
    minimum_marked_contrast: float
    minimum_focus_score: float


@dataclass
class BubbleDiagnostic:
    question_id: str
    bubble_id: str
    expected_center: Point
    measured_center: Point
    dx: int
    dy: int
    dark_cutoff: float
    interior_brightness: float
    background_brightness: float
    dark_pixel_ratio: float
    contrast: float
    focus_score: float
    confidence: float
    decision: Decision
    reasons: list[str]


@dataclass
class QuestionResult:
    label: str
    points: int
    selected: tuple[str, ...]
    correct: tuple[str, ...]
    status: QuestionStatus
    confidence: float
    reasons: list[str]


@dataclass
class FramePipeline:
    raw: np.ndarray
    portrait: np.ndarray
    analysis: np.ndarray
    regions: tuple[Region, Region, Region, Region]
    region_debug: tuple[RegionDebug, RegionDebug, RegionDebug, RegionDebug]
    layout: Layout | None
    canonical: np.ndarray | None
    qr_text: str | None
    qr_rotation: int
    bubbles: list[BubbleDiagnostic] = field(default_factory=list)
    questions: list[QuestionResult] = field(default_factory=list)
    elapsed_ms: float = 0.0


def read_text(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except OSError as exc:
        raise SystemExit(f"Could not read {path}: {exc}") from exc


def required_number(text: str, key: str) -> float:
    match = re.search(rf"\b{re.escape(key)}\s*:\s*(-?\d+(?:\.\d+)?)", text)
    if not match:
        raise SystemExit(f"Could not find numeric field {key!r} in TypeScript config")
    return float(match.group(1))


def required_string(text: str, key: str) -> str:
    match = re.search(rf"\b{re.escape(key)}\s*:\s*(['\"])(.*?)\1", text)
    if not match:
        raise SystemExit(f"Could not find string field {key!r} in TypeScript config")
    return match.group(2)


def js_round(value: float) -> int:
    """Match JavaScript Math.round for the non-infinite values used here."""
    return math.floor(value + 0.5)


def matching_delimiter(text: str, start: int, opening: str, closing: str) -> int:
    depth = 0
    quote: str | None = None
    escaped = False
    for index in range(start, len(text)):
        character = text[index]
        if quote:
            if escaped:
                escaped = False
            elif character == "\\":
                escaped = True
            elif character == quote:
                quote = None
            continue
        if character in "'\"`":
            quote = character
        elif character == opening:
            depth += 1
        elif character == closing:
            depth -= 1
            if depth == 0:
                return index
    raise SystemExit(f"Unclosed {opening!r} while reading TypeScript schema")


def array_body_after(text: str, key: str) -> str:
    key_match = re.search(rf"\b{re.escape(key)}\s*:", text)
    if not key_match:
        raise SystemExit(f"Could not find array field {key!r} in TypeScript schema")
    start = text.find("[", key_match.end())
    if start < 0:
        raise SystemExit(f"Could not find array value for {key!r}")
    end = matching_delimiter(text, start, "[", "]")
    return text[start + 1 : end]


def top_level_objects(array_body: str) -> list[str]:
    objects: list[str] = []
    index = 0
    while index < len(array_body):
        start = array_body.find("{", index)
        if start < 0:
            break
        end = matching_delimiter(array_body, start, "{", "}")
        objects.append(array_body[start + 1 : end])
        index = end + 1
    return objects


def parse_string_array(text: str, key: str) -> tuple[str, ...]:
    body = array_body_after(text, key)
    return tuple(match.group(2) for match in re.finditer(r"(['\"])(.*?)\1", body))


def load_runtime_contract(
    schema_path: Path,
    contract_path: Path,
    config_path: Path,
) -> tuple[Schema, DetectorConfig]:
    schema_text = read_text(schema_path)
    contract_text = read_text(contract_path)
    config_text = read_text(config_path)

    width = int(required_number(contract_text, "widthPx"))
    height = int(required_number(contract_text, "heightPx"))
    qr_match = re.search(r"qrRegionPx\s*:\s*\{(.*?)\}", schema_text, re.DOTALL)
    style_match = re.search(r"bubbleStyle\s*:\s*\{(.*?)\}", schema_text, re.DOTALL)
    if not qr_match or not style_match:
        raise SystemExit("Could not read qrRegionPx/bubbleStyle from TypeScript schema")

    qr_text = qr_match.group(1)
    qr_region = (
        int(required_number(qr_text, "x")),
        int(required_number(qr_text, "y")),
        int(required_number(qr_text, "width")),
        int(required_number(qr_text, "height")),
    )
    style_text = style_match.group(1)
    style = BubbleStyle(
        radius=required_number(style_text, "radiusPx"),
        outline_width=required_number(style_text, "printedOutlineWidthPx"),
        roi_radius=required_number(style_text, "roiRadiusPx"),
        fill_radius=required_number(style_text, "fillRadiusPx"),
        background_inner=required_number(style_text, "backgroundRingInnerRadiusPx"),
        background_outer=required_number(style_text, "backgroundRingOuterRadiusPx"),
        center_tolerance=required_number(style_text, "centerSearchTolerancePx"),
    )

    questions: list[Question] = []
    for question_text in top_level_objects(array_body_after(schema_text, "questions")):
        bubbles: list[Bubble] = []
        for bubble_text in top_level_objects(array_body_after(question_text, "bubbles")):
            center_match = re.search(r"centerPx\s*:\s*\{(.*?)\}", bubble_text, re.DOTALL)
            if not center_match:
                raise SystemExit("A schema bubble has no centerPx object")
            center_text = center_match.group(1)
            bubbles.append(
                Bubble(
                    id=required_string(bubble_text, "id"),
                    label=required_string(bubble_text, "label"),
                    center=(
                        required_number(center_text, "x"),
                        required_number(center_text, "y"),
                    ),
                )
            )
        questions.append(
            Question(
                id=required_string(question_text, "id"),
                label=required_string(question_text, "label"),
                points=int(required_number(question_text, "points")),
                correct_ids=parse_string_array(question_text, "correctBubbleIds"),
                bubbles=tuple(bubbles),
            )
        )

    schema = Schema(width, height, qr_region, style, tuple(questions))
    config = DetectorConfig(
        detector_id=required_string(config_text, "id"),
        dark_pixel_delta=required_number(config_text, "darkPixelDelta"),
        unfilled_max_ratio=required_number(config_text, "unfilledMaxDarkPixelRatio"),
        filled_min_ratio=required_number(config_text, "filledMinDarkPixelRatio"),
        minimum_background_brightness=required_number(
            config_text, "minimumBackgroundBrightness"
        ),
        minimum_marked_contrast=required_number(config_text, "minimumMarkedContrast"),
        minimum_focus_score=required_number(config_text, "minimumFocusScore"),
    )
    return schema, config


def rotate_for_portrait(frame: np.ndarray, mode: str) -> tuple[np.ndarray, str]:
    resolved = mode
    if mode == "auto":
        resolved = "clockwise" if frame.shape[1] > frame.shape[0] else "none"
    if resolved == "clockwise":
        return cv2.rotate(frame, cv2.ROTATE_90_CLOCKWISE), resolved
    if resolved == "counterclockwise":
        return cv2.rotate(frame, cv2.ROTATE_90_COUNTERCLOCKWISE), resolved
    if resolved == "180":
        return cv2.rotate(frame, cv2.ROTATE_180), resolved
    return frame.copy(), "none"


def resize_cover(image: np.ndarray, width: int, height: int) -> np.ndarray:
    source_height, source_width = image.shape[:2]
    scale = max(width / source_width, height / source_height)
    resized_width = max(width, js_round(source_width * scale))
    resized_height = max(height, js_round(source_height * scale))
    resized = cv2.resize(image, (resized_width, resized_height), interpolation=cv2.INTER_LINEAR)
    left = (resized_width - width) // 2
    top = (resized_height - height) // 2
    return resized[top : top + height, left : left + width]


def map_analysis_to_source(
    point: Point,
    analysis_width: int,
    analysis_height: int,
    source_width: int,
    source_height: int,
) -> Point:
    scale = max(analysis_width / source_width, analysis_height / source_height)
    cropped_x = (source_width * scale - analysis_width) / 2
    cropped_y = (source_height * scale - analysis_height) / 2
    return (point[0] + cropped_x) / scale, (point[1] + cropped_y) / scale


def create_marker_regions(width: int, height: int) -> tuple[Region, Region, Region, Region]:
    page_width = width * PAGE_WIDTH_FRACTION
    page_height = page_width * A4_HEIGHT_TO_WIDTH
    left = (width - page_width) / 2
    top = height * 0.46 - page_height / 2
    right = left + page_width
    bottom = top + page_height
    region_size = width * REGION_WIDTH_FRACTION
    half = region_size / 2

    def make(position: str, center_x: float, center_y: float) -> Region:
        x = js_round(max(0, min(width - region_size, center_x - half)))
        y = js_round(max(0, min(height - region_size, center_y - half)))
        return Region(position, x, y, js_round(region_size), js_round(region_size))

    return (
        make("top-left", left, top),
        make("top-right", right, top),
        make("bottom-right", right, bottom),
        make("bottom-left", left, bottom),
    )


def distance(first: Point, second: Point) -> float:
    return math.hypot(first[0] - second[0], first[1] - second[1])


def polygon_area(points: Sequence[Point]) -> float:
    return abs(
        sum(
            points[index][0] * points[(index + 1) % len(points)][1]
            - points[(index + 1) % len(points)][0] * points[index][1]
            for index in range(len(points))
        )
        / 2
    )


def order_quadrilateral(points: Sequence[Point]) -> Quadrilateral:
    center_x = sum(point[0] for point in points) / 4
    center_y = sum(point[1] for point in points) / 4
    ordered = sorted(points, key=lambda point: math.atan2(point[1] - center_y, point[0] - center_x))
    top_left_index = min(range(4), key=lambda index: sum(ordered[index]))
    rotated = ordered[top_left_index:] + ordered[:top_left_index]
    return tuple(rotated)  # type: ignore[return-value]


def is_convex_quadrilateral(points: Quadrilateral) -> bool:
    expected_sign = 0
    for index in range(4):
        first, second, third = points[index], points[(index + 1) % 4], points[(index + 2) % 4]
        cross = (second[0] - first[0]) * (third[1] - second[1]) - (
            second[1] - first[1]
        ) * (third[0] - second[0])
        if abs(cross) < 0.001:
            return False
        sign = 1 if cross > 0 else -1
        if expected_sign == 0:
            expected_sign = sign
        elif sign != expected_sign:
            return False
    return True


def nesting_levels(hierarchy: np.ndarray, contour_index: int) -> int:
    ancestors = 0
    current = int(hierarchy[contour_index][3])
    while current >= 0 and ancestors < 3:
        ancestors += 1
        current = int(hierarchy[current][3])
    descendants = 0
    current = int(hierarchy[contour_index][2])
    while current >= 0 and descendants < 3:
        descendants += 1
        current = int(hierarchy[current][2])
    return ancestors + descendants


def marker_from_contour(
    approximation: np.ndarray,
    gray: np.ndarray,
    region: Region,
) -> tuple[Marker, float] | None:
    if len(approximation) != 4:
        return None
    local_points = [(float(point[0][0]), float(point[0][1])) for point in approximation]
    corners = order_quadrilateral(local_points)
    if not is_convex_quadrilateral(corners):
        return None
    area = polygon_area(corners)
    region_area = region.width * region.height
    if area < 14 or area > region_area * 0.14:
        return None
    sides = [distance(corners[index], corners[(index + 1) % 4]) for index in range(4)]
    shortest, longest = min(sides), max(sides)
    if shortest < 3 or shortest / longest < 0.55:
        return None
    diagonals = [distance(corners[0], corners[2]), distance(corners[1], corners[3])]
    diagonal_balance = min(diagonals) / max(diagonals)
    if diagonal_balance < 0.68:
        return None
    average_side = sum(sides) / 4
    contour_fill = area / (average_side * average_side)
    if contour_fill < 0.55 or contour_fill > 1.45:
        return None

    min_x, max_x = min(point[0] for point in corners), max(point[0] for point in corners)
    min_y, max_y = min(point[1] for point in corners), max(point[1] for point in corners)
    inner_x = max(0, js_round(min_x + (max_x - min_x) * 0.25))
    inner_y = max(0, js_round(min_y + (max_y - min_y) * 0.25))
    inner_width = max(1, min(region.width - inner_x, js_round((max_x - min_x) * 0.5)))
    inner_height = max(1, min(region.height - inner_y, js_round((max_y - min_y) * 0.5)))
    inner = gray[inner_y : inner_y + inner_height, inner_x : inner_x + inner_width]
    mean = float(inner.mean()) if inner.size else 255.0
    if mean > MIN_DARKNESS:
        return None

    local_center = (
        sum(point[0] for point in corners) / 4,
        sum(point[1] for point in corners) / 4,
    )
    region_center = (region.width / 2, region.height / 2)
    maximum_center_distance = math.hypot(region.width, region.height) / 2
    center_quality = 1 - min(1.0, distance(local_center, region_center) / maximum_center_distance) * 0.45
    shape_quality = (shortest / longest) * diagonal_balance
    darkness_quality = 1 - mean / 255
    global_corners = tuple((point[0] + region.x, point[1] + region.y) for point in corners)
    marker = Marker(
        center=(local_center[0] + region.x, local_center[1] + region.y),
        corners=global_corners,  # type: ignore[arg-type]
        size=math.sqrt(area),
    )
    return marker, shape_quality * darkness_quality * center_quality


def analyze_region(analysis: np.ndarray, region: Region) -> RegionDebug:
    color = analysis[region.y : region.y + region.height, region.x : region.x + region.width]
    gray = cv2.cvtColor(color, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (3, 3), 0)
    thresholded = cv2.adaptiveThreshold(
        blurred,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY_INV,
        21,
        7,
    )
    contours, raw_hierarchy = cv2.findContours(
        thresholded, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE
    )
    hierarchy = (
        raw_hierarchy[0]
        if raw_hierarchy is not None
        else np.empty((0, 4), dtype=np.int32)
    )
    candidates: list[Candidate] = []
    qr_rejected: list[np.ndarray] = []
    for index, contour in enumerate(contours):
        levels = nesting_levels(hierarchy, index)
        if levels >= QR_FINDER_NESTING_LEVELS:
            qr_rejected.append(contour)
            continue
        contour_area = cv2.contourArea(contour)
        if contour_area < 14 or contour_area > region.width * region.height * 0.14:
            continue
        perimeter = cv2.arcLength(contour, True)
        approximation = cv2.approxPolyDP(contour, perimeter * 0.04, True)
        parsed = marker_from_contour(approximation, gray, region)
        if parsed:
            marker, score = parsed
            candidates.append(
                Candidate(
                    marker,
                    score * (SINGLE_NESTING_SCORE_PENALTY if levels == 1 else 1),
                    levels,
                )
            )

    candidates.sort(key=lambda candidate: candidate.appearance_score, reverse=True)
    distinct: list[Candidate] = []
    for candidate in candidates:
        duplicate = any(
            distance(candidate.marker.center, existing.marker.center)
            <= max(4, min(candidate.marker.size, existing.marker.size) * 0.5)
            for existing in distinct
        )
        if not duplicate:
            distinct.append(candidate)
        if len(distinct) >= MAX_MARKER_CANDIDATES_PER_REGION:
            break
    return RegionDebug(gray, blurred, thresholded, contours, hierarchy, distinct, qr_rejected)


def marker_free_crop(markers: tuple[Marker, Marker, Marker, Marker]) -> Quadrilateral:
    top_left, top_right, bottom_right, bottom_left = markers
    return (
        top_left.corners[1],
        top_right.corners[0],
        bottom_right.corners[3],
        bottom_left.corners[2],
    )


def score_layout(
    candidates: tuple[Candidate, Candidate, Candidate, Candidate],
    regions: Sequence[Region],
) -> Layout | None:
    markers = tuple(candidate.marker for candidate in candidates)
    crop = marker_free_crop(markers)  # type: ignore[arg-type]
    if not is_convex_quadrilateral(crop):
        return None
    top_left, top_right, bottom_right, bottom_left = markers
    if (
        top_right.center[0] <= top_left.center[0]
        or bottom_right.center[0] <= bottom_left.center[0]
        or bottom_left.center[1] <= top_left.center[1]
        or bottom_right.center[1] <= top_right.center[1]
    ):
        return None
    top_width = distance(top_left.center, top_right.center)
    bottom_width = distance(bottom_left.center, bottom_right.center)
    left_height = distance(top_left.center, bottom_left.center)
    right_height = distance(top_right.center, bottom_right.center)
    width_balance = min(top_width, bottom_width) / max(top_width, bottom_width)
    height_balance = min(left_height, right_height) / max(left_height, right_height)
    if width_balance < 0.45 or height_balance < 0.45:
        return None
    average_width = (top_width + bottom_width) / 2
    average_height = (left_height + right_height) / 2
    aspect_ratio = average_width / average_height
    if aspect_ratio < 0.46 or aspect_ratio > 0.92:
        return None
    sizes = [marker.size for marker in markers]
    size_balance = min(sizes) / max(sizes)
    if size_balance < 0.28:
        return None

    appearance = sum(candidate.appearance_score for candidate in candidates) / 4
    aspect_quality = 1 / (1 + abs(aspect_ratio - A4_WIDTH_TO_HEIGHT) * 4)
    guide_quality = 0.0
    inward_quality = 0.0
    directions = ((1, 1), (-1, 1), (-1, -1), (1, -1))
    for marker, region, direction in zip(markers, regions, directions):
        maximum_distance = math.hypot(region.width, region.height) / 2
        normalized = min(1.0, distance(marker.center, region.center) / maximum_distance)
        guide_quality += 1 - normalized * 0.55
        offset = (marker.center[0] - region.center[0], marker.center[1] - region.center[1])
        inward_distance = max(0.0, (offset[0] * direction[0] + offset[1] * direction[1]) / math.sqrt(2))
        inward_quality += 1 - min(1.0, inward_distance / maximum_distance) * 0.7
    score = (
        appearance
        * size_balance
        * width_balance
        * height_balance
        * aspect_quality
        * (guide_quality / 4)
        * (inward_quality / 4)
    )
    return Layout(markers, crop, score)  # type: ignore[arg-type]


def select_best_layout(debug: Sequence[RegionDebug], regions: Sequence[Region]) -> Layout | None:
    best: Layout | None = None
    for first in debug[0].candidates:
        for second in debug[1].candidates:
            for third in debug[2].candidates:
                for fourth in debug[3].candidates:
                    layout = score_layout((first, second, third, fourth), regions)
                    if layout and (best is None or layout.score > best.score):
                        best = layout
    return best


def warp_canonical(
    portrait: np.ndarray,
    layout: Layout,
    analysis_width: int,
    analysis_height: int,
    schema: Schema,
) -> np.ndarray:
    source_height, source_width = portrait.shape[:2]
    source = np.float32(
        [
            map_analysis_to_source(
                point, analysis_width, analysis_height, source_width, source_height
            )
            for point in layout.crop
        ]
    )
    destination = np.float32(
        [[0, 0], [schema.width, 0], [schema.width, schema.height], [0, schema.height]]
    )
    transform = cv2.getPerspectiveTransform(source, destination)
    return cv2.warpPerspective(
        portrait,
        transform,
        (schema.width, schema.height),
        flags=cv2.INTER_LINEAR,
        borderMode=cv2.BORDER_CONSTANT,
        borderValue=(255, 255, 255),
    )


def expanded_qr_regions(schema: Schema, padding: int = 12) -> list[tuple[int, int, int, int]]:
    x, y, width, height = schema.qr_region
    opposite = (schema.width - x - width, schema.height - y - height, width, height)
    return [
        (region[0] - padding, region[1] - padding, region[2] + padding * 2, region[3] + padding * 2)
        for region in (schema.qr_region, opposite)
    ]


def read_qr(canonical: np.ndarray, schema: Schema) -> tuple[str | None, int]:
    for x, y, width, height in expanded_qr_regions(schema):
        left, top = max(0, x), max(0, y)
        right, bottom = min(schema.width, x + width), min(schema.height, y + height)
        if right <= left or bottom <= top:
            continue
        value, points, _ = QR_DETECTOR.detectAndDecode(canonical[top:bottom, left:right])
        if value:
            rotation = 0
            if points is not None and len(points):
                points = points.reshape(-1, 2)
                if len(points) >= 2:
                    angle = math.atan2(points[1][1] - points[0][1], points[1][0] - points[0][0])
                    turns = js_round(angle / (math.pi / 2)) % 4
                    rotation = 180 if turns == 2 else 0
            return value, rotation
    return None, 0


def circle_samples(
    gray: np.ndarray,
    center: Point,
    inner_radius: float,
    outer_radius: float,
) -> tuple[np.ndarray, bool]:
    left = math.floor(center[0] - outer_radius)
    top = math.floor(center[1] - outer_radius)
    right = math.ceil(center[0] + outer_radius)
    bottom = math.ceil(center[1] + outer_radius)
    values: list[int] = []
    incomplete = False
    for y in range(top, bottom):
        for x in range(left, right):
            radius = math.hypot(x - center[0], y - center[1])
            if radius < inner_radius or radius > outer_radius:
                continue
            if x < 0 or y < 0 or x >= gray.shape[1] or y >= gray.shape[0]:
                incomplete = True
            else:
                values.append(int(gray[y, x]))
    return np.asarray(values, dtype=np.float64), incomplete


def outline_darkness(gray: np.ndarray, center: Point, style: BubbleStyle) -> float:
    half_width = max(0.75, style.outline_width / 2)
    values, _ = circle_samples(
        gray, center, max(0, style.radius - half_width), style.radius + half_width
    )
    return 0.0 if not len(values) else 1 - float(values.mean()) / 255


def measured_center(gray: np.ndarray, expected: Point, style: BubbleStyle) -> tuple[Point, int, int]:
    best_center = expected
    best_score = outline_darkness(gray, expected, style)
    best_distance = 0.0
    best_dx = best_dy = 0
    integer_limit = math.ceil(style.center_tolerance)
    for dy in range(-integer_limit, integer_limit + 1):
        for dx in range(-integer_limit, integer_limit + 1):
            candidate_distance = math.hypot(dx, dy)
            if candidate_distance > style.center_tolerance or (dx == 0 and dy == 0):
                continue
            center = (expected[0] + dx, expected[1] + dy)
            score = outline_darkness(gray, center, style)
            better = score > best_score + 1e-9 or (
                abs(score - best_score) <= 1e-9
                and (
                    candidate_distance < best_distance
                    or (
                        candidate_distance == best_distance
                        and (dy < best_dy or (dy == best_dy and dx < best_dx))
                    )
                )
            )
            if better:
                best_center, best_score, best_distance = center, score, candidate_distance
                best_dx, best_dy = dx, dy
    return best_center, best_dx, best_dy


def focus_score(gray: np.ndarray, center: Point, roi_radius: float) -> float:
    left = math.floor(center[0] - roi_radius)
    top = math.floor(center[1] - roi_radius)
    right = math.ceil(center[0] + roi_radius)
    bottom = math.ceil(center[1] + roi_radius)
    laplacians: list[float] = []
    for y in range(top + 1, bottom - 1):
        for x in range(left + 1, right - 1):
            if (
                x <= 0
                or y <= 0
                or x >= gray.shape[1] - 1
                or y >= gray.shape[0] - 1
                or math.hypot(x - center[0], y - center[1]) > roi_radius - 1
            ):
                continue
            laplacians.append(
                float(gray[y, x - 1])
                + float(gray[y, x + 1])
                + float(gray[y - 1, x])
                + float(gray[y + 1, x])
                - 4 * float(gray[y, x])
            )
    return 0.0 if not laplacians else float(np.var(laplacians)) / (255**2)


def confidence_for(decision: Decision, ratio: float, config: DetectorConfig) -> float:
    if decision == "unfilled":
        return max(0.0, 1 - ratio / config.unfilled_max_ratio)
    if decision == "filled":
        return max(0.0, (ratio - config.filled_min_ratio) / (1 - config.filled_min_ratio))
    band_width = config.filled_min_ratio - config.unfilled_max_ratio
    nearest = min(abs(ratio - config.unfilled_max_ratio), abs(config.filled_min_ratio - ratio))
    return min(0.49, nearest / max(band_width, sys.float_info.epsilon))


def analyze_bubbles(canonical: np.ndarray, schema: Schema, config: DetectorConfig) -> list[BubbleDiagnostic]:
    # Match rgbaPixelsToGrayscaleImage rather than OpenCV's BT.601 conversion.
    # The app uses rounded BT.709 luminance: R*.2126 + G*.7152 + B*.0722.
    blue, green, red = cv2.split(canonical)
    gray = np.floor(
        red.astype(np.float64) * 0.2126
        + green.astype(np.float64) * 0.7152
        + blue.astype(np.float64) * 0.0722
        + 0.5
    ).astype(np.uint8)
    diagnostics: list[BubbleDiagnostic] = []
    for question in schema.questions:
        for bubble in question.bubbles:
            center, dx, dy = measured_center(gray, bubble.center, schema.style)
            background, background_incomplete = circle_samples(
                gray,
                center,
                schema.style.background_inner,
                schema.style.background_outer,
            )
            background_mean = float(background.mean()) if len(background) else 0.0
            dark_cutoff = background_mean - config.dark_pixel_delta * 255
            interior, interior_incomplete = circle_samples(
                gray, center, 0.0, schema.style.fill_radius
            )
            interior_mean = float(interior.mean()) if len(interior) else 0.0
            background_brightness = background_mean / 255
            interior_brightness = interior_mean / 255
            dark_ratio = float(np.count_nonzero(interior <= dark_cutoff) / len(interior)) if len(interior) else 0.0
            contrast = (background_mean - interior_mean) / 255
            focus = focus_score(gray, bubble.center, schema.style.roi_radius)
            reasons: list[str] = []
            if dx or dy:
                reasons.append("center_adjusted")
            if interior_incomplete or background_incomplete or not len(interior) or not len(background):
                reasons.append("measurement_region_incomplete")
            if background_brightness < config.minimum_background_brightness or (
                dark_ratio > config.unfilled_max_ratio
                and contrast < config.minimum_marked_contrast
            ):
                reasons.append("poor_local_contrast")
            if focus < config.minimum_focus_score:
                reasons.append("excessive_blur")
            if dark_ratio <= config.unfilled_max_ratio:
                decision: Decision = "unfilled"
            elif dark_ratio >= config.filled_min_ratio:
                decision = "filled"
            else:
                decision = "uncertain"
                reasons.append("fill_score_in_uncertain_band")
            if any(
                reason in {
                    "measurement_region_incomplete",
                    "poor_local_contrast",
                    "excessive_blur",
                }
                for reason in reasons
            ):
                decision = "uncertain"
            confidence = confidence_for(decision, dark_ratio, config)
            if decision == "uncertain":
                confidence = min(0.49, confidence)
            diagnostics.append(
                BubbleDiagnostic(
                    question.id,
                    bubble.id,
                    bubble.center,
                    center,
                    dx,
                    dy,
                    dark_cutoff,
                    interior_brightness,
                    background_brightness,
                    dark_ratio,
                    contrast,
                    focus,
                    confidence,
                    decision,
                    reasons,
                )
            )
    return diagnostics


def grade_questions(
    schema: Schema, diagnostics: Sequence[BubbleDiagnostic]
) -> list[QuestionResult]:
    by_question = {
        question.id: [item for item in diagnostics if item.question_id == question.id]
        for question in schema.questions
    }
    results: list[QuestionResult] = []
    for question in schema.questions:
        items = by_question[question.id]
        filled = {item.bubble_id for item in items if item.decision == "filled"}
        uncertain_items = [item for item in items if item.decision == "uncertain"]
        uncertain = {item.bubble_id for item in uncertain_items}
        correct = set(question.correct_ids)
        missing = correct - filled
        extra = filled - correct
        uncertainty_can_match = not extra and missing.issubset(uncertain)
        reasons: list[str] = []
        if uncertain_items and uncertainty_can_match:
            status: QuestionStatus = "needs_review"
            relevant = uncertain_items
            reasons.append("uncertain bubbles could change exact match")
        elif filled == correct:
            status = "correct"
            relevant = items
            reasons.append("exact set match")
        else:
            status = "incorrect"
            if not filled and not uncertain:
                reasons.append("blank response")
            clear_missing = missing - uncertain
            if clear_missing:
                reasons.append("missing " + ", ".join(sorted(clear_missing)))
            if extra:
                reasons.append("extra " + ", ".join(sorted(extra)))
            relevant = [item for item in items if item.bubble_id in clear_missing | extra]
        confidence = min((item.confidence for item in relevant), default=1.0)
        results.append(
            QuestionResult(
                question.label,
                question.points,
                tuple(sorted(filled)),
                question.correct_ids,
                status,
                confidence,
                reasons,
            )
        )
    return results


def process_frame(
    raw: np.ndarray,
    rotation: str,
    analysis_width: int,
    analysis_height: int,
    schema: Schema,
    config: DetectorConfig,
) -> tuple[FramePipeline, str]:
    started = time.perf_counter()
    portrait, resolved_rotation = rotate_for_portrait(raw, rotation)
    analysis = resize_cover(portrait, analysis_width, analysis_height)
    regions = create_marker_regions(analysis_width, analysis_height)
    debug = tuple(analyze_region(analysis, region) for region in regions)
    layout = select_best_layout(debug, regions)
    canonical = None
    qr_text = None
    qr_rotation = 0
    bubbles: list[BubbleDiagnostic] = []
    questions: list[QuestionResult] = []
    if layout:
        canonical = warp_canonical(portrait, layout, analysis_width, analysis_height, schema)
        qr_text, qr_rotation = read_qr(canonical, schema)
        if qr_rotation == 180:
            canonical = cv2.rotate(canonical, cv2.ROTATE_180)
        bubbles = analyze_bubbles(canonical, schema, config)
        questions = grade_questions(schema, bubbles)
    elapsed = (time.perf_counter() - started) * 1000
    return (
        FramePipeline(
            raw,
            portrait,
            analysis,
            regions,
            debug,  # type: ignore[arg-type]
            layout,
            canonical,
            qr_text,
            qr_rotation,
            bubbles,
            questions,
            elapsed,
        ),
        resolved_rotation,
    )


def as_bgr(image: np.ndarray) -> np.ndarray:
    return cv2.cvtColor(image, cv2.COLOR_GRAY2BGR) if image.ndim == 2 else image.copy()


def integer_points(points: Iterable[Point]) -> np.ndarray:
    return np.asarray([[round(point[0]), round(point[1])] for point in points], dtype=np.int32)


def draw_text(
    image: np.ndarray,
    text: str,
    origin: tuple[int, int],
    color: tuple[int, int, int] = COLORS["white"],
    scale: float = 0.48,
    thickness: int = 1,
) -> None:
    cv2.putText(image, text, origin, cv2.FONT_HERSHEY_SIMPLEX, scale, (0, 0, 0), thickness + 2, cv2.LINE_AA)
    cv2.putText(image, text, origin, cv2.FONT_HERSHEY_SIMPLEX, scale, color, thickness, cv2.LINE_AA)


def overlay_regions(image: np.ndarray, regions: Sequence[Region], matched: Sequence[bool] | None = None) -> np.ndarray:
    output = image.copy()
    for index, region in enumerate(regions):
        color = COLORS["green"] if matched and matched[index] else COLORS["white"]
        cv2.rectangle(output, (region.x, region.y), (region.x + region.width, region.y + region.height), color, 2)
        draw_text(output, region.position, (region.x + 4, region.y + 18), color, 0.42)
    return output


def compose_stage_images(pipeline: FramePipeline, schema: Schema, config: DetectorConfig) -> list[tuple[str, str, np.ndarray]]:
    matched = [bool(debug.candidates) for debug in pipeline.region_debug]
    analysis_regions = overlay_regions(pipeline.analysis, pipeline.regions, matched)

    gray_full = cv2.cvtColor(pipeline.analysis, cv2.COLOR_BGR2GRAY)
    blur_full = gray_full.copy()
    threshold_full = np.zeros_like(gray_full)
    contour_view = pipeline.analysis.copy()
    candidate_view = pipeline.analysis.copy()
    for region, debug in zip(pipeline.regions, pipeline.region_debug):
        blur_full[region.y : region.y + region.height, region.x : region.x + region.width] = debug.blurred
        threshold_full[region.y : region.y + region.height, region.x : region.x + region.width] = debug.thresholded
        local_contours = [contour + np.array([[[region.x, region.y]]]) for contour in debug.contours]
        rejected = [contour + np.array([[[region.x, region.y]]]) for contour in debug.qr_rejected]
        cv2.drawContours(contour_view, local_contours, -1, COLORS["muted"], 1)
        cv2.drawContours(contour_view, rejected, -1, COLORS["magenta"], 2)
        for rank, candidate in enumerate(debug.candidates, start=1):
            color = COLORS["green"] if rank == 1 else COLORS["orange"]
            cv2.polylines(candidate_view, [integer_points(candidate.marker.corners)], True, color, 2)
            draw_text(candidate_view, f"{rank}:{candidate.appearance_score:.2f}", tuple(integer_points([candidate.marker.center])[0]), color, 0.36)

    selected_view = candidate_view.copy()
    if pipeline.layout:
        cv2.polylines(selected_view, [integer_points(pipeline.layout.crop)], True, COLORS["cyan"], 3)
        for marker in pipeline.layout.markers:
            cv2.polylines(selected_view, [integer_points(marker.corners)], True, COLORS["green"], 3)
    else:
        draw_text(selected_view, "BLOCKED: four candidates do not form a valid portrait page", (16, 32), COLORS["red"], 0.52, 2)

    if pipeline.canonical is None:
        blocked = pipeline.analysis.copy()
        cv2.rectangle(blocked, (0, 0), (blocked.shape[1], blocked.shape[0]), (10, 14, 20), -1)
        draw_text(blocked, "WAITING FOR VALID 4-MARKER LAYOUT", (20, blocked.shape[0] // 2), COLORS["orange"], 0.58, 2)
        canonical_view = center_view = measurement_view = answers_view = blocked
    else:
        canonical_view = pipeline.canonical.copy()
        for index, (x, y, width, height) in enumerate(expanded_qr_regions(schema)):
            cv2.rectangle(canonical_view, (x, y), (x + width, y + height), COLORS["magenta"], 3)
            draw_text(canonical_view, f"QR search {index + 1}", (x, max(18, y - 5)), COLORS["magenta"], 0.5, 2)
        if pipeline.qr_text:
            draw_text(canonical_view, "QR decoded", (18, schema.height - 20), COLORS["green"], 0.62, 2)
        else:
            draw_text(canonical_view, "QR not decoded (grading still uses fixed schema)", (18, schema.height - 20), COLORS["orange"], 0.52, 2)

        center_view = pipeline.canonical.copy()
        measurement_view = pipeline.canonical.copy()
        for item in pipeline.bubbles:
            expected = tuple(map(round, item.expected_center))
            measured = tuple(map(round, item.measured_center))
            cv2.circle(center_view, expected, round(schema.style.roi_radius), COLORS["cyan"], 1)
            cv2.circle(center_view, expected, 2, COLORS["cyan"], -1)
            cv2.circle(center_view, measured, round(schema.style.radius), COLORS["yellow"], 2)
            cv2.line(center_view, expected, measured, COLORS["magenta"], 1)
            decision_color = {
                "filled": COLORS["green"],
                "unfilled": COLORS["blue"],
                "uncertain": COLORS["orange"],
            }[item.decision]
            cv2.circle(measurement_view, measured, round(schema.style.fill_radius), decision_color, -1)
            cv2.circle(measurement_view, measured, round(schema.style.background_inner), COLORS["yellow"], 1)
            cv2.circle(measurement_view, measured, round(schema.style.background_outer), COLORS["yellow"], 1)
            draw_text(measurement_view, f"{item.dark_pixel_ratio:.2f}", (measured[0] + 10, measured[1] - 5), decision_color, 0.36)

        answers_view = pipeline.canonical.copy()
        dim = np.full_like(answers_view, (12, 18, 26))
        answers_view = cv2.addWeighted(answers_view, 0.15, dim, 0.85, 0)
        y = 42
        awarded = pending = maximum = 0
        for result in pipeline.questions:
            maximum += result.points
            if result.status == "correct":
                awarded += result.points
            elif result.status == "needs_review":
                pending += result.points
            color = {
                "correct": COLORS["green"],
                "incorrect": COLORS["red"],
                "needs_review": COLORS["orange"],
            }[result.status]
            selected = ",".join(item.rsplit("-", 1)[-1] for item in result.selected) or "blank"
            expected = ",".join(item.rsplit("-", 1)[-1] for item in result.correct)
            draw_text(answers_view, f"{result.label:<12} {result.status:<12} picked {selected} / key {expected}", (24, y), color, 0.52, 2)
            y += 38
        draw_text(answers_view, f"SCORE {awarded}/{maximum}   PENDING {pending}", (24, min(schema.height - 30, y + 28)), COLORS["white"], 0.75, 2)

    raw_caption = f"{pipeline.raw.shape[1]}x{pipeline.raw.shape[0]} (unmodified capture)"
    return [
        ("01  RAW CONTINUITY CAMERA", raw_caption, pipeline.raw),
        ("02  ROTATE TO PORTRAIT", f"physical orientation before detection", pipeline.portrait),
        ("03  COVER RESIZE + 4 ROIs", f"420-style preview; {sum(matched)}/4 regions have candidates", analysis_regions),
        ("04  GRAYSCALE", "BGR -> 8-bit luminance", gray_full),
        ("05  GAUSSIAN BLUR", "3x3 kernel inside each marker ROI", blur_full),
        ("06  ADAPTIVE THRESHOLD", "Gaussian C, binary inverse, block=21, C=7", threshold_full),
        ("07  CONTOURS + HIERARCHY", "gray=contours; magenta=QR-like nested families", contour_view),
        ("08  MARKERS + PAGE LAYOUT", f"top 4/ROI, whole-page geometry; score={pipeline.layout.score:.3f}" if pipeline.layout else "candidate appearance + full-page validation", selected_view),
        ("09  PERSPECTIVE + QR", f"fixed {schema.width}x{schema.height}; QR rotation={pipeline.qr_rotation}deg", canonical_view),
        ("10  CENTER SEARCH", f"cyan=expected ROI; yellow=best outline center; tolerance={schema.style.center_tolerance:g}px", center_view),
        ("11  LOCAL MEASUREMENTS", f"fill disk + paper ring; empty <= {config.unfilled_max_ratio:.2f}, filled >= {config.filled_min_ratio:.2f}", measurement_view),
        ("12  EXACT-SET ANSWERS", "filled IDs must exactly equal the key; uncertainty may defer", answers_view),
    ]


def letterbox(image: np.ndarray, width: int, height: int) -> np.ndarray:
    image = as_bgr(image)
    source_height, source_width = image.shape[:2]
    scale = min(width / source_width, height / source_height)
    target_width = max(1, round(source_width * scale))
    target_height = max(1, round(source_height * scale))
    interpolation = cv2.INTER_AREA if scale < 1 else cv2.INTER_LINEAR
    resized = cv2.resize(image, (target_width, target_height), interpolation=interpolation)
    canvas = np.full((height, width, 3), COLORS["panel"], dtype=np.uint8)
    left = (width - target_width) // 2
    top = (height - target_height) // 2
    canvas[top : top + target_height, left : left + target_width] = resized
    return canvas


def make_dashboard(
    stages: Sequence[tuple[str, str, np.ndarray]],
    width: int,
    height: int,
    pipeline: FramePipeline,
    paused: bool,
    rotation: str,
    detector_id: str,
) -> np.ndarray:
    columns, rows = 4, 3
    header_height, footer_height = 48, 30
    grid_height = height - header_height - footer_height
    cell_width, cell_height = width // columns, grid_height // rows
    title_height = 42
    dashboard = np.full((height, width, 3), (10, 14, 20), dtype=np.uint8)
    for index, (title, subtitle, image) in enumerate(stages):
        column, row = index % columns, index // columns
        left, top = column * cell_width, header_height + row * cell_height
        panel = letterbox(image, cell_width - 4, cell_height - title_height - 4)
        dashboard[top + title_height : top + cell_height - 4, left + 2 : left + cell_width - 2] = panel
        cv2.rectangle(dashboard, (left + 2, top + 2), (left + cell_width - 2, top + title_height), COLORS["panel_alt"], -1)
        draw_text(dashboard, title, (left + 12, top + 19), COLORS["white"], 0.47, 2)
        draw_text(dashboard, subtitle, (left + 12, top + 36), COLORS["muted"], 0.34)
        cv2.rectangle(dashboard, (left, top), (left + cell_width - 1, top + cell_height - 1), (49, 61, 78), 1)

    status = "PAUSED" if paused else "LIVE"
    status_color = COLORS["orange"] if paused else COLORS["green"]
    draw_text(dashboard, f"{status}  |  {pipeline.elapsed_ms:.1f} ms/frame  |  rotation: {rotation}", (14, 31), status_color, 0.61, 2)
    draw_text(dashboard, "q quit   space pause   r rotate   s save dashboard   f fullscreen", (width - 575, 31), COLORS["muted"], 0.43)
    draw_text(dashboard, detector_id, (14, height - 10), COLORS["muted"], 0.35)
    draw_text(dashboard, "Live twin: app samples every 2nd frame, confirms twice; QR uses jsQR", (width - 495, height - 10), COLORS["muted"], 0.35)
    return dashboard


class FrameSource:
    def __init__(self, camera: int, input_path: Path | None, requested_width: int, requested_height: int):
        self.image: np.ndarray | None = None
        self.capture: cv2.VideoCapture | None = None
        self.finite = input_path is not None
        if input_path:
            suffix = input_path.suffix.lower()
            if suffix in {".png", ".jpg", ".jpeg", ".bmp", ".tif", ".tiff", ".webp"}:
                self.image = cv2.imread(str(input_path), cv2.IMREAD_COLOR)
                if self.image is None:
                    raise SystemExit(f"Could not read image: {input_path}")
            else:
                self.capture = cv2.VideoCapture(str(input_path))
        else:
            backend = cv2.CAP_AVFOUNDATION if platform.system() == "Darwin" else cv2.CAP_ANY
            self.capture = cv2.VideoCapture(camera, backend)
            self.capture.set(cv2.CAP_PROP_FRAME_WIDTH, requested_width)
            self.capture.set(cv2.CAP_PROP_FRAME_HEIGHT, requested_height)
            self.capture.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        if self.capture is not None and not self.capture.isOpened():
            raise SystemExit(
                f"Could not open {'camera ' + str(camera) if not input_path else input_path}. "
                "On macOS, allow camera access for Terminal/Python and try --camera 1 or 2."
            )

    def read(self) -> np.ndarray | None:
        if self.image is not None:
            return self.image.copy()
        assert self.capture is not None
        ok, frame = self.capture.read()
        return frame if ok else None

    @property
    def still(self) -> bool:
        return self.image is not None

    def close(self) -> None:
        if self.capture is not None:
            self.capture.release()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Show every live stage of the current marker/crop/bubble grading pipeline."
    )
    parser.add_argument("--camera", type=int, default=0, help="OpenCV camera index (default: 0)")
    parser.add_argument("--input", type=Path, help="Use an image or video instead of a camera")
    parser.add_argument(
        "--rotation",
        choices=("auto", "clockwise", "counterclockwise", "180", "none"),
        default="auto",
        help="Continuity Camera correction; auto rotates landscape clockwise",
    )
    parser.add_argument("--mirror", action="store_true", help="Horizontally mirror the portrait frame")
    parser.add_argument("--camera-width", type=int, default=1920)
    parser.add_argument("--camera-height", type=int, default=1080)
    parser.add_argument("--analysis-width", type=int, default=420)
    parser.add_argument("--analysis-height", type=int, default=747)
    parser.add_argument("--window-width", type=int, default=1920)
    parser.add_argument("--window-height", type=int, default=1080)
    parser.add_argument("--fullscreen", action="store_true")
    parser.add_argument("--schema", type=Path, default=DEFAULT_SCHEMA_PATH)
    parser.add_argument("--contract", type=Path, default=DEFAULT_CONTRACT_PATH)
    parser.add_argument("--config", type=Path, default=DEFAULT_CONFIG_PATH)
    parser.add_argument("--save-dir", type=Path, default=ROOT / "tools/pipeline-captures")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    schema, config = load_runtime_contract(args.schema, args.contract, args.config)
    source = FrameSource(args.camera, args.input, args.camera_width, args.camera_height)
    cv2.namedWindow(WINDOW_NAME, cv2.WINDOW_NORMAL)
    cv2.resizeWindow(WINDOW_NAME, args.window_width, args.window_height)
    fullscreen = args.fullscreen
    if fullscreen:
        cv2.setWindowProperty(WINDOW_NAME, cv2.WND_PROP_FULLSCREEN, cv2.WINDOW_FULLSCREEN)

    rotation_modes = ["auto", "clockwise", "counterclockwise", "180", "none"]
    rotation = args.rotation
    paused = False
    last_raw: np.ndarray | None = None
    last_dashboard: np.ndarray | None = None
    last_pipeline: FramePipeline | None = None
    try:
        while True:
            if not paused or last_raw is None:
                raw = source.read()
                if raw is None:
                    if source.finite:
                        break
                    continue
                last_raw = raw
            else:
                raw = last_raw
            if args.mirror:
                raw = cv2.flip(raw, 1)
            pipeline, resolved_rotation = process_frame(
                raw,
                rotation,
                args.analysis_width,
                args.analysis_height,
                schema,
                config,
            )
            stages = compose_stage_images(pipeline, schema, config)
            dashboard = make_dashboard(
                stages,
                args.window_width,
                args.window_height,
                pipeline,
                paused,
                resolved_rotation,
                config.detector_id,
            )
            last_pipeline = pipeline
            last_dashboard = dashboard
            cv2.imshow(WINDOW_NAME, dashboard)
            if cv2.getWindowProperty(WINDOW_NAME, cv2.WND_PROP_VISIBLE) < 1:
                break
            key = cv2.waitKey(0 if source.still and not paused else 1) & 0xFF
            if key in (ord("q"), 27):
                break
            if key == ord(" "):
                paused = not paused
            elif key == ord("r"):
                rotation = rotation_modes[(rotation_modes.index(rotation) + 1) % len(rotation_modes)]
            elif key == ord("f"):
                fullscreen = not fullscreen
                cv2.setWindowProperty(
                    WINDOW_NAME,
                    cv2.WND_PROP_FULLSCREEN,
                    cv2.WINDOW_FULLSCREEN if fullscreen else cv2.WINDOW_NORMAL,
                )
            elif key == ord("s") and last_dashboard is not None:
                args.save_dir.mkdir(parents=True, exist_ok=True)
                stamp = time.strftime("%Y%m%d-%H%M%S")
                dashboard_path = args.save_dir / f"pipeline-{stamp}.png"
                cv2.imwrite(str(dashboard_path), last_dashboard)
                if last_pipeline and last_pipeline.canonical is not None:
                    cv2.imwrite(str(args.save_dir / f"canonical-{stamp}.png"), last_pipeline.canonical)
                print(f"Saved {dashboard_path}")
    finally:
        source.close()
        cv2.destroyAllWindows()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
