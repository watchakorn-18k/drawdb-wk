import { databases } from "../../data/databases";
import { dbToTypes } from "../../data/datatypes";

function formatMarkdownTable(headers, rows) {
  const allRows = [headers, ...rows];
  const colWidths = headers.map((_, colIndex) =>
    Math.max(...allRows.map((row) => String(row[colIndex] ?? "").length)),
  );

  const pad = (cell, width) => String(cell ?? "").padEnd(width);
  const separator = colWidths.map((w) => "-".repeat(w)).join(" | ");
  const headerRow = headers.map((h, i) => pad(h, colWidths[i])).join(" | ");
  const dataRows = rows
    .map((row) => `| ${row.map((cell, i) => pad(cell, colWidths[i])).join(" | ")} |`)
    .join("\n");

  return `| ${headerRow} |\n| ${separator} |${dataRows ? `\n${dataRows}` : ""}`;
}

function fieldType(field, database) {
  const metadata = dbToTypes[database]?.[field.type];
  const size =
    (metadata?.isSized || metadata?.hasPrecision) && field.size
      ? `(${field.size})`
      : "";

  return `${field.type}${size}${field.isArray ? "[]" : ""}`;
}

function fieldSettings(field) {
  const settings = [];

  field.primary && settings.push("primary key");
  field.notNull && settings.push("not null");
  field.unique && settings.push("unique");
  field.increment && settings.push("autoincrement");
  field.unsigned && settings.push("unsigned");
  field.default && settings.push(`default: ${field.default}`);
  field.check && settings.push(`check: ${field.check}`);

  return settings.join(", ");
}

function nestedFields(fields = [], database, depth = 0) {
  if (!fields.length) return "";

  const indent = "  ".repeat(depth);

  return fields
    .map((field) => {
      const childFields = nestedFields(field.fields, database, depth + 1);
      return `${indent}- ${field.name}: ${fieldType(field, database)}${childFields ? `\n${childFields}` : ""}`;
    })
    .join("\n");
}

function tableById(tables, id) {
  return tables.find((table) => table.id === id);
}

function fieldById(table, id) {
  return table?.fields?.find((field) => field.id === id);
}

function relationshipRows(diagram) {
  return (diagram.relationships ?? []).map((relationship) => {
    const startTable = tableById(diagram.tables, relationship.startTableId);
    const endTable = tableById(diagram.tables, relationship.endTableId);
    const startField = fieldById(startTable, relationship.startFieldId);
    const endField = fieldById(endTable, relationship.endFieldId);

    return [
      relationship.name,
      startTable && startField ? `${startTable.name}.${startField.name}` : "Unknown",
      endTable && endField ? `${endTable.name}.${endField.name}` : "Unknown",
      relationship.cardinality,
      relationship.updateConstraint,
      relationship.deleteConstraint,
    ];
  });
}

function tableSection(table, diagram) {
  const fieldRows = table.fields.map((field) => [
    field.name,
    fieldType(field, diagram.database),
    fieldSettings(field),
    field.comment ?? "",
  ]);

  const indexSection = table.indices?.length
    ? `\n\nIndexes:\n${formatMarkdownTable(
        ["Name", "Unique", "Fields"],
        table.indices.map((index) => [
          index.name,
          index.unique ? "yes" : "no",
          index.fields.join(", "),
        ]),
      )}`
    : "";

  const embeddedSection = table.fields
    .filter((field) => field.fields?.length)
    .map((field) => `\nEmbedded fields for ${field.name}:\n${nestedFields(field.fields, diagram.database)}`)
    .join("\n");

  return `### ${table.name}\n${table.comment ? `${table.comment}\n\n` : ""}${formatMarkdownTable(
    ["Field", "Type", "Settings", "Comment"],
    fieldRows,
  )}${embeddedSection}${indexSection}`;
}

function notesSection(notes = []) {
  if (!notes.length) return "";

  return `\n\n## Notes\n\n${notes
    .map((note) => `- ${note.title}${note.content ? `: ${note.content}` : ""}`)
    .join("\n")}`;
}

function subjectAreasSection(subjectAreas = []) {
  if (!subjectAreas.length) return "";

  return `\n\n## Subject areas\n\n${subjectAreas
    .map((area) => `- ${area.name}`)
    .join("\n")}`;
}

function enumsSection(enums = []) {
  if (!enums.length) return "";

  return `\n\n## Enums\n\n${enums
    .map((en) => `- ${en.name}: ${en.values.join(", ")}`)
    .join("\n")}`;
}

function typesSection(types = [], database) {
  if (!types.length) return "";

  return `\n\n## Custom types\n\n${types
    .map(
      (type) =>
        `### ${type.name}\n${type.comment ? `${type.comment}\n\n` : ""}${formatMarkdownTable(
          ["Field", "Type", "Comment"],
          type.fields.map((field) => [
            field.name,
            fieldType(field, database),
            field.comment ?? "",
          ]),
        )}`,
    )
    .join("\n\n")}`;
}

export function jsonToLLMPrompt(diagram) {
  const relationships = relationshipRows(diagram);

  return `# Database design prompt: ${diagram.title}

You are a database architect. Create a ${databases[diagram.database].name} database schema from the specification below.

Requirements:
- Preserve all table names, field names, data types, constraints, indexes, relationships, and comments.
- Use comments as business meaning and add them to generated DDL or schema documentation where the database supports comments.
- Generate clear, production-ready database code.
- Explain any assumptions before the final schema.

## Tables

${diagram.tables.map((table) => tableSection(table, diagram)).join("\n\n")}

## Relationships

${formatMarkdownTable(
    ["Name", "From", "To", "Cardinality", "On update", "On delete"],
    relationships,
  )}${enumsSection(diagram.enums)}${typesSection(diagram.types, diagram.database)}${notesSection(diagram.notes)}${subjectAreasSection(diagram.subjectAreas)}
`;
}
