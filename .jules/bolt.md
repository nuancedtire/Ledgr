## 2026-05-23 - [Optimization of Astro build-time data processing]
**Learning:** In Astro projects where data is processed primarily at build-time (e.g., generating JSON for static pages), module-level memoization is extremely effective. The codebase exhibited a redundant call tree where high-level aggregation functions repeatedly called lower-level ones, each performing O(N) traversals of a shared transaction list. Module-level caching reduced `getClientData` execution from ~53ms to ~1ms (a ~98% improvement) without the risk of stale data, as builds are re-triggered on every data change.
**Action:** Use module-level memoization for build-time aggregation logic to eliminate redundant processing across shared data structures.

## 2026-05-24 - [Pre-calculation and Single-Pass Aggregation]
**Learning:** Moving expensive operations (like string slicing, date parsing, and category lookup) from the "view" or "aggregation" layer into the initial "ingestion/parsing" phase yields significant gains in cold-start performance. Combining multiple O(N) filters and maps into a single-pass `for...of` loop further reduces overhead and avoids stack limits when using spread operators (e.g., `Math.max(...dates)`) on large datasets.
**Action:** Pre-calculate frequently used derived fields during initial data parsing and prefer single-pass loops for complex multi-metric aggregations.
