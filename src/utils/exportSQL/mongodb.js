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

export function toMongoDB(diagram) {
  const collections = {};
  for (const table of diagram.tables) {
    collections[table.name] = {
      $jsonSchema: buildObjectSchema(table.fields),
    };
  }

  return JSON.stringify(collections, null, 2);
}
