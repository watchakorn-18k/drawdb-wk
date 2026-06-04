import { nanoid } from "nanoid";
import { defaultBlue } from "../../data/constants";

const typeFromBson = {
  string: "STRING",
  objectId: "OBJECTID",
  int: "INT",
  long: "LONG",
  double: "DOUBLE",
  decimal: "DECIMAL",
  bool: "BOOL",
  date: "DATE",
  timestamp: "TIMESTAMP",
  object: "OBJECT",
  array: "ARRAY",
  binData: "BINDATA",
  null: "NULL",
  regex: "REGEX",
};

function unwrapSchema(value) {
  if (value && value.$jsonSchema) return value.$jsonSchema;
  if (value && value.validator && value.validator.$jsonSchema)
    return value.validator.$jsonSchema;
  return value;
}

function propertiesToFields(properties, required) {
  const requiredSet = new Set(required ?? []);

  return Object.entries(properties).map(([fieldName, property]) => {
    const bsonType = Array.isArray(property.bsonType)
      ? property.bsonType[0]
      : property.bsonType;
    const type = typeFromBson[bsonType] ?? "STRING";

    const field = {
      id: nanoid(),
      name: fieldName,
      type,
      default: "",
      check: "",
      primary: fieldName === "_id",
      unique: fieldName === "_id",
      notNull: requiredSet.has(fieldName),
      increment: false,
      comment: property.description ?? "",
    };

    if (type === "OBJECT" && property.properties) {
      field.fields = propertiesToFields(property.properties, property.required);
    } else if (type === "ARRAY" && property.items?.properties) {
      field.fields = propertiesToFields(
        property.items.properties,
        property.items.required,
      );
    }

    return field;
  });
}

function schemaToTable(name, rawSchema) {
  const schema = unwrapSchema(rawSchema);
  const fields = propertiesToFields(schema?.properties ?? {}, schema?.required);

  return {
    id: nanoid(),
    name,
    comment: "",
    color: defaultBlue,
    fields,
    indices: [],
  };
}

// Parses a MongoDB JSON Schema document into a diagram. Accepts an object
// mapping collection names to their schema/validator, or a single schema.
export function fromMongoDB(json) {
  const tables = [];

  if (json && (json.$jsonSchema || json.bsonType === "object")) {
    tables.push(schemaToTable("collection", json));
  } else if (json && typeof json === "object") {
    for (const [name, value] of Object.entries(json)) {
      tables.push(schemaToTable(name, value));
    }
  }

  return { tables, relationships: [] };
}
