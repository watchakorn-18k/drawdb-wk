import { Input, Select, Button } from "@douyinfe/semi-ui";
import { IconPlus, IconDeleteStroked } from "@douyinfe/semi-icons";
import { nanoid } from "nanoid";
import { useTranslation } from "react-i18next";
import { dbToTypes } from "../../../data/datatypes";

const NESTABLE = ["OBJECT", "ARRAY"];

export default function EmbeddedFields({ value, onChange, database, readOnly }) {
  const { t } = useTranslation();
  const fields = value ?? [];

  const typeOptions = Object.keys(dbToTypes[database]).map((v) => ({
    label: v,
    value: v,
  }));

  const updateAt = (index, patch) => {
    onChange(fields.map((f, i) => (i === index ? { ...f, ...patch } : f)));
  };

  const removeAt = (index) => {
    onChange(fields.filter((_, i) => i !== index));
  };

  const add = () => {
    onChange([...fields, { id: nanoid(), name: "", type: "STRING" }]);
  };

  return (
    <div className="border-l border-zinc-300 pl-2 my-1">
      {fields.map((field, index) => (
        <div key={field.id}>
          <div className="flex gap-1 items-center my-1">
            <Input
              className="flex-1"
              placeholder={t("name")}
              value={field.name}
              readonly={readOnly}
              validateStatus={field.name.trim() === "" ? "error" : "default"}
              onChange={(name) => updateAt(index, { name })}
            />
            <Select
              className="w-28"
              optionList={typeOptions}
              filter
              value={field.type}
              disabled={readOnly}
              onChange={(type) =>
                updateAt(index, {
                  type,
                  fields: NESTABLE.includes(type) ? (field.fields ?? []) : undefined,
                })
              }
            />
            <Button
              type="danger"
              icon={<IconDeleteStroked />}
              disabled={readOnly}
              onClick={() => removeAt(index)}
            />
          </div>
          {NESTABLE.includes(field.type) && (
            <EmbeddedFields
              value={field.fields}
              database={database}
              readOnly={readOnly}
              onChange={(child) => updateAt(index, { fields: child })}
            />
          )}
        </div>
      ))}
      <Button
        size="small"
        icon={<IconPlus />}
        block
        disabled={readOnly}
        onClick={add}
      >
        {t("add_field")}
      </Button>
    </div>
  );
}
