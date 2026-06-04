const bsonTypeMap = {
  STRING: "string",
  OBJECTID: "objectId",
  UUID: "binData",
  NUMBER: "double",
  INT: "int",
  LONG: "long",
  DOUBLE: "double",
  DECIMAL: "decimal",
  BOOL: "bool",
  DATE: "date",
  TIMESTAMP: "timestamp",
  OBJECT: "object",
  ARRAY: "array",
  BINDATA: "binData",
  NULL: "null",
  REGEX: "regex",
};

function fieldToProperty(field) {
  const property = { bsonType: bsonTypeMap[field.type] ?? "string" };
  if (field.comment) property.description = field.comment;
  return property;
}

function tableToValidator(table) {
  const properties = {};
  for (const field of table.fields) {
    properties[field.name] = fieldToProperty(field);
  }

  const required = table.fields
    .filter((field) => field.notNull)
    .map((field) => field.name);

  const schema = {
    $jsonSchema: {
      bsonType: "object",
      ...(required.length ? { required } : {}),
      properties,
    },
  };

  return `db.createCollection("${table.name}", {\n  validator: ${JSON.stringify(
    schema,
    null,
    2,
  )
    .split("\n")
    .join("\n  ")},\n});`;
}

export function toMongoDB(diagram) {
  return diagram.tables.map(tableToValidator).join("\n\n");
}
