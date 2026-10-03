import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { SurveyField, SurveyAnswer } from "@/types/surveyField";

interface SurveyFormRendererProps {
  fields: SurveyField[];
  onSubmit: (answers: Record<string, SurveyAnswer>) => void;
  submitting?: boolean;
  /** If provided, renders as part of a parent form instead of standalone */
  renderOnly?: boolean;
  /** External trigger ref for parent forms */
  formRef?: React.MutableRefObject<{ triggerSubmit: () => void; isValid: () => boolean; getAnswers: () => Record<string, SurveyAnswer> } | null>;
}

function buildSchema(fields: SurveyField[]) {
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const field of fields) {
    if (field.type === 'static_text') continue; // no validation needed
    switch (field.type) {
      case 'text':
        if (field.required) {
          shape[field.id] = z.string().min(1, { message: '내용을 입력해주세요' });
        } else {
          shape[field.id] = z.string().optional().default('');
        }
        break;
      case 'multiple_choice':
        if (field.required) {
          shape[field.id] = z.array(z.string()).min(1, { message: '최소 1개 이상 선택해주세요' });
        } else {
          shape[field.id] = z.array(z.string()).optional().default([]);
        }
        break;
      case 'consent':
        shape[field.id] = z.literal(true, {
          errorMap: () => ({ message: '동의가 필요합니다' }),
        });
        break;
    }
  }

  return z.object(shape);
}

function getDefaults(fields: SurveyField[]): Record<string, any> {
  const defaults: Record<string, any> = {};
  for (const field of fields) {
    if (field.type === 'static_text') continue;
    switch (field.type) {
      case 'text':
        defaults[field.id] = '';
        break;
      case 'multiple_choice':
        defaults[field.id] = [];
        break;
      case 'consent':
        defaults[field.id] = false;
        break;
    }
  }
  return defaults;
}

function renderBold(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/).map((part, i) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={i}>{part.slice(2, -2)}</strong>
      : part
  );
}

const FieldLabel = ({ label, required }: { label: string; required: boolean }) => (
  <Label className="block text-[13px] font-bold whitespace-pre-wrap">
    {renderBold(label)}
    {required
      ? <span className="text-destructive ml-1">*</span>
      : <span className="ml-1 font-medium text-muted-foreground">(선택)</span>}
  </Label>
);

interface ConsentRowProps {
  text: string;
  link?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

/** 첫 줄은 동의 제목, 나머지 줄은 [보기]로 펼치는 상세 내용 */
const ConsentRow = ({ text, link, checked, onCheckedChange }: ConsentRowProps) => {
  const [expanded, setExpanded] = useState(false);
  const [title, ...rest] = text.split('\n');
  const detail = rest.join('\n').trim();

  return (
    <div>
      <div className="flex items-center gap-2">
        <label className="flex flex-1 items-center gap-2 cursor-pointer">
          <Checkbox
            checked={checked}
            onCheckedChange={(value) => onCheckedChange(value === true)}
          />
          <span className="text-[13px] text-foreground">
            {renderBold(title)}
            <span className="text-destructive ml-1">*</span>
          </span>
        </label>
        {detail ? (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="shrink-0 text-xs text-muted-foreground underline underline-offset-2"
          >
            {expanded ? '접기' : '보기'}
          </button>
        ) : link ? (
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 text-xs text-muted-foreground underline underline-offset-2"
          >
            보기
          </a>
        ) : null}
      </div>
      {detail && expanded && (
        <div className="mt-2 rounded-lg bg-muted px-3 py-2 text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap">
          {renderBold(detail)}
        </div>
      )}
    </div>
  );
};

const SurveyFormRenderer = ({ fields, onSubmit, submitting, renderOnly, formRef }: SurveyFormRendererProps) => {
  const schema = useMemo(() => buildSchema(fields), [fields]);
  const defaults = useMemo(() => getDefaults(fields), [fields]);

  const {
    control,
    handleSubmit,
    formState: { errors, isValid },
    getValues,
    trigger,
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: defaults,
    mode: 'onChange',
  });

  // Expose form API to parent
  if (formRef) {
    formRef.current = {
      triggerSubmit: async () => {
        const valid = await trigger();
        if (valid) {
          const values = getValues();
          const answers: Record<string, SurveyAnswer> = {};
          for (const field of fields) {
            if (field.type === 'static_text') continue;
            answers[field.id] = { fieldId: field.id, value: values[field.id] };
          }
          onSubmit(answers);
        }
      },
      isValid: () => isValid,
      getAnswers: () => {
        const values = getValues();
        const answers: Record<string, SurveyAnswer> = {};
        for (const field of fields) {
          if (field.type === 'static_text') continue;
          answers[field.id] = { fieldId: field.id, value: values[field.id] };
        }
        return answers;
      },
    };
  }

  const onFormSubmit = (data: any) => {
    const answers: Record<string, SurveyAnswer> = {};
    for (const field of fields) {
      if (field.type === 'static_text') continue;
      answers[field.id] = { fieldId: field.id, value: data[field.id] };
    }
    onSubmit(answers);
  };

  if (fields.length === 0) return null;

  const content = (
    <div className="space-y-4">
      {fields.map((field) => (
        <div key={field.id} className="space-y-1.5">
          {/* Text field */}
          {field.type === 'text' && (
            <>
              <FieldLabel label={field.label} required={field.required} />
              <Controller
                name={field.id}
                control={control}
                render={({ field: formField }) => (
                  <Textarea
                    placeholder="답변을 입력해 주세요"
                    value={formField.value || ''}
                    onChange={formField.onChange}
                    rows={2}
                    maxLength={1000}
                    className="min-h-0 rounded-xl resize-none"
                  />
                )}
              />
              {errors[field.id] && (
                <p className="text-xs text-destructive">{(errors[field.id] as any)?.message}</p>
              )}
            </>
          )}

          {/* Multiple choice field */}
          {field.type === 'multiple_choice' && (
            <>
              <FieldLabel label={field.label} required={field.required} />
              <Controller
                name={field.id}
                control={control}
                render={({ field: formField }) => (
                  <div className="flex flex-wrap gap-1.5">
                    {field.options?.map((option, optIdx) => {
                      if (!option.trim()) return null;
                      const current = (formField.value as string[]) || [];
                      const checked = current.includes(option);
                      return (
                        <button
                          key={optIdx}
                          type="button"
                          aria-pressed={checked}
                          onClick={() =>
                            formField.onChange(
                              checked ? current.filter((v) => v !== option) : [...current, option]
                            )
                          }
                          className={cn(
                            "rounded-full border px-3 py-1.5 text-[13px] font-semibold transition-colors",
                            checked
                              ? "border-primary bg-primary/10 text-secondary-foreground"
                              : "border-border text-muted-foreground hover:bg-muted"
                          )}
                        >
                          {option}
                        </button>
                      );
                    })}
                  </div>
                )}
              />
              {errors[field.id] && (
                <p className="text-xs text-destructive">{(errors[field.id] as any)?.message}</p>
              )}
            </>
          )}

          {/* Consent field */}
          {field.type === 'consent' && (
            <>
              <Controller
                name={field.id}
                control={control}
                render={({ field: formField }) => (
                  <ConsentRow
                    text={field.consentText || field.label}
                    link={field.consentLink}
                    checked={formField.value === true}
                    onCheckedChange={(checked) => formField.onChange(checked)}
                  />
                )}
              />
              {errors[field.id] && (
                <p className="text-xs text-destructive">{(errors[field.id] as any)?.message}</p>
              )}
            </>
          )}

          {/* Static text field */}
          {field.type === 'static_text' && (
            <div className="text-sm text-muted-foreground whitespace-pre-wrap py-1">
              {field.label.split(/(\*\*[^*]+\*\*)/).map((part, i) =>
                part.startsWith('**') && part.endsWith('**')
                  ? <strong key={i} className="text-foreground">{part.slice(2, -2)}</strong>
                  : part
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );

  if (renderOnly) {
    return content;
  }

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
      {content}
    </form>
  );
};

export default SurveyFormRenderer;
