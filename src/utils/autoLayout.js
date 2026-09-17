import dagre from "@dagrejs/dagre";
import {
  tableColorStripHeight,
  tableFieldHeight,
  tableHeaderHeight,
  tableWidth as defaultTableWidth,
} from "../data/constants";
import { getTableHeight } from "./utils";

/**
 * Calculates effective height for a table.
 */
function getEffectiveHeight(table, width, showComments, relationships) {
  try {
    if (table.fields && Array.isArray(table.fields)) {
      return getTableHeight(table, width, showComments, relationships);
    }
  } catch {
    // Fallback if getTableHeight encounters unexpected structure
  }
  const fieldCount = table.fields?.length || 0;
  return (
    fieldCount * tableFieldHeight +
    tableHeaderHeight +
    tableColorStripHeight +
    (table.comment && showComments ? 30 : 0)
  );
}

/**
 * Computes automatic layout coordinates for diagram tables based on their relationships.
 *
 * @param {Object} params
 * @param {Array} params.tables - Diagram tables
 * @param {Array} params.relationships - Diagram relationships / references
 * @param {string} [params.direction='LR'] - 'LR' (Left to Right), 'TB' (Top to Bottom), or 'GRID'
 * @param {number} [params.tableWidth] - Table width (defaults to constants or 220)
 * @param {boolean} [params.showComments=false] - Whether comments are shown
 * @param {number} [params.nodeSep=60] - Spacing between adjacent nodes in the same rank
 * @param {number} [params.rankSep=100] - Spacing between ranks
 * @param {number} [params.startX=60] - Starting X margin
 * @param {number} [params.startY=60] - Starting Y margin
 * @returns {Array<{id: any, x: number, y: number}>} Array of new table positions
 */
export function computeAutoLayout({
  tables = [],
  relationships = [],
  direction = "LR",
  tableWidth = defaultTableWidth || 220,
  showComments = false,
  nodeSep = 60,
  rankSep = 100,
  startX = 60,
  startY = 60,
}) {
  if (!tables || tables.length === 0) return [];

  if (tables.length === 1) {
    return [{ id: tables[0].id, x: startX, y: startY }];
  }

  const tableIdSet = new Set(tables.map((t) => t.id));
  const validRels = (relationships || []).filter(
    (r) =>
      r &&
      tableIdSet.has(r.startTableId) &&
      tableIdSet.has(r.endTableId),
  );

  const getH = (t) => getEffectiveHeight(t, t.width || tableWidth, showComments, relationships);

  // If pure GRID mode or no valid relationships exist
  if (direction === "GRID" || validRels.length === 0) {
    return layoutGrid(tables, {
      tableWidth,
      getH,
      startX,
      startY,
      gapX: nodeSep,
      gapY: 50,
    });
  }

  // Find connected tables and isolated tables
  const connectedIds = new Set();
  validRels.forEach((r) => {
    connectedIds.add(r.startTableId);
    connectedIds.add(r.endTableId);
  });

  const connectedTables = tables.filter((t) => connectedIds.has(t.id));
  const isolatedTables = tables.filter((t) => !connectedIds.has(t.id));

  // 1. Layout connected tables with Dagre
  const g = new dagre.graphlib.Graph({ multigraph: true });
  const actualRankDir = direction === "TB" ? "TB" : "LR";
  const actualRankSep =
    rankSep ?? (actualRankDir === "LR" ? 110 : 80);

  g.setGraph({
    rankdir: actualRankDir,
    nodesep: nodeSep,
    ranksep: actualRankSep,
    marginx: 0,
    marginy: 0,
  });
  g.setDefaultEdgeLabel(() => ({}));

  connectedTables.forEach((table) => {
    const w = table.width || tableWidth;
    const h = getH(table);
    g.setNode(String(table.id), { width: w, height: h });
  });

  validRels.forEach((rel, idx) => {
    g.setEdge(
      String(rel.startTableId),
      String(rel.endTableId),
      {},
      String(rel.id || idx),
    );
  });

  dagre.layout(g);

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  const connectedRaw = connectedTables.map((table) => {
    const node = g.node(String(table.id));
    const w = node?.width || table.width || tableWidth;
    const h = node?.height || getH(table);
    const left = node ? Math.round(node.x - w / 2) : 0;
    const top = node ? Math.round(node.y - h / 2) : 0;

    minX = Math.min(minX, left);
    minY = Math.min(minY, top);
    maxX = Math.max(maxX, left + w);
    maxY = Math.max(maxY, top + h);

    return { id: table.id, left, top, width: w, height: h };
  });

  const offsetX = startX - (isFinite(minX) ? minX : 0);
  const offsetY = startY - (isFinite(minY) ? minY : 0);

  const results = connectedRaw.map((p) => ({
    id: p.id,
    x: p.left + offsetX,
    y: p.top + offsetY,
  }));

  // 2. Layout isolated tables in a clean grid below the connected graph
  if (isolatedTables.length > 0) {
    const connectedWidth = isFinite(maxX - minX) ? maxX - minX : 800;
    const gapX = nodeSep;
    const gapY = 50;
    const maxCols = Math.min(
      6,
      Math.max(2, Math.floor((connectedWidth + gapX) / (tableWidth + gapX))),
    );
    const cols = Math.min(
      maxCols,
      Math.max(2, Math.ceil(Math.sqrt(isolatedTables.length))),
    );

    const isolatedStartY =
      offsetY + (isFinite(maxY) ? maxY : 0) + 90;

    const isolatedPositions = layoutGrid(isolatedTables, {
      tableWidth,
      getH,
      startX,
      startY: isolatedStartY,
      gapX,
      gapY,
      columns: cols,
    });

    results.push(...isolatedPositions);
  }

  return results;
}

/**
 * Arranges tables in a balanced grid layout.
 */
function layoutGrid(
  tables,
  {
    tableWidth,
    getH,
    startX = 60,
    startY = 60,
    gapX = 60,
    gapY = 50,
    columns = null,
  },
) {
  if (tables.length === 0) return [];

  const cols =
    columns ||
    Math.min(6, Math.max(2, Math.ceil(Math.sqrt(tables.length * 1.3))));

  const results = [];
  let currentY = startY;
  const numRows = Math.ceil(tables.length / cols);

  for (let r = 0; r < numRows; r++) {
    const rowTables = tables.slice(r * cols, (r + 1) * cols);
    let maxRowHeight = 0;

    rowTables.forEach((table, c) => {
      const h = getH(table);
      maxRowHeight = Math.max(maxRowHeight, h);
      const x = startX + c * (tableWidth + gapX);
      results.push({
        id: table.id,
        x,
        y: currentY,
      });
    });

    currentY += maxRowHeight + gapY;
  }

  return results;
}
