// oxlint-disable typescript/no-unsafe-call, typescript/no-unsafe-return
import { useState } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Copy,
  Plus,
  Trash2,
  RefreshCw,
  MonitorSmartphone,
  BookMarked,
  Rss,
} from "lucide-react";
import { getAuthSessionFn } from "src/server/middleware";
import {
  getKoboTokensFn,
  createKoboTokenFn,
  deleteKoboTokenFn,
  getOpdsKeyFn,
  regenerateOpdsKeyFn,
} from "src/server/sync-settings";
import { Button } from "src/components/ui/button";
import { Input } from "src/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "src/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "src/components/ui/dialog";
import { Label } from "src/components/ui/label";

export const Route = createFileRoute("/_authed/settings/sync")({
  beforeLoad: async () => {
    const session = await getAuthSessionFn();
    if (!session) {
      // eslint-disable-next-line only-throw-error
      throw redirect({ to: "/" });
    }
  },
  component: SyncSettingsPage,
});

async function copyToClipboard(text: string, label: string): Promise<void> {
  await navigator.clipboard.writeText(text);
  toast.success(`${label} copied to clipboard`);
}

function formatDate(date: Date | string | null | undefined): string {
  if (!date) {
    return "Unknown";
  }
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getOrigin(): string {
  return globalThis.location?.origin ?? "";
}

// ── KOSync Section ────────────────────────────────────────────────────────────

function KOSyncSection(): JSX.Element {
  const serverUrl = `${getOrigin()}/api/kosync`;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <MonitorSmartphone className="size-5" />
          <CardTitle>KOSync (KOReader)</CardTitle>
        </div>
        <CardDescription>
          Sync reading progress from KOReader using the KOSync plugin.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Connect KOReader by entering your Excalibre email and password in the
          KOSync plugin settings. Use the server URL below when prompted.
        </p>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Server URL</Label>
          <div className="flex items-center gap-2">
            <Input readOnly value={serverUrl} className="font-mono text-sm" />
            <Button
              variant="outline"
              size="icon"
              onClick={() => void copyToClipboard(serverUrl, "Server URL")}
            >
              <Copy className="size-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Kobo Sync Section ─────────────────────────────────────────────────────────

type KoboToken = {
  id: number;
  token: string;
  deviceName: string | null;
  createdAt: Date;
};

type NewlyCreatedToken = {
  id: number;
  token: string;
  deviceName: string | null;
  createdAt: Date;
  userId: string;
};

function AddKoboDeviceDialog({
  onCreated,
}: {
  onCreated: (token: NewlyCreatedToken) => void;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const [deviceName, setDeviceName] = useState("");
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (name: string) =>
      createKoboTokenFn({ data: { deviceName: name || undefined } }),
    onSuccess: (token) => {
      onCreated(token);
      setOpen(false);
      setDeviceName("");
      void queryClient.invalidateQueries({ queryKey: ["sync", "koboTokens"] });
    },
    onError: (error: Error) => {
      toast.error(error.message ?? "Failed to create device token");
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus className="mr-1 size-4" />
          Add Kobo Device
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Kobo Device</DialogTitle>
          <DialogDescription>
            Give your Kobo a name to identify it. A unique sync token will be
            generated for use in the Kobo configuration.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="device-name">Device Name (optional)</Label>
          <Input
            id="device-name"
            placeholder="e.g. My Kobo Libra"
            value={deviceName}
            onChange={(e) => setDeviceName(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={createMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={() => createMutation.mutate(deviceName)}
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? "Creating..." : "Create Token"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NewTokenDialog({
  token,
  onClose,
}: {
  token: NewlyCreatedToken;
  onClose: () => void;
}): JSX.Element {
  const apiUrl = `${getOrigin()}/api/kobo/${token.token}/v1`;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Device Token Created</DialogTitle>
          <DialogDescription>
            Configure your Kobo by entering the API URL below into the Kobo
            store settings. This is the only time you will see this URL.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Kobo API URL</Label>
          <div className="flex items-center gap-2">
            <Input readOnly value={apiUrl} className="font-mono text-xs" />
            <Button
              variant="outline"
              size="icon"
              onClick={() => void copyToClipboard(apiUrl, "Kobo API URL")}
            >
              <Copy className="size-4" />
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          On your Kobo device, go to{" "}
          <strong>Settings &rarr; Beta Features</strong> and enter this URL as
          the custom API endpoint. Then log in with your Excalibre credentials.
        </p>
        <DialogFooter>
          <Button onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeviceActions({
  tokenId,
  confirmDeleteId,
  onConfirmDelete,
  onCancelDelete,
  onDelete,
  isDeleting,
}: {
  tokenId: number;
  confirmDeleteId: number | null;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  onDelete: () => void;
  isDeleting: boolean;
}): JSX.Element {
  if (confirmDeleteId === tokenId) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Are you sure?</span>
        <Button
          variant="destructive"
          size="sm"
          onClick={onDelete}
          disabled={isDeleting}
        >
          Delete
        </Button>
        <Button variant="outline" size="sm" onClick={onCancelDelete}>
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <Button variant="ghost" size="icon" onClick={onConfirmDelete}>
      <Trash2 className="size-4 text-destructive" />
    </Button>
  );
}

function TokenList({
  tokens,
  confirmDeleteId,
  setConfirmDeleteId,
  onDelete,
  isDeleting,
}: {
  tokens: KoboToken[];
  confirmDeleteId: number | null;
  setConfirmDeleteId: (id: number | null) => void;
  onDelete: (id: number) => void;
  isDeleting: boolean;
}): JSX.Element {
  if (tokens.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No Kobo devices configured. Click &quot;Add Kobo Device&quot; to get
        started.
      </p>
    );
  }

  return (
    <div className="divide-y rounded-md border">
      {tokens.map((t) => (
        <div key={t.id} className="flex items-center justify-between px-4 py-3">
          <div>
            <p className="text-sm font-medium">
              {t.deviceName ?? "Unnamed Device"}
            </p>
            <p className="text-xs text-muted-foreground">
              Added {formatDate(t.createdAt)}
            </p>
          </div>
          <DeviceActions
            tokenId={t.id}
            confirmDeleteId={confirmDeleteId}
            onConfirmDelete={() => setConfirmDeleteId(t.id)}
            onCancelDelete={() => setConfirmDeleteId(null)}
            onDelete={() => onDelete(t.id)}
            isDeleting={isDeleting}
          />
        </div>
      ))}
    </div>
  );
}

function KoboSyncSection(): JSX.Element {
  const queryClient = useQueryClient();
  const [newToken, setNewToken] = useState<NewlyCreatedToken | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const { data: tokens = [], isLoading } = useQuery({
    queryKey: ["sync", "koboTokens"],
    queryFn: async () => getKoboTokensFn(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteKoboTokenFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Device removed");
      setConfirmDeleteId(null);
      void queryClient.invalidateQueries({ queryKey: ["sync", "koboTokens"] });
    },
    onError: (error: Error) => {
      toast.error(error.message ?? "Failed to remove device");
    },
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookMarked className="size-5" />
            <CardTitle>Kobo Sync</CardTitle>
          </div>
          <AddKoboDeviceDialog onCreated={setNewToken} />
        </div>
        <CardDescription>
          Sync your library directly to Kobo e-readers via the Kobo store API.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Each Kobo device gets its own token. After adding a device, configure
          the Kobo API URL on your device under{" "}
          <strong>Settings &rarr; Beta Features</strong>.
        </p>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading devices...</p>
        ) : (
          <TokenList
            tokens={tokens as KoboToken[]}
            confirmDeleteId={confirmDeleteId}
            setConfirmDeleteId={setConfirmDeleteId}
            onDelete={(id) => deleteMutation.mutate(id)}
            isDeleting={deleteMutation.isPending}
          />
        )}
      </CardContent>

      {newToken && (
        <NewTokenDialog token={newToken} onClose={() => setNewToken(null)} />
      )}
    </Card>
  );
}

// ── OPDS Section ──────────────────────────────────────────────────────────────

type OpdsKey = {
  id: number;
  userId: string;
  apiKey: string;
  createdAt: Date;
};

function OpdsSection(): JSX.Element {
  const queryClient = useQueryClient();

  const { data: key, isLoading } = useQuery({
    queryKey: ["sync", "opdsKey"],
    queryFn: async () => getOpdsKeyFn(),
  });

  const regenerateMutation = useMutation({
    mutationFn: async () => regenerateOpdsKeyFn(),
    onSuccess: () => {
      toast.success("OPDS API key regenerated");
      void queryClient.invalidateQueries({ queryKey: ["sync", "opdsKey"] });
    },
    onError: (error: Error) => {
      toast.error(error.message ?? "Failed to regenerate key");
    },
  });

  const opdsKey = key as OpdsKey | undefined;
  const opdsUrl = opdsKey
    ? `${getOrigin()}/api/opds?apikey=${opdsKey.apiKey}`
    : "";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Rss className="size-5" />
          <CardTitle>OPDS Feed</CardTitle>
        </div>
        <CardDescription>
          Access your library catalog from any OPDS-compatible reader app.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Use the OPDS feed URL below in any OPDS-compatible app such as Panels,
          Kybook, or Moon+ Reader. Keep this URL private &mdash; it grants
          access to your library.
        </p>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">
                OPDS Feed URL
              </Label>
              <div className="flex items-center gap-2">
                <Input readOnly value={opdsUrl} className="font-mono text-xs" />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => void copyToClipboard(opdsUrl, "OPDS feed URL")}
                  disabled={!opdsUrl}
                >
                  <Copy className="size-4" />
                </Button>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => regenerateMutation.mutate()}
              disabled={regenerateMutation.isPending}
            >
              <RefreshCw className="mr-1 size-4" />
              {regenerateMutation.isPending
                ? "Regenerating..."
                : "Regenerate API Key"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

function SyncSettingsPage(): JSX.Element {
  return (
    <div>
      <div>
        <h1 className="text-2xl font-bold">Sync Services</h1>
        <p className="mt-2 text-muted-foreground">
          Configure reading progress sync and library access for external
          devices and apps.
        </p>
      </div>

      <div className="mt-6 space-y-6">
        <KOSyncSection />
        <KoboSyncSection />
        <OpdsSection />
      </div>
    </div>
  );
}
