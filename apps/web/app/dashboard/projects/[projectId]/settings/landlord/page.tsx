'use client';

import { useEffect, useMemo, useState } from 'react';

type Landlord = {
  name: string;
  address: string;
  email: string;
  phone: string;
  city?: string | null;
  postal_code?: string | null;
};

export default function LandlordSettingsPage({
  params,
}: {
  params: { projectId: string };
}) {
  const projectId = params.projectId;

  const empty: Landlord = useMemo(
    () => ({
      name: '',
      address: '',
      email: '',
      phone: '',
      city: '',
      postal_code: '',
    }),
    [],
  );

  const [data, setData] = useState<Landlord>(empty);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function load() {
    setStatus(null);
    const r = await fetch(`/api/projects/${projectId}/landlord`, { cache: 'no-store' });
    if (r.ok) {
      const json = await r.json();
      if (json) setData({ ...empty, ...json });
    }
  }

  async function save() {
    setLoading(true);
    setStatus(null);
    try {
      const r = await fetch(`/api/projects/${projectId}/landlord`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify(data),
      });

      const payload = await r.json().catch(() => ({}));

      if (!r.ok) {
        setStatus(payload?.message || 'Erreur lors de l’enregistrement');
        return;
      }
      setStatus('✅ Bailleur enregistré');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: 20 }}>
      <h1 style={{ fontSize: 28, marginBottom: 6 }}>Bailleur</h1>
      <div style={{ color: '#555', marginBottom: 16 }}>
        Paramètres du projet — nécessaires pour générer un contrat “béton”.
      </div>

      <div style={{ border: '1px solid #eee', borderRadius: 12, padding: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Nom" value={data.name} onChange={(v) => setData({ ...data, name: v })} />
          <Field label="Téléphone" value={data.phone} onChange={(v) => setData({ ...data, phone: v })} />

          <Field
            label="Adresse complète"
            value={data.address}
            onChange={(v) => setData({ ...data, address: v })}
            full
          />

          <Field label="Email" value={data.email} onChange={(v) => setData({ ...data, email: v })} full />

          <Field label="Ville (optionnel)" value={data.city ?? ''} onChange={(v) => setData({ ...data, city: v })} />
          <Field
            label="Code postal (optionnel)"
            value={data.postal_code ?? ''}
            onChange={(v) => setData({ ...data, postal_code: v })}
          />
        </div>

        <div style={{ marginTop: 14, display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            onClick={save}
            disabled={loading}
            style={{
              padding: '10px 14px',
              borderRadius: 10,
              border: '1px solid #111',
              background: '#111',
              color: 'white',
              cursor: 'pointer',
            }}
          >
            {loading ? 'Enregistrement…' : 'Enregistrer'}
          </button>

          <button
            onClick={load}
            disabled={loading}
            style={{
              padding: '10px 14px',
              borderRadius: 10,
              border: '1px solid #ddd',
              background: 'white',
              cursor: 'pointer',
            }}
          >
            Recharger
          </button>

          {status && <div style={{ marginLeft: 6 }}>{status}</div>}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  full,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  full?: boolean;
}) {
  return (
    <label style={{ display: 'block', gridColumn: full ? '1 / -1' : undefined }}>
      <div style={{ fontSize: 13, color: '#333', marginBottom: 6 }}>{label}</div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ width: '100%', padding: 10, border: '1px solid #ddd', borderRadius: 10 }}
      />
    </label>
  );
}