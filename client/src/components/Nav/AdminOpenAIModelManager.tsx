import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, OGDialog, OGDialogContent, OGDialogDescription, OGDialogFooter, OGDialogHeader, OGDialogTitle } from '@librechat/client';
import { apiBaseUrl, QueryKeys, request } from 'librechat-data-provider';

type AdminModelEntry = { model: string; enabled: boolean };
type AdminModelsResponse = Record<string, AdminModelEntry[]>;

const adminModelsUrl = () => `${apiBaseUrl()}/api/admin/models`;
const adminModelsBulkUrl = () => `${adminModelsUrl()}/bulk`;

/** Parse one model ID per line; markdown bullets, backticks and context notes are accepted. */
function parseAllowlist(value: string): string[] {
  const models = value.split(/\r?\n/).map((line) =>
    line
      .trim()
      .replace(/^[-*+]\s*/, '')
      .replace(/^`|`$/g, '')
      .replace(/\s*\([^)]*context length[^)]*\)\s*$/i, '')
      .trim(),
  );
  return [...new Set(models.filter(Boolean))];
}

export default function AdminOpenAIModelManager({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [allowlistText, setAllowlistText] = useState('');
  const [notice, setNotice] = useState('');

  const modelsQuery = useQuery<AdminModelsResponse>(
    ['adminModels'],
    () => request.get(adminModelsUrl()),
    { enabled: open, retry: false, refetchOnWindowFocus: false },
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
        await modelsQuery.refetch();
        setNotice('OpenAI-modellerne er opdateret.');
      },
      onError: () => setNotice('Kunne ikke opdatere modellerne. Kontrollér admin-adgang og prøv igen.'),
    },
  );

  const applyAllowlist = () => {
    if (!openAIEntry || matched.length === 0) return;
    const enabled = new Set(matched);
    const disabledModels = openAIEntry.models
      .filter(({ model }) => !enabled.has(model))
      .map(({ model }) => model);
    setNotice('');
    applyMutation.mutate({ endpoint: openAIEntry.endpoint, disabledModels });
  };

  const currentEnabled = openAIEntry?.models.filter(({ enabled }) => enabled).length ?? 0;
  const availableCount = openAIEntry?.models.length ?? 0;

  return (
    <OGDialog open={open} onOpenChange={onOpenChange}>
      <OGDialogContent className="w-11/12 max-w-2xl gap-0 overflow-hidden p-0">
        <OGDialogHeader className="px-5 py-5 pr-14 text-left sm:px-6">
          <OGDialogTitle className="text-xl leading-7">Administrér OpenAI-modeller</OGDialogTitle>
          <OGDialogDescription>
            Indsæt de model-ID’er, der skal være aktive, ét pr. linje. Modeller, som findes hos
            OpenAI, men ikke står på listen, bliver deaktiveret.
          </OGDialogDescription>
        </OGDialogHeader>

        <div className="space-y-4 px-5 pb-5 sm:px-6">
          {modelsQuery.isLoading && <p className="text-text-secondary text-sm">Henter OpenAI-modeller…</p>}
          {modelsQuery.isError && (
            <p className="text-text-destructive text-sm">
              Kunne ikke hente modeloversigten. Sørg for, at du er administrator, og prøv igen.
            </p>
          )}
          {!modelsQuery.isLoading && !modelsQuery.isError && !openAIEntry && (
            <p className="text-text-destructive text-sm">
              OpenAI-endpointet blev ikke fundet i den indlæste modeloversigt.
            </p>
          )}

          <div className="text-text-secondary flex flex-wrap gap-x-5 gap-y-1 text-sm">
            <span>{availableCount} OpenAI-modeller fundet</span>
            <span>{currentEnabled} aktive nu</span>
          </div>

          <label htmlFor="openai-model-allowlist" className="text-text-primary block text-sm font-medium">
            Model-ID’er, der skal være aktive
          </label>
          <textarea
            id="openai-model-allowlist"
            value={allowlistText}
            onChange={(event) => {
              setAllowlistText(event.target.value);
              setNotice('');
            }}
            placeholder={'gpt-5\ngpt-4o-mini\no3'}
            className="border-border-medium bg-surface-primary text-text-primary min-h-56 w-full rounded-lg border p-3 font-mono text-sm focus-visible:ring-2 focus-visible:outline-hidden"
            spellCheck={false}
          />

          {allowlist.length > 0 && (
            <div className="space-y-1 text-sm" aria-live="polite">
              <p className="text-text-primary">
                {matched.length} af {allowlist.length} indtastede modeller findes og vil blive aktiveret.
              </p>
              {unknown.length > 0 && (
                <p className="text-text-secondary">
                  Ikke fundet i LibreChat: {unknown.join(', ')}. De ignoreres.
                </p>
              )}
            </div>
          )}

          {notice && <p className="text-text-primary text-sm" role="status">{notice}</p>}
          <p className="text-text-secondary text-xs">
            Ændringen gælder globalt for OpenAI-endpointet. Andre udbydere påvirkes ikke.
          </p>
        </div>

        <OGDialogFooter className="bg-transparent px-5 py-4 sm:px-6">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Annullér
          </Button>
          <Button
            type="button"
            variant="submit"
            disabled={!openAIEntry || matched.length === 0 || applyMutation.isLoading}
            onClick={applyAllowlist}
          >
            {applyMutation.isLoading ? 'Gemmer…' : 'Anvend liste'}
          </Button>
        </OGDialogFooter>
      </OGDialogContent>
    </OGDialog>
  );
}
