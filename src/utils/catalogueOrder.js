const testKey = (str) =>
  String(str || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

/**
 * Builds a fast lookup map for all catalogue tests and parameters
 * from the hierarchical TestGroup documents.
 * 
 * Each mapped entry has:
 * { catOrder, testOrder, paramOrder, category }
 */
const buildCatalogueOrderMap = (groups = []) => {
  const map = new Map();

  const setEntry = (key, entry) => {
    if (!key) return;
    const strKey = String(key).trim();
    if (!strKey) return;

    // Store by string key (e.g. ObjectId)
    if (!map.has(strKey)) {
      map.set(strKey, entry);
    }
    // Also store by normalized alphanumeric key
    const normalized = testKey(strKey);
    if (normalized && !map.has(normalized)) {
      map.set(normalized, entry);
    }
  };

  groups.forEach((g, gIdx) => {
    if (!g) return;
    const catOrder = Number.isFinite(g.order) ? g.order : gIdx + 1;
    const categoryName = g.name || 'General';

    // Map group name itself
    setEntry(g.name, { catOrder, testOrder: 0, paramOrder: 0, category: categoryName });
    if (g._id) setEntry(String(g._id), { catOrder, testOrder: 0, paramOrder: 0, category: categoryName });

    const tests = Array.isArray(g.tests) ? g.tests : [];
    tests.forEach((t, tIdx) => {
      if (!t) return;
      const testOrder = Number.isFinite(t.order) ? t.order : tIdx + 1;
      const tName = typeof t === 'string' ? t : t.name || t.investigation || '';
      const tId = t._id ? (t._id.$oid || String(t._id)) : t.id;

      // Map parameters if present (multi-parameter test or expanded single-parameter)
      if (Array.isArray(t.parameters) && t.parameters.length > 0) {
        t.parameters.forEach((p, pIdx) => {
          if (!p) return;
          const paramOrder = Number.isFinite(p.order) ? p.order : pIdx + 1;
          const pName = p.name || '';
          const pTestId = p.testId ? (p.testId.$oid || String(p.testId)) : null;
          const pId = p._id ? (p._id.$oid || String(p._id)) : p.id;

          const pEntry = {
            catOrder,
            testOrder,
            paramOrder,
            category: categoryName,
            parentTestName: tName,
          };

          if (pName) setEntry(pName, pEntry);
          if (pTestId) setEntry(pTestId, pEntry);
          if (pId) setEntry(pId, pEntry);
        });
      }

      // Map parent test
      const tEntry = {
        catOrder,
        testOrder,
        paramOrder: 0,
        category: categoryName,
      };
      if (tName) setEntry(tName, tEntry);
      if (t.shortName) setEntry(t.shortName, tEntry);
      if (tId) setEntry(tId, tEntry);
    });

    // Also map panels if present
    const panels = Array.isArray(g.panels) ? g.panels : [];
    panels.forEach((p, pIdx) => {
      if (!p || !p.name) return;
      const panelOrder = 900 + pIdx;
      setEntry(p.name, {
        catOrder,
        testOrder: panelOrder,
        paramOrder: 0,
        category: categoryName,
      });
      if (p._id) setEntry(String(p._id), {
        catOrder,
        testOrder: panelOrder,
        paramOrder: 0,
        category: categoryName,
      });
    });
  });

  return map;
};

/**
 * Gets catalogue order tuple for a test item
 */
const getTestOrderTuple = (testItem, orderMap) => {
  const DEFAULT_ORDER = 99999;
  if (!testItem || !orderMap) {
    return { catOrder: DEFAULT_ORDER, testOrder: DEFAULT_ORDER, paramOrder: DEFAULT_ORDER };
  }

  // 1. Try matching by testId / _id / reportItemId
  const idCandidates = [
    testItem.testId ? String(testItem.testId) : null,
    testItem._id ? String(testItem._id) : null,
    testItem.id ? String(testItem.id) : null,
  ].filter(Boolean);

  for (const id of idCandidates) {
    if (orderMap.has(id)) return orderMap.get(id);
  }

  // 2. Try matching by test name snapshot
  const nameCandidates = [
    testItem.testNameSnapshot,
    testItem.name,
    testItem.investigation,
  ].filter(Boolean);

  for (const name of nameCandidates) {
    const rawKey = String(name).trim();
    if (orderMap.has(rawKey)) return orderMap.get(rawKey);

    const normKey = testKey(rawKey);
    if (orderMap.has(normKey)) return orderMap.get(normKey);
  }

  // 3. Fallback based on category
  const cat = testItem.categorySnapshot || testItem.category || '';
  if (cat) {
    const catEntry = orderMap.get(cat) || orderMap.get(testKey(cat));
    if (catEntry) {
      return { catOrder: catEntry.catOrder, testOrder: DEFAULT_ORDER, paramOrder: DEFAULT_ORDER };
    }
  }

  return { catOrder: DEFAULT_ORDER, testOrder: DEFAULT_ORDER, paramOrder: DEFAULT_ORDER };
};

/**
 * Sorts an array of tests or report items by Catalogue Order:
 * (category.order) -> (test.order) -> (parameter.order)
 */
const sortTestsByCatalogueOrder = (items = [], groups = []) => {
  if (!Array.isArray(items) || items.length <= 1) return items;
  const orderMap = buildCatalogueOrderMap(groups);

  return [...items].sort((a, b) => {
    const orderA = getTestOrderTuple(a, orderMap);
    const orderB = getTestOrderTuple(b, orderMap);

    if (orderA.catOrder !== orderB.catOrder) {
      return orderA.catOrder - orderB.catOrder;
    }
    if (orderA.testOrder !== orderB.testOrder) {
      return orderA.testOrder - orderB.testOrder;
    }
    if (orderA.paramOrder !== orderB.paramOrder) {
      return orderA.paramOrder - orderB.paramOrder;
    }
    return 0;
  });
};

module.exports = {
  testKey,
  buildCatalogueOrderMap,
  getTestOrderTuple,
  sortTestsByCatalogueOrder,
};
