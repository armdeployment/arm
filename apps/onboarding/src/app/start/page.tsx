"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "../../lib/trpc/client";
import { nextQuestion, progress } from "@arm/questionnaire";
import type { QuestionnaireAnswer } from "@arm/proto";
import { emitOnboardingEvent } from "../../lib/activation";

/**
 * /start — the questionnaire, one question per screen, back/forward,
 * progress bar (docs/guides/03-client-downloader.md §3). No free-text field
 * exists anywhere in this flow (A5) — every option is a structured value.
 *
 * Traversal is driven client-side by `@arm/questionnaire`'s pure
 * `nextQuestion` over the graph fetched once from `getQuestionnaire` — the
 * graph itself is safe to ship to the browser (it is not content, just a
 * structured question DAG). On completion, `submitResponse` computes the
 * recommendation server-side (so the resolved job function + recommended
 * package versions are authoritative and stored).
 */
export default function StartPage() {
  const router = useRouter();
  const { data, isLoading } = trpc.onboarding.getQuestionnaire.useQuery();
  const submit = trpc.onboarding.submitResponse.useMutation();
  const [answers, setAnswers] = useState<QuestionnaireAnswer>({});
  const [history, setHistory] = useState<string[]>([]);
  const [startedEmitted, setStartedEmitted] = useState(false);

  const graph = data?.questionnaire.graph;
  const current = graph ? nextQuestion(graph, answers) : undefined;

  useEffect(() => {
    if (graph && !startedEmitted) {
      setStartedEmitted(true);
      void emitOnboardingEvent("questionnaire_started");
    }
  }, [graph, startedEmitted]);

  useEffect(() => {
    if (graph && current === null && !submit.isPending && !submit.isSuccess) {
      submit.mutate(
        { answers },
        {
          onSuccess: (result) => {
            sessionStorage.setItem("arm_onboarding_result", JSON.stringify(result));
            void emitOnboardingEvent("questionnaire_completed", {
              jobFunctionKey: result.resolvedJobFunctionKey ?? undefined,
              packageVersionId: result.recommendations[0]?.packageVersionId,
            });
            router.push("/start/result");
          },
        },
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph, current, submit.isPending, submit.isSuccess]);

  if (isLoading || !graph) {
    return (
      <div className="onboarding-shell">
        <div className="onboarding-card">
          <p className="onboarding-help">Loading your questionnaire…</p>
        </div>
      </div>
    );
  }

  if (!current) {
    return (
      <div className="onboarding-shell">
        <div className="onboarding-card">
          <p className="onboarding-help">Finding your recommendation…</p>
        </div>
      </div>
    );
  }

  function commitAnswer(nodeId: string, value: QuestionnaireAnswer[string]) {
    setAnswers((a) => ({ ...a, [nodeId]: value }));
    setHistory((h) => [...h, nodeId]);
  }

  function goBack() {
    setHistory((h) => {
      const lastId = h.at(-1);
      if (lastId === undefined) return h;
      setAnswers((a) => {
        const next = { ...a };
        delete next[lastId];
        return next;
      });
      return h.slice(0, -1);
    });
  }

  const selectedMulti = Array.isArray(answers[current.id]) ? (answers[current.id] as string[]) : [];

  function toggleMultiOption(value: string) {
    setAnswers((a) => {
      const existing = Array.isArray(a[current!.id]) ? (a[current!.id] as string[]) : [];
      const next = existing.includes(value) ? existing.filter((v) => v !== value) : [...existing, value];
      return { ...a, [current!.id]: next };
    });
  }

  function continueMulti() {
    setHistory((h) => [...h, current!.id]);
  }

  return (
    <div className="onboarding-shell">
      <div className="onboarding-card">
        <div className="onboarding-progress">
          <div className="onboarding-progress-fill" style={{ width: `${Math.round(progress(graph!, answers) * 100)}%` }} />
        </div>
        <div className="onboarding-prompt">{current.prompt}</div>
        {current.help ? <div className="onboarding-help">{current.help}</div> : null}
        <div className="onboarding-options">
          {current.options.map((opt) => {
            const selected = current.kind === "multi" ? selectedMulti.includes(opt.value) : answers[current.id] === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                className="onboarding-option"
                data-selected={selected}
                onClick={() => (current.kind === "multi" ? toggleMultiOption(opt.value) : commitAnswer(current.id, opt.value))}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
        <div className="onboarding-nav">
          <button type="button" className="onboarding-button onboarding-button-secondary" onClick={goBack} disabled={history.length === 0}>
            Back
          </button>
          {current.kind === "multi" ? (
            <button type="button" className="onboarding-button onboarding-button-primary" onClick={continueMulti}>
              Continue
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
