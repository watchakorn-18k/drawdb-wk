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

function buildObjectSchema(fields) {
  const properties = {};
  for (const field of fields) {
    if (!field.name) continue;
    properties[field.name] = fieldToProperty(field);
  }

  const required = fields
    .filter((field) => field.notNull && field.name)
    .map((field) => field.name);

  return {
    bsonType: "object",
    ...(required.length ? { required } : {}),
    properties,
  };
}

function fieldToProperty(field) {
  const property = { bsonType: bsonTypeMap[field.type] ?? "string" };
  if (field.comment) property.description = field.comment;

  if (field.type === "OBJECT" && field.fields?.length) {
    Object.assign(property, buildObjectSchema(field.fields));
  } else if (field.type === "ARRAY" && field.fields?.length) {
    property.items = buildObjectSchema(field.fields);
  }

  return property;
}

function tableToValidator(table) {
  const schema = {
    $jsonSchema: buildObjectSchema(table.fields),
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
