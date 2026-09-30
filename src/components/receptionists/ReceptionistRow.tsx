"use client";

import { startTransition, useActionState, useEffect, useRef, useState, useTransition } from "react";
import { deleteReceptionist, setReceptionistActive, setReceptionistCode } from "@/app/(app)/receptionists/actions";
import { Field } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { PIN_LENGTH } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { translator, type Lang } from "@/lib/i18n";
import type { Receptionist } from "@/lib/types";

/** One receptionist: status, number of check-ins recorded, and the admin's controls. */
export function ReceptionistRow({
  receptionist,
  checkIns,
  lang,
}: {
  receptionist: Receptionist;
  checkIns: number;
  lang: Lang;
}) {
  const t = translator(lang);
  const [pending, startAction] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [state, formAction, saving] = useActionState(setReceptionistCode.bind(null, receptionist.id), undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const errors = state?.fieldErrors ?? {};

  useEffect(() => {
    if (state?.success) {
      formRef.current?.reset();
      setEditing(false);
    }
  }, [state]);

  const link = "text-xs font-medium underline underline-offset-2 text-ink-600 hover:text-ink-950 disabled:opacity-60";
  const digits = { inputMode: "numeric" as const, pattern: "\\d*", maxLength: PIN_LENGTH, autoComplete: "off" };

  return (
    <li className="px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium text-ink-950">{receptionist.full_name}</p>
          <p className="text-xs text-ink-500">
            {t("recep.since", { when: formatDate(receptionist.created_at, lang) })} - {t("recep.checkIns", { n: checkIns })}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span
            className={`inline-flex items-center gap-1.5 text-xs font-medium ${
              receptionist.is_active ? "text-emerald-800" : "text-ink-500"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${receptionist.is_active ? "bg-emerald-500" : "bg-ink-400"}`}
              aria-hidden="true"
            />
            {receptionist.is_active ? t("recep.active") : t("recep.inactive")}
          </span>

          <button type="button" className={link} onClick={() => setEditing((open) => !open)}>
            {t("recep.changeCode")}
          </button>
          <button
            type="button"
            className={link}
            disabled={pending}
            onClick={() => {
              setError(null);
              startAction(async () => {
                const result = await setReceptionistActive(receptionist.id, !receptionist.is_active);
                if (result?.error) setError(result.error);
              });
            }}
          >
            {receptionist.is_active ? t("recep.deactivate") : t("recep.activate")}
          </button>

          {confirmDelete ? (
            <span className="flex items-center gap-2 text-xs text-rose-800">
              {t("recep.deleteConfirm")}
              <button
                type="button"
                className="font-semibold underline underline-offset-2"
                disabled={pending}
                onClick={() => {
                  setError(null);
                  startAction(async () => {
                    const result = await deleteReceptionist(receptionist.id);
                    if (result?.error) setError(result.error);
                    setConfirmDelete(false);
                  });
                }}
              >
                {t("rooms.deleteYes")}
              </button>
              <button type="button" className="underline underline-offset-2" onClick={() => setConfirmDelete(false)}>
                {t("rooms.deleteNo")}
              </button>
            </span>
          ) : (
            <button type="button" className={link} onClick={() => setConfirmDelete(true)}>
              {t("recep.delete")}
            </button>
          )}
        </div>
      </div>

      {error ? (
        <p role="alert" className="mt-2 text-xs font-medium text-rose-700">
          {error}
        </p>
      ) : null}
      {state?.success && !editing ? (
        <p role="status" className="mt-2 text-xs font-medium text-emerald-800">
          {t("settings.codeSaved")}
        </p>
      ) : null}

      {editing ? (
        <form
          ref={formRef}
          noValidate
          className="mt-3 grid gap-3 border-t border-ink-100 pt-3 sm:grid-cols-[1fr_1fr_auto] sm:items-start"
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            startTransition(() => formAction(formData));
          }}
        >
          <Field label={t("settings.newCode", { n: PIN_LENGTH })} htmlFor={`rp-${receptionist.id}`} error={errors.pin}>
            <input
              id={`rp-${receptionist.id}`}
              name="pin"
              type="password"
              {...digits}
              className={errors.pin ? "input input-invalid" : "input"}
            />
          </Field>
          <Field label={t("settings.confirmCode")} htmlFor={`rc-${receptionist.id}`} error={errors.confirm}>
            <input
              id={`rc-${receptionist.id}`}
              name="confirm"
              type="password"
              {...digits}
              className={errors.confirm ? "input input-invalid" : "input"}
            />
          </Field>
          <div className="sm:pt-[1.7rem]">
            <SubmitButton pending={saving} pendingLabel={t("common.saving")} className="btn-primary btn-sm">
              {t("settings.saveCode")}
            </SubmitButton>
          </div>
          {state?.error ? (
            <p role="alert" className="text-xs font-medium text-rose-700 sm:col-span-3">
              {state.error}
            </p>
          ) : null}
        </form>
      ) : null}
    </li>
  );
}
