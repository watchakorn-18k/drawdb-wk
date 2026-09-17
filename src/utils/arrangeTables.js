import { computeAutoLayout } from "./autoLayout";

export function arrangeTables(diagram, options = {}) {
  if (!diagram || !diagram.tables || diagram.tables.length === 0) return;

  const relationships =
    diagram.relationships || diagram.references || [];

  const positions = computeAutoLayout({
    tables: diagram.tables,
    relationships,
    direction: options.direction || "LR",
    tableWidth: options.tableWidth,
    showComments: options.showComments,
    startX: options.startX || 60,
    startY: options.startY || 60,
  });

  const posMap = new Map(positions.map((p) => [p.id, p]));
  diagram.tables.forEach((table) => {
    const pos = posMap.get(table.id);
    if (pos) {
      table.x = pos.x;
      table.y = pos.y;
    }
  });
}

