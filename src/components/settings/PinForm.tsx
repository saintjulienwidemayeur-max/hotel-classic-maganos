"use client";

import { startTransition, useActionState, useRef, useEffect } from "react";
import { setAccessCode } from "@/app/(app)/settings/actions";
import { Field } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { PIN_LENGTH } from "@/lib/constants";
import { translator, type Lang } from "@/lib/i18n";

/**
 * Admin-only: set a new access code for one role.
 * The code is typed twice, never displayed back, and only its hash reaches the database.
 */
export function PinForm({
  role,
  title,
  isCustom,
  lang,
}: {
  role: "admin" | "reception";
  title: string;
  /** True when a code has already been set from inside the app. */
  isCustom: boolean;
  lang: Lang;
}) {
  const [state, formAction, pending] = useActionState(setAccessCode.bind(null, role), undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const t = translator(lang);
  const errors = state?.fieldErrors ?? {};

  useEffect(() => {
    if (state?.success) formRef.current?.reset();
  }, [state]);

  const digits = { inputMode: "numeric" as const, pattern: "\\d*", maxLength: PIN_LENGTH, autoComplete: "off" };

  return (
    <form
      ref={formRef}
      noValidate
      className="panel p-5"
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(() => formAction(formData));
      }}
    >
      <h2 className="font-serif text-lg font-semibold">{title}</h2>
      <p className="mb-4 mt-1 text-xs text-ink-500">
        {isCustom || state?.success ? t("settings.codeSetInApp") : t("settings.codeFromEnv")}
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("settings.newCode", { n: PIN_LENGTH })} htmlFor={`pin-${role}`} error={errors.pin}>
          <input
            id={`pin-${role}`}
            name="pin"
            type="password"
            {...digits}
            className={errors.pin ? "input input-invalid" : "input"}
          />
        </Field>
        <Field label={t("settings.confirmCode")} htmlFor={`confirm-${role}`} error={errors.confirm}>
          <input
            id={`confirm-${role}`}
            name="confirm"
            type="password"
            {...digits}
            className={errors.confirm ? "input input-invalid" : "input"}
          />
        </Field>
      </div>

      {state?.error ? (
        <p role="alert" className="mt-3 text-sm font-medium text-rose-700">
          {state.error}
        </p>
      ) : null}
      {state?.success ? (
        <p role="status" className="mt-3 text-sm font-medium text-emerald-800">
          {t("settings.codeSaved")}
        </p>
      ) : null}

      <div className="mt-4">
        <SubmitButton pending={pending} pendingLabel={t("common.saving")}>
          {t("settings.saveCode")}
        </SubmitButton>
      </div>
    </form>
  );
}
