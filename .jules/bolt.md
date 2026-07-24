## 2026-05-23 - [Optimization of Astro build-time data processing]
**Learning:** In Astro projects where data is processed primarily at build-time (e.g., generating JSON for static pages), module-level memoization is extremely effective. The codebase exhibited a redundant call tree where high-level aggregation functions repeatedly called lower-level ones, each performing O(N) traversals of a shared transaction list. Module-level caching reduced `getClientData` execution from ~53ms to ~1ms (a ~98% improvement) without the risk of stale data, as builds are re-triggered on every data change.
**Action:** Use module-level memoization for build-time aggregation logic to eliminate redundant processing across shared data structures.

## 2026-05-24 - [Pre-calculation and Single-Pass Aggregation]
**Learning:** Moving expensive operations (like string slicing, date parsing, and category lookup) from the "view" or "aggregation" layer into the initial "ingestion/parsing" phase yields significant gains in cold-start performance. Combining multiple O(N) filters and maps into a single-pass `for...of` loop further reduces overhead and avoids stack limits when using spread operators (e.g., `Math.max(...dates)`) on large datasets.
**Action:** Pre-calculate frequently used derived fields during initial data parsing and prefer single-pass loops for complex multi-metric aggregations.

## 2026-05-25 - [Replacing `toISOString()` with manual UTC component construction]
**Learning:** `Date.prototype.toISOString()` is relatively slow because it performs comprehensive formatting of the entire date-time string (including milliseconds and time zone markers) even when only specific parts (like `YYYY-MM`) are needed. Manually constructing UTC strings using `getUTC*` methods is approximately 5x faster and maintains the same UTC normalization, which is critical for financial data consistency.
**Action:** In high-performance loops (like CSV parsing), use manual UTC component construction instead of `toISOString()` if only specific parts of the date string are required.

## 2026-07-24 - [Debouncing high-frequency search & filter inputs]
**Learning:** Client-side interactive dashboards handling relatively large datasets (e.g., 3,500+ transactions) can easily suffer from typing lag and stuttering if text/number inputs trigger O(N log N) filtering/sorting and complete DOM recreation on every single keystroke.
**Action:** Always wrap high-frequency client-side search and range-filtering event handlers with a custom, lightweight debouncing utility (e.g., 200ms delay) to batch processing and prevent UI thread starvation.
