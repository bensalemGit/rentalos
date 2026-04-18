"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchSignatureWorkflow, createCanonicalPublicLink } from "../../_lib/api";
import type {
  CanonicalSignatureWorkflow,
  CanonicalSignatureTask,
} from "../../_lib/canonical-signature.types";

type PageProps = {
  params: { leaseId: string };
};

export default function SignatureWorkflowTestPage({ params }: PageProps) {
  const leaseId = params.leaseId;

  const [data, setData] = useState<CanonicalSignatureWorkflow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
  const [actionResult, setActionResult] = useState<Record<string, unknown> | null>(null);

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchSignatureWorkflow(leaseId);
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [leaseId]);

  const tasks = useMemo(() => data?.tasks ?? [], [data]);

  async function handleCreateLink(task: CanonicalSignatureTask, force = false) {
    try {
      setBusyTaskId(task.id);
      setActionResult(null);

      const payload = {
        leaseId: task.leaseId,
        documentType: task.documentType,
        signerRole: task.signerRole,
        phase: task.phase,
        force,
        tenantId:
          task.signerRef.kind === "TENANT" ? task.signerRef.tenantId : undefined,
        guaranteeId:
          task.signerRef.kind === "GUARANTOR" ? task.signerRef.guaranteeId : undefined,
      } as const;

      const res = await createCanonicalPublicLink(payload);
      setActionResult(res as Record<string, unknown>);
      await load();
    } catch (e) {
      setActionResult({
        error: e instanceof Error ? e.message : "Erreur inconnue",
      });
    } finally {
      setBusyTaskId(null);
    }
  }

  return (
    <main className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Signature workflow test</h1>
        <p className="text-sm text-gray-600">Lease: {leaseId}</p>
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => void load()}
          className="rounded border px-3 py-2 text-sm"
        >
          Recharger
        </button>
      </div>

      {loading && <p>Chargement…</p>}
      {error && <p className="text-red-600">{error}</p>}

      {!loading && !error && (
        <div className="space-y-4">
          {tasks.length === 0 ? (
            <p>Aucune tâche.</p>
          ) : (
            tasks.map((task) => {
              const canUseCanonicalSend =
                task.documentType === "LEASE_CONTRACT" ||
                (task.documentType === "GUARANTEE_ACT" && task.signerRole === "GUARANTOR") ||
                (task.documentType === "EDL_ENTRY") ||
                (task.documentType === "INVENTORY_ENTRY" && task.signerRole === "TENANT");

              return (
                <section key={task.id} className="rounded border p-4 space-y-2">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h2 className="font-medium">{task.documentLabel}</h2>
                      <p className="text-sm text-gray-600">
                        {task.signerRole} — {task.signerName}
                      </p>
                    </div>
                    <div className="text-sm text-gray-600">{task.id}</div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="font-medium">documentType:</span> {task.documentType}
                    </div>
                    <div>
                      <span className="font-medium">phase:</span> {task.phase}
                    </div>
                    <div>
                      <span className="font-medium">documentStatus:</span> {task.documentStatus}
                    </div>
                    <div>
                      <span className="font-medium">signatureStatus:</span> {task.signatureStatus}
                    </div>
                    <div>
                      <span className="font-medium">publicLinkStatus:</span> {task.publicLinkStatus}
                    </div>
                    <div>
                      <span className="font-medium">signatureMode:</span>{" "}
                      {task.signatureMode ?? "null"}
                    </div>
                  </div>

                  {task.blockingReason && (
                    <p className="text-sm text-red-600">
                      <span className="font-medium">Blocage:</span> {task.blockingReason}
                    </p>
                  )}

                  {task.progressText && (
                    <p className="text-sm text-blue-700">
                      <span className="font-medium">Progression:</span> {task.progressText}
                    </p>
                  )}

                  <div className="flex flex-wrap gap-2 pt-2">
                    <button
                      type="button"
                      disabled={!canUseCanonicalSend || busyTaskId === task.id}
                      onClick={() => void handleCreateLink(task, false)}
                      className="rounded border px-3 py-2 text-sm disabled:opacity-50"
                    >
                      Créer lien canonique
                    </button>

                    <button
                      type="button"
                      disabled={!canUseCanonicalSend || busyTaskId === task.id}
                      onClick={() => void handleCreateLink(task, true)}
                      className="rounded border px-3 py-2 text-sm disabled:opacity-50"
                    >
                      Créer lien canonique (force)
                    </button>
                  </div>
                </section>
              );
            })
          )}
        </div>
      )}

      <section className="rounded border p-4">
        <h2 className="font-medium mb-2">Dernier résultat action</h2>
        <pre className="text-xs whitespace-pre-wrap">
          {JSON.stringify(actionResult, null, 2)}
        </pre>
      </section>

      <section className="rounded border p-4">
        <h2 className="font-medium mb-2">Payload brut workflow</h2>
        <pre className="text-xs whitespace-pre-wrap">
          {JSON.stringify(data, null, 2)}
        </pre>
      </section>
    </main>
  );
}