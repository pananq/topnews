# Category-First Top News Ranking Design

## Goal

Generate the daily Top 10 from a pre-qualified pool of news in five focus categories: 科技、财经、政治、国际、体育. Economic and macroeconomic reporting belongs to 财经. News outside these categories must not consume a Top 10 position.

## Data Flow

The pipeline order is:

1. Fetch articles published during the previous 24 hours.
2. Pre-classify each article into one of the five focus categories or mark it ineligible.
3. Exclude ineligible articles before clustering and ranking.
4. Cluster eligible articles that describe the same event.
5. Rank all eligible clusters by heat.
6. Select up to ten clusters with category coverage preference.
7. Ask the configured AI provider to create Chinese titles and summaries and to verify, but not determine, the category.

## Pre-classification

Pre-classification uses a hybrid strategy:

- Trust a source category only when the feed itself has a narrow subject, such as a technology feed.
- Use title and summary keywords for broad feeds and social sources.
- Map finance, business, markets, macroeconomics, monetary policy, trade, GDP, inflation, rates and similar economic topics to 财经.
- Do not default an unrecognized article to 国际. An article with insufficient evidence is ineligible.
- The implementation may use DeepSeek in a later refinement for ambiguous candidates, but deterministic filtering is the required baseline and must work without an API key.

Each cluster inherits its category from the strongest category evidence among its articles. Conflicting evidence is resolved before ranking, not by the final summarization response.

## Top 10 Selection

Selection operates on one global ranked pool. It is not a fixed quota per category.

When a category has at least one eligible cluster, its highest-ranked cluster receives coverage priority. These category representatives are ordered by their original global heat score. Remaining positions are filled from the global ranking, skipping clusters already selected, until ten events are selected or the pool is exhausted.

This guarantees at most one initial coverage position per available category while allowing the strongest categories to occupy the remaining positions. Missing categories are not filled with weak, unrelated or sample content merely to satisfy coverage.

## AI Responsibilities

DeepSeek remains the default provider, with OpenAI supported as an alternative. The AI receives only the selected eligible clusters. It generates Chinese titles, summaries, regions and heat explanations, and must retain the pre-classified category. If an AI response changes a category, the pipeline overrides it with the pre-classified value.

## Fallback Behavior

Without an API key or when the provider fails, deterministic Chinese fallback summaries are generated for the same selected clusters. Bundled sample events may fill an incomplete page, but only after all real eligible clusters have been selected, and sample events must use the five supported categories.

## Testing

Tests must prove that:

- 经济 is no longer a supported category and economic keywords map to 财经.
- Ineligible high-scoring news is excluded before the Top 10 cutoff.
- Each available category contributes its highest-ranked cluster before remaining positions are filled globally.
- A missing category does not prevent producing the best available events.
- AI output cannot reclassify a selected event.
- Existing schema, provider and build tests remain green.
