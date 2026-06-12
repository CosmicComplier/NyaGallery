from __future__ import annotations

from dataclasses import dataclass, field
import json
from math import gcd
from pathlib import Path
import re
import shlex
import unicodedata
from collections.abc import Mapping, Sequence


CANONICAL_TAG_RE = re.compile(r"^[a-z][a-z0-9_]*:[\w.+-]+$", re.UNICODE)
TAG_CATEGORY_SEPARATOR_RE = re.compile(r"[^a-z0-9_]+")
TAG_BODY_SEPARATOR_RE = re.compile(r"[^\w.+-]+", re.UNICODE)
TAG_CATEGORY_ORDER = {
    "artist": 10,
    "uploader": 10,
    "source": 15,
    "character": 20,
    "series": 30,
    "type": 35,
    "clothing": 40,
    "source_tag": 45,
    "rating": 50,
    "date": 80,
    "meta": 90,
    "general": 100,
}
COMMON_ASPECT_RATIOS = (
    (1, 1),
    (16, 9),
    (9, 16),
    (16, 10),
    (10, 16),
    (21, 9),
    (9, 21),
    (4, 3),
    (3, 4),
    (3, 2),
    (2, 3),
    (5, 4),
    (4, 5),
    (2, 1),
    (1, 2),
)
ASPECT_RATIO_TOLERANCE = 0.035
WALLPAPER_MIN_LONG_EDGE = 1200
WALLPAPER_MIN_SHORT_EDGE = 700
WALLPAPER_TAGS = frozenset({"meta:landscape_wallpaper", "meta:portrait_wallpaper"})
HIDDEN_TAG = "meta:hide"
SOURCE_TAG_CATEGORY = "source_tag"
SOURCE_TAG_DETAILS_EXTRA_KEYS = ("source_tag_details", "pixiv_tag_details")
DEFAULT_LABEL_LOCALE = "zh-CN"
ENGLISH_LABEL_LOCALE = "en-US"


class TagError(ValueError):
    pass


class TagAlreadyExistsError(TagError):
    pass


class TagNotFoundError(TagError):
    pass


class InvalidTagNameError(TagError):
    pass


class InvalidTagRelationError(TagError):
    pass


def normalize_name(value: str) -> str:
    return unicodedata.normalize("NFKC", value.strip()).casefold()


def canonical_tag_name(name: str) -> str:
    canonical = normalize_name(name)
    if ":" not in canonical:
        raise InvalidTagNameError(f"invalid canonical tag name: {name}")
    category, body = canonical.split(":", 1)
    category = TAG_CATEGORY_SEPARATOR_RE.sub("_", category).strip("_")
    body = TAG_BODY_SEPARATOR_RE.sub("_", body).strip("._-")
    canonical = f"{category}:{body}"
    if not CANONICAL_TAG_RE.fullmatch(canonical):
        raise InvalidTagNameError(f"invalid canonical tag name: {name}")
    return canonical


def derived_identity_tag(category: str, value: str | None) -> str | None:
    if not value or not value.strip():
        return None
    try:
        return canonical_tag_name(f"{category}:{value}")
    except InvalidTagNameError:
        return None


def tag_category_name(tag: str) -> str:
    return tag.split(":", 1)[0] if ":" in tag else "general"


def tag_sort_key(tag: str) -> tuple[int, str, str]:
    category = tag_category_name(tag)
    return (TAG_CATEGORY_ORDER.get(category, TAG_CATEGORY_ORDER["general"]), category, tag)


def is_hidden_tag(tag: str) -> bool:
    try:
        canonical = canonical_tag_name(tag)
    except InvalidTagNameError:
        return False
    category, body = canonical.split(":", 1)
    return category == "meta" and (
        body == "hide"
        or body.startswith("hide_")
        or body.startswith("hide-")
    )


def orientation_tag(width: int | None, height: int | None) -> str | None:
    if not width or not height or width <= 0 or height <= 0:
        return None
    if width > height:
        return "meta:landscape"
    if height > width:
        return "meta:portrait"
    return "meta:square"


def aspect_tags(width: int | None, height: int | None, *, is_animated: bool = False) -> set[str]:
    if not width or not height or width <= 0 or height <= 0:
        return set()

    tags = {orientation_tag(width, height)}
    common = _closest_common_aspect(width, height)
    if common:
        tags.add(_aspect_tag(*common))
    else:
        tags.add("meta:unusual_aspect")

    if not is_animated:
        if _is_landscape_wallpaper(width, height):
            tags.add("meta:landscape_wallpaper")
        if _is_portrait_wallpaper(width, height):
            tags.add("meta:portrait_wallpaper")

    return {tag for tag in tags if tag}


def date_tags(artwork_date: str | None) -> set[str]:
    if not artwork_date:
        return set()
    match = re.match(r"^(\d{4})-(\d{2})-(\d{2})$", artwork_date.strip())
    if not match:
        return set()
    year, month, day = match.groups()
    return {
        f"date:{year}",
        f"date:{year}_{month}",
        f"date:{year}_{month}_{day}",
    }


def metadata_tags(
    *,
    source: str = "",
    artwork_date: str | None = None,
    source_type: str | None = None,
    age_rating: str | None = None,
    is_ai_generated: bool | None = None,
    is_animated: bool | None = None,
) -> set[str]:
    tags = set(date_tags(artwork_date))
    for category, value in (("source", source), ("type", source_type), ("rating", age_rating)):
        tag = derived_identity_tag(category, value)
        if tag:
            tags.add(tag)
    if is_ai_generated:
        tags.add("meta:ai_generated")
    if is_animated:
        tags.add("meta:animated")
    return tags


def source_tag_name(name: str, translated_name: str | None = None) -> str:
    basis = translated_name.strip() if translated_name and translated_name.strip() else name
    return canonical_tag_name(f"{SOURCE_TAG_CATEGORY}:{basis}")


def source_tag_details_from_extra(extra: Mapping[str, object] | None) -> tuple[dict[str, str | None], ...]:
    if not isinstance(extra, Mapping):
        return ()
    items: list[dict[str, str | None]] = []
    for key in SOURCE_TAG_DETAILS_EXTRA_KEYS:
        raw_items = extra.get(key)
        if not _is_sequence(raw_items):
            continue
        items.extend(_source_tag_inputs((), raw_items))
    return _dedupe_source_tag_details(items)


def _source_tag_labels(name: str, translated_name: str | None = None) -> dict[str, str]:
    raw_name = name.strip()
    translated = translated_name.strip() if translated_name and translated_name.strip() else ""
    labels: dict[str, str] = {}
    if raw_name:
        labels[DEFAULT_LABEL_LOCALE] = raw_name
    if translated:
        labels[ENGLISH_LABEL_LOCALE] = translated
    return labels


def _normalize_labels(labels: object) -> dict[str, str]:
    if not isinstance(labels, Mapping):
        return {}
    normalized: dict[str, str] = {}
    for locale, label in labels.items():
        locale_name = str(locale).strip()
        text = str(label).strip()
        if locale_name and text:
            normalized[locale_name] = text
    return normalized


def _merge_missing_labels(target: dict[str, str], labels: Mapping[str, str]) -> None:
    for locale, label in labels.items():
        if locale not in target and label.strip():
            target[locale] = label.strip()


@dataclass(frozen=True)
class TagCategory:
    name: str
    color: str
    order: int
    is_default: bool = False


@dataclass
class CanonicalTag:
    name: str
    category: str
    aliases: set[str] = field(default_factory=set)
    labels: dict[str, str] = field(default_factory=dict)
    implications: set[str] = field(default_factory=set)
    suggestions: set[str] = field(default_factory=set)
    description: str | None = None

    @property
    def names(self) -> list[str]:
        return [self.name, *sorted(self.aliases, key=normalize_name)]

    def to_dict(self) -> dict[str, object]:
        data: dict[str, object] = {
            "name": self.name,
            "category": self.category,
            "aliases": sorted(self.aliases, key=normalize_name),
            "labels": dict(sorted(self.labels.items())),
            "implications": sorted(self.implications),
            "suggestions": sorted(self.suggestions),
        }
        if self.description:
            data["description"] = self.description
        return data


@dataclass(frozen=True)
class SearchQuery:
    required: frozenset[str] = frozenset()
    excluded: frozenset[str] = frozenset()
    unknown_required: frozenset[str] = frozenset()
    filename_required: frozenset[str] = frozenset()
    filename_excluded: frozenset[str] = frozenset()
    exclude_hidden: bool = False

    def matches(self, tags: set[str] | frozenset[str], filename: str = "") -> bool:
        if self.unknown_required:
            return False
        if self.exclude_hidden and any(is_hidden_tag(tag) for tag in tags):
            return False
        normalized_filename = normalize_name(filename)
        return (
            self.required.issubset(tags)
            and self.excluded.isdisjoint(tags)
            and all(normalize_name(term) in normalized_filename for term in self.filename_required)
            and all(normalize_name(term) not in normalized_filename for term in self.filename_excluded)
        )


class TagCatalog:
    """Szurubooru-style tag catalog: categories, aliases, suggestions, implications."""

    def __init__(self) -> None:
        self.categories: dict[str, TagCategory] = {}
        self.tags: dict[str, CanonicalTag] = {}
        self._name_index: dict[str, str] = {}

    @classmethod
    def default(cls) -> "TagCatalog":
        catalog = cls()
        defaults = [
            TagCategory("general", "#9ca3af", 100, True),
            TagCategory("artist", "#f59e0b", 10),
            TagCategory("uploader", "#f59e0b", 10),
            TagCategory("source", "#14b8a6", 15),
            TagCategory("character", "#22c55e", 20),
            TagCategory("series", "#3b82f6", 30),
            TagCategory("type", "#a855f7", 35),
            TagCategory("clothing", "#ec4899", 40),
            TagCategory(SOURCE_TAG_CATEGORY, "#06b6d4", 45),
            TagCategory("rating", "#ef4444", 50),
            TagCategory("date", "#64748b", 80),
            TagCategory("meta", "#8b5cf6", 90),
        ]
        for category in defaults:
            catalog.add_category(category)
        catalog.add_tag("source:pixiv")
        catalog.add_tag("source:upload")
        catalog.add_tag("type:illustration", aliases=("illust", "image"))
        catalog.add_tag("type:manga")
        catalog.add_tag("type:ugoira")
        catalog.add_tag("type:novel")
        catalog.add_tag("rating:safe")
        catalog.add_tag("rating:r18", aliases=("R-18", "R18", "r18"))
        catalog.add_tag("rating:r18g", aliases=("R-18G", "R18G", "r18g"))
        catalog.add_tag("meta:ai_generated", aliases=("AI", "AI generated"))
        catalog.add_tag("meta:hide", aliases=("hide", "hidden", "隐藏", "不显示"))
        catalog.add_tag("meta:animated", aliases=("动图", "动画", "animated"))
        catalog.add_tag("meta:landscape", aliases=("横屏", "横向"))
        catalog.add_tag("meta:portrait", aliases=("竖屏", "竖向"))
        catalog.add_tag("meta:square", aliases=("方形", "正方形"))
        catalog.add_tag("meta:unusual_aspect", aliases=("异形", "异形比例", "特殊比例"))
        catalog.add_tag("meta:landscape_wallpaper", aliases=("横屏壁纸", "横屏壁纸推荐", "桌面壁纸推荐"))
        catalog.add_tag("meta:portrait_wallpaper", aliases=("竖屏壁纸", "竖屏壁纸推荐", "手机壁纸推荐"))
        for width, height in COMMON_ASPECT_RATIOS:
            catalog.add_tag(_aspect_tag(width, height), aliases=(f"{width}:{height}", f"{width}x{height}"))
        return catalog

    def add_category(self, category: TagCategory) -> None:
        key = normalize_name(category.name)
        if key in self.categories:
            raise TagAlreadyExistsError(f"category already exists: {category.name}")
        if category.is_default:
            for existing_key, existing in list(self.categories.items()):
                self.categories[existing_key] = TagCategory(
                    existing.name,
                    existing.color,
                    existing.order,
                    False,
                )
        self.categories[key] = category

    def add_tag(
        self,
        name: str,
        *,
        aliases: list[str] | tuple[str, ...] = (),
        category: str | None = None,
        implications: list[str] | tuple[str, ...] = (),
        suggestions: list[str] | tuple[str, ...] = (),
        labels: Mapping[str, object] | None = None,
        description: str | None = None,
    ) -> CanonicalTag:
        canonical = self._canonical_name(name)
        category_name = normalize_name(category or canonical.split(":", 1)[0])
        self._ensure_category(category_name)

        if canonical in self.tags:
            raise TagAlreadyExistsError(f"tag already exists: {name}")
        self._ensure_names_available([canonical, *aliases], target_category=category_name)

        tag = CanonicalTag(
            name=canonical,
            category=category_name,
            aliases={alias for alias in aliases if alias.strip()},
            labels=_normalize_labels(labels),
            description=description,
        )
        self.tags[canonical] = tag
        for tag_name in tag.names:
            self._name_index[normalize_name(tag_name)] = canonical

        self.set_implications(canonical, implications)
        self.set_suggestions(canonical, suggestions)
        return tag

    def ensure_tag(self, name: str) -> CanonicalTag:
        canonical = self.resolve(name) or self._canonical_name(name)
        if canonical in self.tags:
            return self.tags[canonical]
        return self.add_tag(canonical)

    def add_alias(self, alias: str, canonical_name: str) -> None:
        canonical = self.require(canonical_name).name
        normalized_alias = normalize_name(alias)
        existing = self._name_index.get(normalized_alias)
        if existing and existing != canonical:
            if not self._release_source_alias(alias, self.tags[canonical].category):
                raise TagAlreadyExistsError(f"name already belongs to {existing}: {alias}")
        self.tags[canonical].aliases.add(alias)
        self._name_index[normalized_alias] = canonical

    def set_aliases(self, canonical_name: str, aliases: list[str] | tuple[str, ...]) -> CanonicalTag:
        canonical = self.require(canonical_name).name
        cleaned = [alias.strip() for alias in aliases if alias.strip()]
        normalized_seen: set[str] = set()
        unique_aliases: list[str] = []
        for alias in cleaned:
            normalized = normalize_name(alias)
            if normalized == normalize_name(canonical) or normalized in normalized_seen:
                continue
            existing = self._name_index.get(normalized)
            if existing and existing != canonical:
                if not self._release_source_alias(alias, self.tags[canonical].category):
                    raise TagAlreadyExistsError(f"name already belongs to {existing}: {alias}")
            normalized_seen.add(normalized)
            unique_aliases.append(alias)

        for alias in self.tags[canonical].aliases:
            self._name_index.pop(normalize_name(alias), None)
        self.tags[canonical].aliases = set(unique_aliases)
        for alias in self.tags[canonical].aliases:
            self._name_index[normalize_name(alias)] = canonical
        self._name_index[normalize_name(canonical)] = canonical
        return self.tags[canonical]

    def set_labels(self, canonical_name: str, labels: Mapping[str, object]) -> CanonicalTag:
        canonical = self.require(canonical_name).name
        self.tags[canonical].labels = _normalize_labels(labels)
        return self.tags[canonical]

    def add_aliases(self, canonical_name: str, aliases: list[str] | tuple[str, ...]) -> CanonicalTag:
        canonical = self.ensure_tag(canonical_name).name
        for alias in aliases:
            if alias.strip():
                self.add_alias(alias, canonical)
        return self.tags[canonical]

    def ensure_source_tag(self, name: str, translated_name: str | None = None) -> CanonicalTag | None:
        raw_name = name.strip()
        if not raw_name:
            return None
        try:
            canonical = source_tag_name(raw_name, translated_name)
        except InvalidTagNameError:
            return None
        tag = self.tags.get(canonical)
        if tag is None:
            tag = self.add_tag(canonical, category=SOURCE_TAG_CATEGORY)
        _merge_missing_labels(tag.labels, _source_tag_labels(raw_name, translated_name))
        for alias in (raw_name, translated_name or ""):
            alias = alias.strip()
            if not alias:
                continue
            normalized = normalize_name(alias)
            existing = self._name_index.get(normalized)
            if existing and existing != canonical:
                continue
            self.tags[canonical].aliases.add(alias)
            self._name_index[normalized] = canonical
        return self.tags[canonical]

    def set_implications(self, canonical_name: str, implications: list[str] | tuple[str, ...]) -> None:
        canonical = self.require(canonical_name).name
        resolved = {self.ensure_tag(name).name for name in implications}
        if canonical in resolved:
            raise InvalidTagRelationError("tag cannot imply itself")
        original = set(self.tags[canonical].implications)
        self.tags[canonical].implications = resolved
        if self._has_implication_cycle():
            self.tags[canonical].implications = original
            raise InvalidTagRelationError(f"implication cycle around {canonical}")

    def set_suggestions(self, canonical_name: str, suggestions: list[str] | tuple[str, ...]) -> None:
        canonical = self.require(canonical_name).name
        resolved = {self.ensure_tag(name).name for name in suggestions}
        if canonical in resolved:
            raise InvalidTagRelationError("tag cannot suggest itself")
        self.tags[canonical].suggestions = resolved

    def resolve(self, name: str) -> str | None:
        normalized = normalize_name(name)
        return self._name_index.get(normalized) or _hidden_alias_tag(normalized)

    def require(self, name: str) -> CanonicalTag:
        canonical = self.resolve(name)
        if canonical is None:
            raise TagNotFoundError(f"tag not found: {name}")
        if canonical not in self.tags and is_hidden_tag(canonical):
            return self.ensure_tag(canonical)
        return self.tags[canonical]

    def expand_implications(self, tag_names: set[str] | frozenset[str]) -> set[str]:
        expanded: set[str] = set()
        stack = list(tag_names)
        while stack:
            name = stack.pop()
            canonical = self.resolve(name)
            if canonical is None:
                try:
                    canonical = canonical_tag_name(name)
                except InvalidTagNameError:
                    continue
            if canonical in expanded:
                continue
            expanded.add(canonical)
            if canonical in self.tags:
                stack.extend(self.tags[canonical].implications)
        return expanded

    def canonicalize_tags(
        self,
        *,
        pixiv_tags: list[str] | tuple[str, ...] = (),
        source_tag_details: Sequence[Mapping[str, object]] = (),
        canonical_tags: list[str] | tuple[str, ...] = (),
        source: str = "",
        artist_name: str = "",
        uploader_username: str | None = None,
        width: int | None = None,
        height: int | None = None,
        artwork_date: str | None = None,
        source_type: str | None = None,
        age_rating: str | None = None,
        is_ai_generated: bool | None = None,
        is_animated: bool | None = None,
        mime_type: str | None = None,
    ) -> set[str]:
        resolved: set[str] = set()
        for raw_tag in pixiv_tags:
            canonical = self.resolve(raw_tag)
            if canonical:
                resolved.add(canonical)
        for detail in _source_tag_inputs(pixiv_tags, source_tag_details):
            tag = self.ensure_source_tag(detail["name"], detail["translated_name"])
            if tag:
                resolved.add(tag.name)
        for tag in canonical_tags:
            canonical = self.resolve(tag)
            if canonical:
                resolved.add(canonical)
        motion_asset = _is_motion_asset(
            source_type=source_type,
            mime_type=mime_type,
            is_animated=is_animated,
        )
        resolved.update(
            aspect_tags(
                width,
                height,
                is_animated=motion_asset,
            )
        )
        resolved.update(
            metadata_tags(
                source=source,
                artwork_date=artwork_date,
                source_type=source_type,
                age_rating=age_rating,
                is_ai_generated=is_ai_generated,
                is_animated=motion_asset,
            )
        )
        uploader_tag = derived_identity_tag("uploader", uploader_username)
        artist_tag = None
        if not _same_identity_name(artist_name, uploader_username):
            artist_tag = derived_identity_tag("artist", artist_name)
        for derived in (artist_tag, uploader_tag):
            if derived:
                resolved.add(self.resolve(derived) or derived)
        return self.expand_implications(resolved)

    def parse_query(self, query: str) -> SearchQuery:
        required: set[str] = set()
        excluded: set[str] = set()
        unknown_required: set[str] = set()
        filename_required: set[str] = set()
        filename_excluded: set[str] = set()
        for token in self._coalesce_query_tokens(shlex.split(query)):
            is_excluded = token.startswith("-") and len(token) > 1
            value = token[1:] if is_excluded else token
            filename_term = _filename_query_term(value)
            if filename_term is not None:
                if is_excluded:
                    filename_excluded.add(filename_term)
                else:
                    filename_required.add(filename_term)
                continue
            canonical = self.resolve(value)
            if canonical is None:
                try:
                    canonical = canonical_tag_name(value)
                except InvalidTagNameError:
                    canonical = None
            if canonical is None:
                if is_excluded:
                    filename_excluded.add(value)
                else:
                    filename_required.add(value)
                continue
            if is_excluded:
                excluded.add(canonical)
            else:
                required.add(canonical)
        if WALLPAPER_TAGS.intersection(required) and "meta:animated" not in required:
            excluded.add("meta:animated")
        exclude_hidden = False
        if not any(is_hidden_tag(tag) for tag in required):
            excluded.add(HIDDEN_TAG)
            exclude_hidden = True
        return SearchQuery(
            frozenset(required),
            frozenset(excluded),
            frozenset(unknown_required),
            frozenset(filename_required),
            frozenset(filename_excluded),
            exclude_hidden,
        )

    def _coalesce_query_tokens(self, tokens: list[str]) -> list[str]:
        coalesced: list[str] = []
        index = 0
        while index < len(tokens):
            raw = tokens[index]
            is_excluded = raw.startswith("-") and len(raw) > 1
            best_value: str | None = None
            best_end = index
            parts: list[str] = []

            for cursor in range(index, len(tokens)):
                candidate_raw = tokens[cursor]
                candidate_excluded = candidate_raw.startswith("-") and len(candidate_raw) > 1
                if candidate_excluded != is_excluded:
                    break

                value = candidate_raw[1:] if candidate_excluded else candidate_raw
                if _filename_query_term(value) is not None:
                    break

                parts.append(value)
                for candidate in _phrase_candidates(parts):
                    if self.resolve(candidate) is not None:
                        best_value = candidate
                        best_end = cursor

            if best_value is not None and best_end > index:
                coalesced.append(f"-{best_value}" if is_excluded else best_value)
                index = best_end + 1
                continue

            coalesced.append(raw)
            index += 1

        return coalesced

    def suggest(self, prefix: str, *, limit: int = 20) -> list[CanonicalTag]:
        needle = normalize_name(prefix)
        if not needle:
            return []
        matches: list[CanonicalTag] = []
        seen: set[str] = set()
        for normalized_name, canonical in self._name_index.items():
            if canonical in seen or needle not in normalized_name:
                continue
            seen.add(canonical)
            matches.append(self.tags[canonical])
        return sorted(matches, key=self._sort_key)[:limit]

    def to_dict(self) -> dict[str, object]:
        return {
            "categories": [
                {
                    "name": category.name,
                    "color": category.color,
                    "order": category.order,
                    "is_default": category.is_default,
                }
                for category in sorted(self.categories.values(), key=lambda item: item.order)
            ],
            "tags": [self.tags[name].to_dict() for name in sorted(self.tags)],
        }

    @classmethod
    def from_dict(cls, data: dict[str, object]) -> "TagCatalog":
        catalog = cls()
        for raw_category in data.get("categories", []):  # type: ignore[union-attr]
            category_data = dict(raw_category)  # type: ignore[arg-type]
            catalog.add_category(
                TagCategory(
                    name=str(category_data["name"]),
                    color=str(category_data.get("color") or "#9ca3af"),
                    order=int(category_data.get("order") or 100),
                    is_default=bool(category_data.get("is_default") or False),
                )
            )
        for raw_tag in data.get("tags", []):  # type: ignore[union-attr]
            tag_data = dict(raw_tag)  # type: ignore[arg-type]
            catalog.add_tag(
                str(tag_data["name"]),
                aliases=tuple(str(item) for item in tag_data.get("aliases", ())),
                category=str(tag_data.get("category") or str(tag_data["name"]).split(":", 1)[0]),
                labels=_normalize_labels(tag_data.get("labels")),
                description=tag_data.get("description"),  # type: ignore[arg-type]
            )
        for raw_tag in data.get("tags", []):  # type: ignore[union-attr]
            tag_data = dict(raw_tag)  # type: ignore[arg-type]
            name = str(tag_data["name"])
            catalog.set_implications(name, tuple(str(item) for item in tag_data.get("implications", ())))
            catalog.set_suggestions(name, tuple(str(item) for item in tag_data.get("suggestions", ())))
        return catalog

    def save(self, path: str | Path) -> None:
        target = Path(path)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(
            json.dumps(self.to_dict(), ensure_ascii=False, indent=2, sort_keys=True) + "\n",
            encoding="utf-8",
        )

    @classmethod
    def load(cls, path: str | Path) -> "TagCatalog":
        catalog = cls.from_dict(json.loads(Path(path).read_text(encoding="utf-8")))
        catalog.ensure_default_taxonomy()
        return catalog

    def ensure_default_taxonomy(self) -> None:
        defaults = self.default()
        for category in defaults.categories.values():
            if normalize_name(category.name) not in self.categories:
                self.add_category(category)
        for default_tag in defaults.tags.values():
            aliases = tuple(
                alias
                for alias in default_tag.aliases
                if normalize_name(alias) not in self._name_index
            )
            if default_tag.name not in self.tags:
                self.add_tag(
                    default_tag.name,
                    category=default_tag.category,
                    aliases=aliases,
                    implications=tuple(default_tag.implications),
                    suggestions=tuple(default_tag.suggestions),
                    labels=default_tag.labels,
                    description=default_tag.description,
                )
                continue
            _merge_missing_labels(self.tags[default_tag.name].labels, default_tag.labels)
            for alias in aliases:
                try:
                    self.add_alias(alias, default_tag.name)
                except TagAlreadyExistsError:
                    continue

    def _canonical_name(self, name: str) -> str:
        return canonical_tag_name(name)

    def _ensure_category(self, category_name: str) -> None:
        if category_name not in self.categories:
            default_order = max((category.order for category in self.categories.values()), default=0) + 10
            self.add_category(TagCategory(category_name, "#9ca3af", default_order))

    def _ensure_names_available(self, names: list[str], *, target_category: str) -> None:
        for name in names:
            normalized = normalize_name(name)
            existing = self._name_index.get(normalized)
            if existing and not self._release_source_alias(name, target_category):
                raise TagAlreadyExistsError(f"name already exists: {name}")

    def _release_source_alias(self, alias: str, target_category: str) -> bool:
        if normalize_name(target_category) == SOURCE_TAG_CATEGORY:
            return False
        normalized = normalize_name(alias)
        existing = self._name_index.get(normalized)
        if not existing or existing not in self.tags:
            return False
        if self.tags[existing].category != SOURCE_TAG_CATEGORY:
            return False
        if normalized == normalize_name(existing):
            return False
        self.tags[existing].aliases = {
            source_alias
            for source_alias in self.tags[existing].aliases
            if normalize_name(source_alias) != normalized
        }
        self._name_index.pop(normalized, None)
        return True

    def _has_implication_cycle(self) -> bool:
        visiting: set[str] = set()
        visited: set[str] = set()

        def visit(name: str) -> bool:
            if name in visiting:
                return True
            if name in visited:
                return False
            visiting.add(name)
            for child in self.tags[name].implications:
                if child in self.tags and visit(child):
                    return True
            visiting.remove(name)
            visited.add(name)
            return False

        return any(visit(name) for name in self.tags)

    def _sort_key(self, tag: CanonicalTag) -> tuple[int, str, str]:
        category = self.categories.get(normalize_name(tag.category))
        return (
            category.order if category else 999,
            tag.category,
            tag.name,
        )


def _same_identity_name(left: str | None, right: str | None) -> bool:
    return bool(left and right and normalize_name(left) == normalize_name(right))


def _is_motion_asset(
    *,
    source_type: str | None = None,
    mime_type: str | None = None,
    is_animated: bool | None = None,
) -> bool:
    if is_animated is not None:
        return is_animated
    if normalize_name(source_type or "") == "ugoira":
        return True
    normalized_mime = normalize_name(str(mime_type or "").split(";", 1)[0])
    return normalized_mime in {"application/zip", "image/apng", "image/gif"}


def _filename_query_term(value: str) -> str | None:
    if ":" not in value:
        return None
    prefix, term = value.split(":", 1)
    if normalize_name(prefix) not in {"filename", "file", "original_filename"}:
        return None
    cleaned = term.strip()
    return cleaned or None


def _hidden_alias_tag(value: str) -> str | None:
    normalized = normalize_name(value)
    try:
        if is_hidden_tag(normalized):
            return canonical_tag_name(normalized)
    except InvalidTagNameError:
        return None
    if normalized.startswith("/"):
        normalized = normalized[1:]
    if normalized == "hide":
        return HIDDEN_TAG
    for prefix in ("hide-", "hide_"):
        if normalized.startswith(prefix):
            suffix = normalized[len(prefix):]
            body = TAG_BODY_SEPARATOR_RE.sub("_", suffix).strip("._-")
            if body:
                return canonical_tag_name(f"meta:hide_{body}")
            return HIDDEN_TAG
    return None


def _source_tag_inputs(
    source_tags: Sequence[str],
    source_tag_details: Sequence[Mapping[str, object]],
) -> tuple[dict[str, str | None], ...]:
    items: list[dict[str, str | None]] = []
    if _is_sequence(source_tag_details):
        for detail in source_tag_details:
            if not isinstance(detail, Mapping):
                continue
            name = _optional_str(detail.get("name"))
            translated_name = _optional_str(detail.get("translated_name"))
            if name:
                items.append({"name": name, "translated_name": translated_name})
    if _is_sequence(source_tags):
        for raw_tag in source_tags:
            name = _optional_str(raw_tag)
            if name:
                items.append({"name": name, "translated_name": None})
    return _dedupe_source_tag_details(items)


def _dedupe_source_tag_details(
    items: Sequence[Mapping[str, str | None]],
) -> tuple[dict[str, str | None], ...]:
    deduped: dict[str, dict[str, str | None]] = {}
    for item in items:
        name = _optional_str(item.get("name"))
        if not name:
            continue
        translated_name = _optional_str(item.get("translated_name"))
        key = normalize_name(name)
        existing = deduped.get(key)
        if existing:
            if translated_name and not existing["translated_name"]:
                existing["translated_name"] = translated_name
            continue
        deduped[key] = {"name": name, "translated_name": translated_name}
    return tuple(deduped.values())


def _optional_str(value: object) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _is_sequence(value: object) -> bool:
    return isinstance(value, Sequence) and not isinstance(value, (str, bytes, bytearray))


def _phrase_candidates(parts: list[str]) -> tuple[str, ...]:
    if not parts:
        return ()
    return tuple(dict.fromkeys((" ".join(parts), "".join(parts), "_".join(parts))))


def _aspect_tag(width: int, height: int) -> str:
    return f"meta:aspect_{width}_{height}"


def _closest_common_aspect(width: int, height: int) -> tuple[int, int] | None:
    ratio = width / height
    best: tuple[float, tuple[int, int]] | None = None
    for common_width, common_height in COMMON_ASPECT_RATIOS:
        common_ratio = common_width / common_height
        distance = abs(ratio - common_ratio) / common_ratio
        if distance <= ASPECT_RATIO_TOLERANCE and (best is None or distance < best[0]):
            best = (distance, (common_width, common_height))
    if best:
        return best[1]

    divisor = gcd(width, height)
    reduced = (width // divisor, height // divisor)
    if reduced in COMMON_ASPECT_RATIOS:
        return reduced
    return None


def _is_landscape_wallpaper(width: int, height: int) -> bool:
    if width <= height:
        return False
    return _has_wallpaper_resolution(width, height) and 1.45 <= width / height <= 2.45


def _is_portrait_wallpaper(width: int, height: int) -> bool:
    if height <= width:
        return False
    return _has_wallpaper_resolution(width, height) and 1.45 <= height / width <= 2.45


def _has_wallpaper_resolution(width: int, height: int) -> bool:
    return max(width, height) >= WALLPAPER_MIN_LONG_EDGE and min(width, height) >= WALLPAPER_MIN_SHORT_EDGE
