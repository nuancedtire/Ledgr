## 2025-05-22 - [Data Caching vs Dynamic State]
**Learning:** Global module-level caching for processed data (like `getMonthlyBreakdown`) in an application that allows data updates (like CSV uploads) causes stale data bugs unless a proper invalidation mechanism is implemented.
**Action:** Always check for state-changing features before implementing long-lived caches. Prefer local memoization or ensure caches are cleared when source data changes.

## 2025-05-22 - [Categorization Performance]
**Learning:** The `categorize` function is called for every transaction during build and render. Since many transactions share the same merchant description and type, memoizing this function provides a significant speed boost without side effects.
**Action:** Use a simple `Map` to memoize deterministic string processing functions that operate on repetitive data sets.
