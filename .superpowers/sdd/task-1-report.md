# Task 1 Report: Category Eligibility During Normalization

## Status

DONE_WITH_CONCERNS

## Changes

- `src/shared/categories.ts`: reduced the supported categories to exactly `科技`, `财经`, `政治`, `国际`, and `体育`.
- `src/pipeline/normalize.ts`: merged economic keywords into `财经`; `inferCategory` now returns `null` for unmatched text; normalization rejects unmatched broad-feed articles before constructing an article.
- `src/pipeline/sources.ts`: removed forced `国际` hints from Reuters World, BBC World, Al Jazeera, and DW while retaining narrow technology-feed hints.
- `src/pipeline/socialSources.ts`: maps `economics` to `财经`.
- `tests/schema.test.ts`: asserts the exact five-category list.
- `tests/pipeline.test.ts`: covers economic-to-finance classification and rejection of an out-of-focus weather article.

## RED

Command:

```bash
npm test -- tests/schema.test.ts tests/pipeline.test.ts
```

Result: failed as expected (3 failures): `CATEGORIES` still contained `经济`; economic text was classified as `经济`; and unmatched weather text defaulted to `国际` instead of being rejected.

## GREEN

Command required by the task:

```bash
npm test -- tests/schema.test.ts tests/pipeline.test.ts tests/socialSources.test.ts
```

Result: the new pipeline behavior and social-source tests passed, but `tests/schema.test.ts` still had 2 failures because the existing `data/latest.json` fixture contains two `经济` values, now invalid under the required five-category schema.

Additional focused verification:

```bash
npm test -- tests/pipeline.test.ts tests/socialSources.test.ts
```

Result: passed, 2 test files and 7 tests.

## Build Check

```bash
npm run build
```

Result: failed on existing out-of-scope references to `经济` in `src/pipeline/rank.ts` and `src/shared/sampleData.ts`.

## Commit

- `de9f04a39a79fcba352a6ef3946de2373759767c` - `feat: filter news by focus category before ranking`

## Self-Review

The task-owned implementation is complete and scoped: only category eligibility, relevant source hints, and the specified tests changed. `git diff --check` passed. Repository integration remains incomplete until the generated latest-data fixture plus the rank and sample-data category references are migrated from `经济` to `财经`; those files were outside this task's explicit ownership list and were left untouched to avoid overwriting concurrent work.
