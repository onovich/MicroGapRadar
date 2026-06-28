import Link from "next/link";
import type { ReactNode } from "react";

import type { RadarTaskFormValues } from "@/lib/radar-task-view-models";

type RadarTaskFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  values: RadarTaskFormValues;
  submitLabel: string;
  cancelHref: string;
};

export function RadarTaskForm({
  action,
  values,
  submitLabel,
  cancelHref,
}: RadarTaskFormProps) {
  return (
    <form action={action} className="space-y-5 rounded-lg border border-ink/10 bg-white/90 p-5">
      <div className="grid gap-4 lg:grid-cols-2">
        <Field label="Name">
          <input
            className={inputClassName}
            defaultValue={values.name}
            maxLength={120}
            name="name"
            required
          />
        </Field>

        <Field label="Daily limit">
          <input
            className={inputClassName}
            defaultValue={values.dailyLimit}
            max={100}
            min={1}
            name="dailyLimit"
            required
            type="number"
          />
        </Field>
      </div>

      <Field label="Domain">
        <textarea
          className={textareaClassName}
          defaultValue={values.domainDescription}
          maxLength={2000}
          name="domainDescription"
          required
          rows={4}
        />
      </Field>

      <div className="grid gap-4 lg:grid-cols-3">
        <Field label="Seed examples">
          <textarea
            className={textareaClassName}
            defaultValue={values.seedExamplesText}
            name="seedExamples"
            required
            rows={4}
          />
        </Field>

        <Field label="Countries">
          <textarea
            className={textareaClassName}
            defaultValue={values.countriesText}
            name="countries"
            required
            rows={4}
          />
        </Field>

        <Field label="Languages">
          <textarea
            className={textareaClassName}
            defaultValue={values.languagesText}
            name="languages"
            required
            rows={4}
          />
        </Field>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Field label="Advantages">
          <textarea
            className={textareaClassName}
            defaultValue={values.userAdvantagesText}
            name="userAdvantages"
            rows={4}
          />
        </Field>

        <Field label="Monetization">
          <textarea
            className={textareaClassName}
            defaultValue={values.monetizationPreferencesText}
            name="monetizationPreferences"
            rows={4}
          />
        </Field>

        <Field label="Excluded topics">
          <textarea
            className={textareaClassName}
            defaultValue={values.excludedTopicsText}
            name="excludedTopics"
            rows={4}
          />
        </Field>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Field label="Max risk">
          <select className={inputClassName} defaultValue={values.maxRisk} name="maxRisk">
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </Field>

        <label className="flex items-center gap-3 rounded-lg border border-ink/10 bg-panel/70 px-3 py-3 text-sm font-medium text-ink/70">
          <input
            className="h-4 w-4 accent-signal"
            defaultChecked={values.avoidYMYLConclusions}
            name="avoidYMYLConclusions"
            type="checkbox"
          />
          Avoid YMYL conclusions
        </label>

        <label className="flex items-center gap-3 rounded-lg border border-ink/10 bg-panel/70 px-3 py-3 text-sm font-medium text-ink/70">
          <input
            className="h-4 w-4 accent-signal"
            defaultChecked={values.isActive}
            name="isActive"
            type="checkbox"
          />
          Active
        </label>
      </div>

      <div className="flex flex-wrap gap-3 border-t border-ink/10 pt-5">
        <button
          className="rounded-lg bg-signal px-4 py-2 text-sm font-semibold text-white hover:bg-signal/90"
          type="submit"
        >
          {submitLabel}
        </button>
        <Link
          className="rounded-lg border border-ink/15 bg-white px-4 py-2 text-sm font-semibold text-ink/70 hover:border-signal/40 hover:text-signal"
          href={cancelHref}
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}

function Field({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <label className="block space-y-2 text-sm font-medium text-ink/70">
      <span>{label}</span>
      {children}
    </label>
  );
}

const inputClassName =
  "h-11 w-full rounded-lg border border-ink/15 bg-white px-3 text-sm text-ink outline-none focus:border-signal focus:ring-2 focus:ring-signal/20";

const textareaClassName =
  "min-h-28 w-full rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm leading-6 text-ink outline-none focus:border-signal focus:ring-2 focus:ring-signal/20";
