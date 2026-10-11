import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, ListChecks, ShieldAlert } from 'lucide-react';
import { Button, Spinner } from '@librechat/client';
import { apiBaseUrl, QueryKeys, request } from 'librechat-data-provider';
import { useNavigate } from 'react-router-dom';
import { useHasCapability } from '~/data-provider';
import { useDocumentTitle } from '~/hooks';

type AdminModelEntry = { model: string; enabled: boolean };
type AdminModelsResponse = Record<string, AdminModelEntry[]>;

const ACCESS_ADMIN = 'access:admin';
const adminModelsUrl = () => `${apiBaseUrl()}/api/admin/models`;
const adminModelsBulkUrl = () => `${adminModelsUrl()}/bulk`;

/** Accept plain IDs, Markdown bullets/backticks, and context-length notes. */
function parseAllowlist(value: string): string[] {
  return [...new Set(value.split(/\r?\n/).map((line) =>
    line
      .trim()
      .replace(/^[-*+]\s*/, '')
      .replace(/^`|`$/g, '')
      .replace(/\s*\([^)]*context length[^)]*\)\s*$/i, '')
      .trim(),
  ).filter(Boolean))];
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <section className="border-chart-widget-stroke bg-chart-widget-surface rounded-xl border p-5">
      {children}
    </section>
  );
}

export default function OpenAIModelsPage() {
  const navigate = useNavigate();
  const canAccessAdmin = useHasCapability(ACCESS_ADMIN);
  const queryClient = useQueryClient();
  const [allowlistText, setAllowlistText] = useState('');
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string }>();

  useDocumentTitle('OpenAI-modeller | LibreChat');

  const modelsQuery = useQuery<AdminModelsResponse>(
    ['adminModels'],
    () => request.get(adminModelsUrl()),
    { enabled: canAccessAdmin, retry: false, refetchOnWindowFocus: false },
  );

  const openAIEntry = useMemo(() => {
    const entry = Object.entries(modelsQuery.data ?? {}).find(
      ([endpoint]) => endpoint.toLowerCase() === 'openai',
    );
    return entry ? { endpoint: entry[0], models: entry[1] } : undefined;
  }, [modelsQuery.data]);

  const allowlist = useMemo(() => parseAllowlist(allowlistText), [allowlistText]);
  const availableNames = useMemo(
    () => new Set((openAIEntry?.models ?? []).map(({ model }) => model)),
    [openAIEntry],
  );
  const matched = useMemo(
    () => allowlist.filter((model) => availableNames.has(model)),
    [allowlist, availableNames],
  );
  const unknown = useMemo(
    () => allowlist.filter((model) => !availableNames.has(model)),
    [allowlist, availableNames],
  );

  const applyMutation = useMutation(
    ({ endpoint, disabledModels }: { endpoint: string; disabledModels: string[] }) =>
      request.post(adminModelsBulkUrl(), { endpoint, disabledModels }),
    {
      onSuccess: async () => {
        await queryClient.invalidateQueries([QueryKeys.models]);
        await queryClient.invalidateQueries(['adminModels']);
        await modelsQuery.refetch();
        setNotice({ kind: 'success', text: 'OpenAI-modellerne er opdateret.' });
      },
      onError: () =>
        setNotice({
          kind: 'error',
          text: 'Kunne ikke opdatere modellerne. Kontrollér admin-adgang og prøv igen.',
        }),
    },
  );

  const currentEnabled = openAIEntry?.models.filter(({ enabled }) => enabled).length ?? 0;
  const availableCount = openAIEntry?.models.length ?? 0;

  const applyAllowlist = () => {
    if (!openAIEntry || matched.length === 0) return;
    const enabled = new Set(matched);
    const disabledModels = openAIEntry.models
      .filter(({ model }) => !enabled.has(model))
      .map(({ model }) => model);
    setNotice(undefined);
    applyMutation.mutate({ endpoint: openAIEntry.endpoint, disabledModels });
  };

  if (!canAccessAdmin) {
    return (
      <div className="bg-surface-primary-alt text-text-primary flex h-full min-w-0 flex-col">
        <main className="mx-auto flex w-full max-w-3xl flex-1 items-center px-5 py-10">
          <Panel>
            <div className="flex items-start gap-3">
              <ShieldAlert className="text-status-warning mt-0.5 size-5 shrink-0" aria-hidden="true" />
              <div>
                <h1 className="text-lg font-semibold">Administratoradgang kræves</h1>
                <p className="text-text-secondary mt-1 text-sm">
                  Denne side er kun tilgængelig for administratorer.
                </p>
                <Button className="mt-4" variant="outline" onClick={() => navigate('/c/new')}>
                  Tilbage til chat
                </Button>
              </div>
            </div>
          </Panel>
        </main>
      </div>
    );
  }

  return (
    <div className="bg-surface-primary-alt text-text-primary flex h-full min-w-0 flex-col">
      <header className="bg-surface-primary-alt border-border-light flex min-h-14 shrink-0 items-center gap-3 border-b px-5 sm:px-8">
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label="Tilbage til chat"
          onClick={() => navigate('/c/new')}
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
        </Button>
        <div className="flex min-w-0 items-center gap-2">
          <ListChecks className="text-text-secondary size-5" aria-hidden="true" />
          <h1 className="truncate text-base font-semibold">OpenAI-modeladministration</h1>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-8 sm:py-8">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
          <div>
            <h2 className="text-text-primary text-2xl font-semibold">Aktive OpenAI-modeller</h2>
            <p className="text-text-secondary mt-2 max-w-3xl text-sm leading-6">
              Indsæt de model-ID’er, der skal være aktive, ét pr. linje. Modeller, der findes
              i LibreChat, men ikke står på listen, bliver deaktiveret. Ændringen gælder globalt
              for OpenAI-endpointet; andre udbydere påvirkes ikke.
            </p>
          </div>

          <Panel>
            {modelsQuery.isLoading && (
              <div className="text-text-secondary flex items-center gap-2 text-sm">
                <Spinner className="size-4" /> Henter OpenAI-modeller…
              </div>
            )}
            {modelsQuery.isError && (
              <div className="text-status-error text-sm">
                Kunne ikke hente modeloversigten. Kontrollér admin-adgang og prøv igen.
              </div>
            )}
            {!modelsQuery.isLoading && !modelsQuery.isError && !openAIEntry && (
              <div className="text-status-error text-sm">
                OpenAI-endpointet blev ikke fundet i den indlæste modeloversigt.
              </div>
            )}

            {openAIEntry && (
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
                <span><strong>{availableCount}</strong> modeller fundet</span>
                <span><strong>{currentEnabled}</strong> aktive nu</span>
                {allowlist.length > 0 && (
                  <span><strong>{matched.length}</strong> af {allowlist.length} på listen genkendes</span>
                )}
              </div>
            )}
          </Panel>

          <Panel>
            <label htmlFor="openai-model-allowlist" className="mb-2 block text-sm font-medium">
              Model-ID’er, der skal være aktive
            </label>
            <textarea
              id="openai-model-allowlist"
              value={allowlistText}
              onChange={(event) => {
                setAllowlistText(event.target.value);
                setNotice(undefined);
              }}
              placeholder={'gpt-5\ngpt-4o-mini\no3'}
              className="border-border-medium bg-surface-primary text-text-primary min-h-72 w-full rounded-lg border p-3 font-mono text-sm focus-visible:ring-2 focus-visible:outline-hidden"
              spellCheck={false}
              aria-describedby="openai-model-list-help"
            />
            <p id="openai-model-list-help" className="text-text-secondary mt-2 text-xs">
              Du kan indsætte en ren liste eller Markdown-punkter. Gentagelser fjernes automatisk.
            </p>

            {unknown.length > 0 && (
              <div className="border-status-warning/30 bg-status-warning/5 text-text-secondary mt-4 rounded-lg border p-3 text-sm">
                <strong className="text-text-primary">Disse ID’er blev ikke fundet og ignoreres:</strong>
                <div className="mt-1 break-words font-mono text-xs">{unknown.join(', ')}</div>
              </div>
            )}

            {allowlist.length > 0 && matched.length === 0 && (
              <p className="text-status-error mt-3 text-sm">
                Ingen af de indtastede modeller findes. Listen kan ikke anvendes for at undgå at deaktivere alle modeller ved en fejl.
              </p>
            )}

            {notice && (
              <p
                className={`mt-4 text-sm ${notice.kind === 'error' ? 'text-status-error' : 'text-status-success'}`}
                role="status"
              >
                {notice.kind === 'success' && <Check className="mr-1 inline size-4" aria-hidden="true" />}
                {notice.text}
              </p>
            )}

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border-light pt-4">
              <p className="text-text-secondary text-xs">
                {openAIEntry && allowlist.length > 0
                  ? `${matched.length} aktiveres · ${Math.max(0, availableCount - matched.length)} deaktiveres`
                  : 'Indsæt en model-liste for at se ændringsoversigten.'}
              </p>
              <Button
                type="button"
                variant="submit"
                disabled={!openAIEntry || matched.length === 0 || applyMutation.isLoading}
                onClick={applyAllowlist}
              >
                {applyMutation.isLoading ? 'Gemmer…' : 'Anvend model-liste'}
              </Button>
            </div>
          </Panel>
        </div>
      </main>
    </div>
  );
}
