"use client";
import Link from "next/link";
import { useActionState } from "react";
import { saveBusiness, type BusinessFormState } from "./actions";

export type BusinessFormDefaults = {
  id?: string;
  name: string;
  website: string;
  category: string;
  location: string;
  service_area: string;
  services: string;
  aliases: string;
  domains: string;
  customer_types: string;
};

type FieldProps = {
  name: keyof Omit<BusinessFormDefaults, "id">;
  label: string;
  hint?: string;
  multiline?: boolean;
  required?: boolean;
  state: BusinessFormState;
  defaults: BusinessFormDefaults;
};

function Field({ name, label, hint, multiline, required, state, defaults }: FieldProps) {
  const error = state.errors[name];
  const value = state.values[name] ?? defaults[name];
  const describedBy = [hint ? `${name}-hint` : null, error ? `${name}-error` : null].filter(Boolean).join(" ") || undefined;
  return (
    <div>
      <label htmlFor={name}>
        {label}
        {required ? " *" : ""}
      </label>
      {multiline ? (
        <textarea id={name} name={name} rows={3} defaultValue={value} aria-invalid={Boolean(error)} aria-describedby={describedBy} />
      ) : (
        <input id={name} name={name} defaultValue={value} aria-invalid={Boolean(error)} aria-describedby={describedBy} />
      )}
      {hint ? (
        <div id={`${name}-hint`} className="muted">
          {hint}
        </div>
      ) : null}
      {error ? (
        <div id={`${name}-error`} className="error">
          {error}
        </div>
      ) : null}
    </div>
  );
}

export function BusinessForm({ defaults }: { defaults: BusinessFormDefaults }) {
  const [state, action, pending] = useActionState(saveBusiness, { errors: {}, values: {} });
  const common = { state, defaults };
  return (
    <form action={action} style={{ maxWidth: 640 }} noValidate>
      {defaults.id ? <input type="hidden" name="id" value={defaults.id} /> : null}
      {state.errors.form ? (
        <p role="alert" className="error">
          {state.errors.form}
        </p>
      ) : null}
      <Field name="name" label="Business name" required {...common} />
      <Field name="website" label="Website" hint="e.g. brownstonemovers.com" {...common} />
      <Field name="category" label="Category" hint="e.g. Moving company" required {...common} />
      <Field name="location" label="Location (city)" hint="e.g. Brooklyn, NY" required {...common} />
      <Field name="service_area" label="Service area" hint="e.g. New York City and North New Jersey" {...common} />
      <Field name="services" label="Relevant services" hint="One per line or comma-separated" multiline {...common} />
      <fieldset style={{ marginTop: 20, border: "1px solid var(--line)", borderRadius: 8 }}>
        <legend className="muted">Optional</legend>
        <Field name="aliases" label="Other names" hint="Former or alternative names, one per line" multiline {...common} />
        <Field
          name="domains"
          label="Other domains"
          hint="The website's own domain is added automatically"
          multiline
          {...common}
        />
        <Field name="customer_types" label="Customer types" hint="e.g. Families, Offices" multiline {...common} />
      </fieldset>
      <p style={{ display: "flex", gap: 8, marginTop: 20 }}>
        <button type="submit" disabled={pending}>
          {pending ? "Saving…" : defaults.id ? "Save changes" : "Add business"}
        </button>
        <Link href="/businesses">Cancel</Link>
      </p>
    </form>
  );
}
