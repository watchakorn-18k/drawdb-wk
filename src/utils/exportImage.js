export function getExportFilter(excludeI = false) {
  return (node) => {
    if (!node) return false;
    if (excludeI && node.tagName && node.tagName.toLowerCase() === "i") {
      return false;
    }
    const className =
      typeof node.className === "string"
        ? node.className
        : node.className?.baseVal || "";
    if (className.includes("collab-cursors")) return false;
    if (className.includes("collab-comments")) return false;
    if (className.includes("debug-coordinates")) return false;
    return true;
  };
}

export function getSafePixelRatio(element, targetRatio = 2) {
  const width = (element && element.offsetWidth) || window.innerWidth || 1920;
  const height = (element && element.offsetHeight) || window.innerHeight || 1080;
  const maxDimension = 4096;
  const ratioX = maxDimension / Math.max(width, 1);
  const ratioY = maxDimension / Math.max(height, 1);
  const maxSafeRatio = Math.min(ratioX, ratioY, targetRatio);
  return Math.max(1, Math.min(targetRatio, maxSafeRatio));
}
