## 2026-05-23 - [Optimization of Astro build-time data processing]
**Learning:** In Astro projects where data is processed primarily at build-time (e.g., generating JSON for static pages), module-level memoization is extremely effective. The codebase exhibited a redundant call tree where high-level aggregation functions repeatedly called lower-level ones, each performing O(N) traversals of a shared transaction list. Module-level caching reduced `getClientData` execution from ~53ms to ~1ms (a ~98% improvement) without the risk of stale data, as builds are re-triggered on every data change.
**Action:** Use module-level memoization for build-time aggregation logic to eliminate redundant processing across shared data structures.

## 2026-05-24 - [Pre-calculation and Single-Pass Aggregation]
**Learning:** Moving expensive operations (like string slicing, date parsing, and category lookup) from the "view" or "aggregation" layer into the more efficient parsing/ingestion phase yields significant performance gains.
**Action:** Pre-calculate derived fields once during initial ingestion and avoid redundant loop-level calculations.

## 2026-05-25 - [Replacing `toISOString()` with manual UTC component construction]
**Learning:** `Date.prototype.toISOString()` is relatively slow because it performs comprehensive formatting of the entire date-time string (including milliseconds and time zone markers) even when only specific parts (like `YYYY-MM`) are needed. Manually constructing UTC strings using `getUTC*` methods is approximately 5x faster and maintains the same UTC normalization, which is critical for financial data consistency.
**Action:** In high-performance loops (like CSV parsing), use manual UTC component construction instead of `toISOString()` if only specific parts of the date string are required.

## 2026-05-26 - [Overhead of toLocaleString in Build-time Cold Starts]
**Learning:** Calling `toLocaleString()` for the first time in a fresh Node.js execution context (like Astro static builds) incurs a major overhead (~20ms) because Node has to load and initialize the entire Internationalization (Intl) / ICU database. This is a cold-start bottleneck paid on every build in Serverless/CI environments. Replacing it with a fast, regex-based comma-formatting helper completes in <0.15ms on the first run, saving over 20ms instantly.
**Action:** Avoid using `toLocaleString()` in static/build-time modules when standard formatting (such as thousands separators) can be handled by lightweight, custom string manipulation functions.
