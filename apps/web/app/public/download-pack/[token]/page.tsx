'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';

type Status = 'idle' | 'downloading' | 'done' | 'error';

function parseFilenameFromContentDisposition(cd: string | null): string | null {
  if (!cd) return null;

  // Try RFC 5987: filename*=UTF-8''....
  const m1 = cd.match(/filename\*\s*=\s*UTF-8''([^;]+)/i);
  if (m1?.[1]) {
    try {
      return decodeURIComponent(m1[1].trim());
    } catch {
      // ignore
    }
  }

  // Fallback: filename="..."
  const m2 = cd.match(/filename\s*=\s*"([^"]+)"/i) || cd.match(/filename\s*=\s*([^;]+)/i);
  if (m2?.[1]) return m2[1].trim();

  return null;
}

export default function PublicDownloadPackPage() {
  const params = useParams<{ token: string }>();
  const token = useMemo(() => {
    const t = params?.token;
    return Array.isArray(t) ? t[0] : t;
  }, [params]);

  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState<string>('Préparation du téléchargement…');

  useEffect(() => {
    if (!token) return;

    let cancelled = false;

    async function run() {
      try {
        setStatus('downloading');
        setMessage('Téléchargement du pack en cours…');

        const url = `/api/public/download-pack?token=${encodeURIComponent(token)}`;
        const res = await fetch(url, {
          method: 'GET',
          // important: on veut éviter tout cache navigateur/proxy
          cache: 'no-store',
        });

        if (cancelled) return;

        if (!res.ok) {
          // 410 = déjà utilisé (token consommé)
          if (res.status === 410) {
            setStatus('error');
            setMessage("Ce lien a déjà été utilisé (410). Si besoin, génère un nouveau lien de téléchargement.");
            return;
          }
          if (res.status === 401) {
            setStatus('error');
            setMessage("Lien invalide (401). Le token est incorrect ou expiré.");
            return;
          }
          if (res.status === 404) {
            setStatus('error');
            setMessage("Lien introuvable (404). Le token est incorrect ou expiré.");
            return;
          }

          // tenter de lire le JSON d’erreur (si dispo)
          let bodyText = '';
          try {
            bodyText = await res.text();
          } catch {}
          setStatus('error');
          setMessage(`Erreur (${res.status}). ${bodyText ? `Détail: ${bodyText}` : ''}`.trim());
          return;
        }

        const contentType = res.headers.get('content-type') || '';
        if (!contentType.toLowerCase().includes('pdf')) {
          // On supporte quand même blob, mais on avertit
          // (ex: erreur HTML renvoyée par proxy)
          const t = await res.text();
          setStatus('error');
          setMessage(`Réponse inattendue (Content-Type: ${contentType}). ${t?.slice(0, 300) ?? ''}`);
          return;
        }

        const blob = await res.blob();

        const cd = res.headers.get('content-disposition');
        const filename = parseFilenameFromContentDisposition(cd) || 'PACK_FINAL.pdf';

        // download via <a>
        const blobUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(blobUrl);

        setStatus('done');
        setMessage('Téléchargement lancé ✅ Tu peux fermer cette page.');
      } catch (e: any) {
        setStatus('error');
        setMessage(`Erreur lors du téléchargement: ${e?.message ?? String(e)}`);
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <main style={{ minHeight: '70vh', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
      <div style={{ maxWidth: 720, width: '100%', border: '1px solid #e5e7eb', borderRadius: 12, padding: 24 }}>
        <h1 style={{ margin: 0, fontSize: 22 }}>Téléchargement du pack</h1>

        <p style={{ marginTop: 12, marginBottom: 0, color: '#4b5563', lineHeight: 1.5 }}>
          {message}
        </p>

        {status === 'downloading' && (
          <div style={{ marginTop: 16, fontSize: 14, color: '#6b7280' }}>
            Si rien ne se télécharge, vérifie que ton navigateur n’a pas bloqué le téléchargement.
          </div>
        )}

        {status === 'error' && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 14, color: '#991b1b', background: '#fef2f2', padding: 12, borderRadius: 8 }}>
              {message}
            </div>
            <div style={{ marginTop: 12, fontSize: 13, color: '#6b7280' }}>
              Astuce : regénère un nouveau lien “final-pack” depuis l’admin, puis réessaie.
            </div>
          </div>
        )}
      </div>
    </main>
  );
}