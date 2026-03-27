import type { JSX } from "react";
import { useRef, useState } from "react";
import { XIcon, PlusIcon } from "lucide-react";
import { Button } from "src/components/ui/button";
import { Input } from "src/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "src/components/ui/select";

type FilterCondition = {
  field: string;
  op: string;
  value: string | number | boolean;
};

export type FilterRules = {
  operator: "and" | "or";
  conditions: FilterCondition[];
};

type SmartFilterBuilderProps = {
  value: FilterRules;
  onChange: (rules: FilterRules) => void;
};

// Internal condition type with a stable id for React keys
type IndexedCondition = FilterCondition & { _id: number };

const TEXT_FIELDS = [
  "title",
  "author",
  "language",
  "publisher",
  "tag",
  "series",
] as const;
const NUMBER_FIELDS = ["rating"] as const;

const FIELD_OPTIONS = [
  { value: "title", label: "Title" },
  { value: "author", label: "Author" },
  { value: "language", label: "Language" },
  { value: "publisher", label: "Publisher" },
  { value: "tag", label: "Tag" },
  { value: "series", label: "Series" },
  { value: "rating", label: "Rating" },
];

const TEXT_OPS = [
  { value: "contains", label: "Contains" },
  { value: "equals", label: "Equals" },
  { value: "startsWith", label: "Starts with" },
];

const NUMBER_OPS = [
  { value: "greaterThan", label: "Greater than" },
  { value: "lessThan", label: "Less than" },
  { value: "equals", label: "Equals" },
];

function isNumberField(field: string): boolean {
  return (NUMBER_FIELDS as ReadonlyArray<string>).includes(field);
}

function isTextField(field: string): boolean {
  return (TEXT_FIELDS as ReadonlyArray<string>).includes(field);
}

function getOpsForField(field: string) {
  if (isNumberField(field)) {
    return NUMBER_OPS;
  }
  if (isTextField(field)) {
    return TEXT_OPS;
  }
  return TEXT_OPS;
}

function getDefaultOpForField(field: string): string {
  if (isNumberField(field)) {
    return "equals";
  }
  return "contains";
}

function getDefaultValueForField(field: string): string | number {
  if (isNumberField(field)) {
    return 0;
  }
  return "";
}

function toIndexed(
  conditions: FilterCondition[],
  startId: number,
): IndexedCondition[] {
  return conditions.map((c, i) => ({ ...c, _id: startId + i }));
}

export function SmartFilterBuilder({
  value,
  onChange,
}: SmartFilterBuilderProps): JSX.Element {
  const { operator } = value;
  const nextId = useRef(value.conditions.length);

  // Maintain stable IDs internally; initialize from props on first render
  const [indexed, setIndexed] = useState<IndexedCondition[]>(() =>
    toIndexed(value.conditions, 0),
  );

  const emitChange = (
    nextIndexed: IndexedCondition[],
    nextOperator: "and" | "or" = operator,
  ) => {
    setIndexed(nextIndexed);
    onChange({
      operator: nextOperator,
      conditions: nextIndexed.map(({ _id: _unused, ...c }) => c),
    });
  };

  const setOperator = (op: "and" | "or") => {
    emitChange(indexed, op);
  };

  const addCondition = () => {
    const defaultField = "title";
    const newCondition: IndexedCondition = {
      _id: (nextId.current += 1),
      field: defaultField,
      op: getDefaultOpForField(defaultField),
      value: getDefaultValueForField(defaultField),
    };
    emitChange([...indexed, newCondition]);
  };

  const removeCondition = (id: number) => {
    emitChange(indexed.filter((c) => c._id !== id));
  };

  const updateCondition = (id: number, updates: Partial<FilterCondition>) => {
    const updated = indexed.map((c) => {
      if (c._id !== id) {
        return c;
      }
      const merged = { ...c, ...updates };
      if ("field" in updates && updates.field !== c.field) {
        const newField = updates.field ?? c.field;
        merged.op = getDefaultOpForField(newField);
        merged.value = getDefaultValueForField(newField);
      }
      return merged;
    });
    emitChange(updated);
  };

  return (
    <div className="space-y-3">
      {/* AND / OR toggle */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Match</span>
        <div className="flex rounded-md border">
          <button
            type="button"
            onClick={() => setOperator("and")}
            className={`px-3 py-1 text-sm rounded-l-md transition-colors ${
              operator === "and"
                ? "bg-primary text-primary-foreground"
                : "hover:bg-muted"
            }`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setOperator("or")}
            className={`px-3 py-1 text-sm rounded-r-md border-l transition-colors ${
              operator === "or"
                ? "bg-primary text-primary-foreground"
                : "hover:bg-muted"
            }`}
          >
            Any
          </button>
        </div>
        <span className="text-sm text-muted-foreground">of the conditions</span>
      </div>

      {/* Condition rows */}
      <div className="space-y-2">
        {indexed.map((condition) => {
          const ops = getOpsForField(condition.field);
          const isNumeric = isNumberField(condition.field);
          return (
            <div key={condition._id} className="flex items-center gap-2">
              {/* Field select */}
              <Select
                value={condition.field}
                onValueChange={(field) =>
                  updateCondition(condition._id, { field })
                }
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FIELD_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Operation select */}
              <Select
                value={condition.op}
                onValueChange={(op) => updateCondition(condition._id, { op })}
              >
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ops.map((op) => (
                    <SelectItem key={op.value} value={op.value}>
                      {op.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Value input */}
              <Input
                className="flex-1"
                type={isNumeric ? "number" : "text"}
                value={String(condition.value)}
                onChange={(e) => {
                  const raw = e.target.value;
                  updateCondition(condition._id, {
                    value: isNumeric ? e.target.valueAsNumber || 0 : raw,
                  });
                }}
                placeholder={isNumeric ? "0" : "Value…"}
              />

              {/* Remove button */}
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => removeCondition(condition._id)}
              >
                <XIcon className="size-3.5" />
                <span className="sr-only">Remove condition</span>
              </Button>
            </div>
          );
        })}
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={addCondition}
        className="w-full"
      >
        <PlusIcon className="size-4" />
        Add Condition
      </Button>
    </div>
  );
}
