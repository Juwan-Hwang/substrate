/**
 * Experiment submission form — uses React Hook Form + useActionState (React 19).
 *
 * Connects to the Crucible Server Action via `useActionState`.
 * Validates with Zod resolver, shows progressive enhancement feedback.
 */
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useActionState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { type ExperimentActionState, submitExperiment } from '../app/actions/experiments';

const schema = z.object({
  name: z.string().min(1, 'Name is required').max(120),
  subsystem: z.enum(['lattice', 'crucible', 'archive']),
  parameters: z.string().default('{}'),
});

type FormData = z.infer<typeof schema>;

const initialState: ExperimentActionState = { ok: false };

export function ExperimentForm() {
  const [state, formAction, isPending] = useActionState(submitExperiment, initialState);

  const {
    register,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', subsystem: 'crucible', parameters: '{}' },
  });

  return (
    <form action={formAction} className="aevum-glass-card mt-8 space-y-6 p-6">
      <div>
        <label htmlFor="name" className="mb-2 block text-sm font-medium text-text-primary">
          Experiment Name
        </label>
        <input
          {...register('name')}
          id="name"
          name="name"
          type="text"
          className="w-full rounded-lg border border-border-default bg-bg-muted px-4 py-2 text-text-primary placeholder-text-muted focus:border-accent focus:outline-none"
          placeholder="e.g. GPU layout benchmark"
        />
        {errors.name && <p className="mt-1 text-sm text-danger">{errors.name.message}</p>}
      </div>

      <div>
        <label htmlFor="subsystem" className="mb-2 block text-sm font-medium text-text-primary">
          Subsystem
        </label>
        <select
          {...register('subsystem')}
          id="subsystem"
          name="subsystem"
          className="w-full rounded-lg border border-border-default bg-bg-muted px-4 py-2 text-text-primary focus:border-accent focus:outline-none"
        >
          <option value="lattice">Lattice</option>
          <option value="crucible">Crucible</option>
          <option value="archive">Archive</option>
        </select>
      </div>

      <div>
        <label htmlFor="parameters" className="mb-2 block text-sm font-medium text-text-primary">
          Parameters (JSON)
        </label>
        <textarea
          {...register('parameters')}
          id="parameters"
          name="parameters"
          rows={4}
          className="w-full rounded-lg border border-border-default bg-bg-muted px-4 py-2 font-mono text-sm text-text-primary placeholder-text-muted focus:border-accent focus:outline-none"
          placeholder='{"iterations": 1000, "dt": 0.1}'
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        aria-busy={isPending}
        className="btn btn-primary w-full"
      >
        {isPending ? 'Submitting...' : 'Submit Experiment'}
      </button>

      {state.ok && state.id && (
        <p className="text-sm text-success">Experiment queued (ID: {state.id}).</p>
      )}
      {state.error && <p className="text-sm text-danger">{state.error}</p>}
    </form>
  );
}
