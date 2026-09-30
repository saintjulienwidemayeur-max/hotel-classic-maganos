"use client";

import { startTransition, useActionState, useEffect, useRef } from "react";
import { createReceptionist } from "@/app/(app)/receptionists/actions";
import { Field } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { PIN_LENGTH } from "@/lib/constants";
import { translator, type Lang } from "@/lib/i18n";

/** Admin-only: add a receptionist (name + personal code). */
export function AddReceptionistForm({ lang }: { lang: Lang }) {
  const [state, formAction, pending] = useActionState(createReceptionist, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const errors = state?.fieldErrors ?? {};
  const t = translator(lang);

  useEffect(() => {
    if (state?.success) formRef.current?.reset();
  }, [state]);

  const cls = (name: string) => (errors[name] ? "input input-invalid" : "input");
  const digits = { inputMode: "numeric" as const, pattern: "\\d*", maxLength: PIN_LENGTH, autoComplete: "off" };

  return (
    <form
      ref={formRef}
      noValidate
      className="panel mb-6 p-5"
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(() => formAction(formData));
      }}
    >
      <h2 className="mb-4 font-serif text-lg font-semibold">{t("recep.add")}</h2>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_auto] lg:items-start">
        <Field label={t("recep.name")} htmlFor="recep_name" error={errors.full_name}>
          <input id="recep_name" name="full_name" autoComplete="off" maxLength={60} className={cls("full_name")} />
        </Field>
        <Field label={t("settings.newCode", { n: PIN_LENGTH })} htmlFor="recep_pin" error={errors.pin}>
          <input id="recep_pin" name="pin" type="password" {...digits} className={cls("pin")} />
        </Field>
        <Field label={t("settings.confirmCode")} htmlFor="recep_confirm" error={errors.confirm}>
          <input id="recep_confirm" name="confirm" type="password" {...digits} className={cls("confirm")} />
        </Field>
        <div className="lg:pt-[1.7rem]">
          <SubmitButton pending={pending} pendingLabel={t("rooms.adding")} className="btn-primary w-full">
            {t("recep.addButton")}
          </SubmitButton>
        </div>
      </div>

      {state?.error ? (
        <p role="alert" className="mt-3 text-sm font-medium text-rose-700">
          {state.error}
        </p>
      ) : null}
      {state?.success ? (
        <p role="status" className="mt-3 text-sm font-medium text-emerald-800">
          {t("recep.added")}
        </p>
      ) : null}
    </form>
  );
}
