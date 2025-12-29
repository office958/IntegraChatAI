'use client';

import { useState, useEffect } from 'react';
import styles from './Admin.module.css';

interface InstitutionData {
  name: string;
  type: 'primarie' | 'scoala' | 'ong' | 'companie' | 'dsp' | 'alta';
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  working_hours?: {
    monday?: string;
    tuesday?: string;
    wednesday?: string;
    thursday?: string;
    friday?: string;
    saturday?: string;
    sunday?: string;
  };
  services?: string[];
  fees?: Array<{ service: string; amount: string; description?: string }>;
  responsibilities?: string[];
  policies?: {
    tone?: 'formal' | 'simplu' | 'prietenos' | 'profesionist';
    detail_level?: 'scurt' | 'mediu' | 'detaliat';
    language?: 'ro' | 'en' | 'hu' | 'de';
  };
}

interface Tenant {
  id: string;
  tenant_id: string;
  name: string;
  model: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
  institution?: InstitutionData;
  rag_files_count: number;
  chat_title?: string;
  chat_color?: string;
}

export default function AdminPanel() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [showInstitutionForm, setShowInstitutionForm] = useState(false);
  const [showConfigForm, setShowConfigForm] = useState(false);
  const [ragFiles, setRagFiles] = useState<string[]>([]);
  const [institutionData, setInstitutionData] = useState<InstitutionData>({
    name: '',
    type: 'primarie',
  });
  const [configData, setConfigData] = useState({
    name: '',
    model: 'qwen2.5:7b',
    prompt: '',
    chat_title: '',
    chat_subtitle: '',
    chat_color: '#3b82f6',
    is_active: true,
  });
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTenantData, setNewTenantData] = useState({
    name: '',
    model: 'qwen2.5:7b',
    prompt: 'Ești asistentul Integra AI. Răspunde clar și politicos la întrebările utilizatorilor.',
    chat_title: '',
    chat_subtitle: 'Asistentul tău inteligent pentru găsirea informațiilor',
    chat_color: '#3b82f6',
  });

  useEffect(() => {
    loadTenants();
  }, []);

  const loadTenants = async () => {
    try {
      setLoading(true);
      // Folosește proxy Next.js (mai simplu și evită probleme CORS)
      const response = await fetch('/api/admin/tenants');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setTenants(data.tenants || []);
    } catch (error) {
      console.error('Error loading tenants:', error);
      // Afișează mesaj de eroare mai clar
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        alert('⚠️ Backend-ul FastAPI nu rulează!\n\nPornește serverul cu:\nstart-backend.bat\n\nsau\n\nuvicorn main:app --host 127.0.0.1 --port 8000 --reload');
      }
    } finally {
      setLoading(false);
    }
  };

  const loadRagFiles = async (chatId: string) => {
    try {
      const response = await fetch(`http://127.0.0.1:8000/chat/${chatId}/config`);
      if (response.ok) {
        const config = await response.json();
        setRagFiles(config.rag_files || []);
      }
    } catch (error) {
      console.error('Error loading RAG files:', error);
    }
  };

  const handleSelectTenant = (tenant: Tenant) => {
    setSelectedTenant(tenant);
    setInstitutionData(tenant.institution || { name: '', type: 'primarie' });
    setConfigData({
      name: tenant.name,
      model: tenant.model,
      prompt: '',
      chat_title: tenant.chat_title || '',
      chat_subtitle: '',
      chat_color: tenant.chat_color || '#3b82f6',
      is_active: tenant.is_active,
    });
    setShowInstitutionForm(false);
    setShowConfigForm(false);
    loadRagFiles(tenant.id);
  };

  const handleSaveInstitution = async () => {
    if (!selectedTenant) return;

    try {
      const response = await fetch(
        `/api/admin/tenant/${selectedTenant.id}/institution`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(institutionData),
        }
      );

      if (response.ok) {
        alert('Datele instituției au fost salvate!');
        loadTenants();
        if (selectedTenant) {
          loadRagFiles(selectedTenant.id);
        }
        setShowInstitutionForm(false);
      } else {
        alert('Eroare la salvarea datelor instituției');
      }
    } catch (error) {
      console.error('Error saving institution data:', error);
      alert('Eroare la salvarea datelor instituției');
    }
  };

  const handleSaveConfig = async () => {
    if (!selectedTenant) return;

    try {
      const response = await fetch(
        `/api/admin/tenant/${selectedTenant.id}/config`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(configData),
        }
      );

      if (response.ok) {
        alert('Configurația a fost salvată!');
        loadTenants();
        if (selectedTenant) {
          loadRagFiles(selectedTenant.id);
        }
        setShowConfigForm(false);
      } else {
        alert('Eroare la salvarea configurației');
      }
    } catch (error) {
      console.error('Error saving config:', error);
      alert('Eroare la salvarea configurației');
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedTenant || !event.target.files?.[0]) return;

    const file = event.target.files[0];
    const formData = new FormData();
    formData.append('file', file);

    try {
      // Folosește URL direct către backend pentru upload-uri (proxy-ul Next.js poate avea probleme cu FormData)
      const response = await fetch(
        `http://127.0.0.1:8000/admin/tenant/${selectedTenant.id}/rag/upload`,
        {
          method: 'POST',
          body: formData,
          // Nu seta Content-Type header - browser-ul o va seta automat cu boundary pentru FormData
        }
      );

      if (response.ok) {
        const result = await response.json();
        alert(result.message || 'Fișierul a fost încărcat cu succes!');
        loadTenants();
        loadRagFiles(selectedTenant.id);
        // Resetează input-ul pentru a permite încărcarea aceluiași fișier din nou
        event.target.value = '';
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Eroare necunoscută' }));
        alert(`❌ Eroare la încărcarea fișierului: ${errorData.error || response.statusText}`);
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        alert('Backend-ul nu este accesibil! Asigură-te că rulează pe port 8000.');
      } else {
        alert(`Eroare la încărcarea fișierului: ${error instanceof Error ? error.message : 'Eroare necunoscută'}`);
      }
    }
  };

  const handleDeleteFile = async (filename: string) => {
    if (!selectedTenant) return;

    if (!window.confirm(`Ești sigur că vrei să ștergi fișierul "${filename}"?`)) {
      return;
    }

    try {
      const response = await fetch(
        `http://127.0.0.1:8000/admin/tenant/${selectedTenant.id}/rag/${encodeURIComponent(filename)}`,
        {
          method: 'DELETE',
        }
      );

      if (response.ok) {
        alert('Fișierul a fost șters cu succes!');
        loadTenants();
        loadRagFiles(selectedTenant.id);
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Eroare necunoscută' }));
        alert(`Eroare la ștergerea fișierului: ${errorData.error || response.statusText}`);
      }
    } catch (error) {
      console.error('Error deleting file:', error);
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        alert('Backend-ul nu este accesibil! Asigură-te că rulează pe port 8000.');
      } else {
        alert(`Eroare la ștergerea fișierului: ${error instanceof Error ? error.message : 'Eroare necunoscută'}`);
      }
    }
  };

  const handleCreateTenant = async () => {
    if (!newTenantData.name.trim()) {
      alert('Te rog introdu numele clientului');
      return;
    }

    try {
      const response = await fetch('/api/admin/tenant/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newTenantData.name,
          model: newTenantData.model,
          prompt: newTenantData.prompt,
          chat_title: newTenantData.chat_title || newTenantData.name,
          chat_subtitle: newTenantData.chat_subtitle,
          chat_color: newTenantData.chat_color,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        alert('Client creat cu succes!');
        setShowCreateForm(false);
        setNewTenantData({
          name: '',
          model: 'qwen2.5:7b',
          prompt: 'Ești asistentul Integra AI. Răspunde clar și politicos la întrebările utilizatorilor.',
          chat_title: '',
          chat_subtitle: 'Asistentul tău inteligent pentru găsirea informațiilor',
          chat_color: '#3b82f6',
        });
        loadTenants();
        // Selectează automat noul tenant creat
        if (result.tenant) {
          const newTenant: Tenant = {
            id: result.tenant.id,
            tenant_id: result.tenant.tenant_id,
            name: result.tenant.name,
            model: result.tenant.model,
            is_active: result.tenant.is_active,
            institution: result.tenant.institution,
            rag_files_count: result.tenant.rag_files_count,
            chat_title: result.tenant.chat_title,
            chat_color: result.tenant.chat_color,
          };
          handleSelectTenant(newTenant);
        }
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Eroare necunoscută' }));
        alert(`Eroare la crearea clientului: ${errorData.error || response.statusText}`);
      }
    } catch (error) {
      console.error('Error creating tenant:', error);
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        alert('Backend-ul nu este accesibil! Asigură-te că rulează pe port 8000.');
      } else {
        alert(`Eroare la crearea clientului: ${error instanceof Error ? error.message : 'Eroare necunoscută'}`);
      }
    }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Se încarcă...</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Panou de Administrare - Integra AI</h1>
      
      <div className={styles.layout}>
        <div className={styles.sidebar}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ margin: 0 }}>Tenant-i</h2>
            <button
              className={styles.btnPrimary}
              onClick={() => setShowCreateForm(true)}
              style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', marginTop: 0 }}
            >
              + Client Nou
            </button>
          </div>

          <div className={styles.tenantList}>
            {tenants.length === 0 ? (
              <div className={styles.emptyState} style={{ padding: '2rem 1rem', textAlign: 'center' }}>
                <p style={{ margin: 0, color: '#6b7280' }}>Nu există clienti</p>
                <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.875rem', color: '#9ca3af' }}>
                  Creează primul client folosind butonul de mai sus
                </p>
              </div>
            ) : (
              tenants.map((tenant) => (
                <div
                  key={tenant.id}
                  className={`${styles.tenantItem} ${
                    selectedTenant?.id === tenant.id ? styles.selected : ''
                  }`}
                  onClick={() => handleSelectTenant(tenant)}
                >
                  <div className={styles.tenantName}>{tenant.name}</div>
                  <div className={styles.tenantMeta}>
                    {tenant.institution?.name || 'Fără instituție'} • {tenant.rag_files_count} fișiere RAG
                  </div>
                  <div className={`${styles.tenantStatus} ${!tenant.is_active ? styles.inactive : ''}`}>
                    {tenant.is_active ? 'Activ' : 'Inactiv'}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className={styles.content}>
          {selectedTenant ? (
            <>
              <div className={styles.tenantHeader}>
                <h2>{selectedTenant.name}</h2>
                <div className={styles.actions}>
                  <button
                    className={styles.btn}
                    onClick={() => setShowInstitutionForm(!showInstitutionForm)}
                  >
                    {showInstitutionForm ? 'Anulează' : 'Editează Date Instituție'}
                  </button>
                  <button
                    className={styles.btn}
                    onClick={() => setShowConfigForm(!showConfigForm)}
                  >
                    {showConfigForm ? 'Anulează' : 'Editează Configurație'}
                  </button>
                </div>
              </div>

              {showInstitutionForm && (
                <div className={styles.form}>
                  <h3>Date Instituție</h3>
                  <div className={styles.formGroup}>
                    <label>Nume instituție:</label>
                    <input
                      type="text"
                      value={institutionData.name}
                      onChange={(e) =>
                        setInstitutionData({ ...institutionData, name: e.target.value })
                      }
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Tip:</label>
                    <select
                      value={institutionData.type}
                      onChange={(e) =>
                        setInstitutionData({
                          ...institutionData,
                          type: e.target.value as InstitutionData['type'],
                        })
                      }
                    >
                      <option value="primarie">Primărie</option>
                      <option value="scoala">Școală</option>
                      <option value="ong">ONG</option>
                      <option value="companie">Companie</option>
                      <option value="dsp">DSP</option>
                      <option value="alta">Altă instituție</option>
                    </select>
                  </div>
                  <div className={styles.formGroup}>
                    <label>Adresă:</label>
                    <input
                      type="text"
                      value={institutionData.address || ''}
                      onChange={(e) =>
                        setInstitutionData({ ...institutionData, address: e.target.value })
                      }
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Telefon:</label>
                    <input
                      type="text"
                      value={institutionData.phone || ''}
                      onChange={(e) =>
                        setInstitutionData({ ...institutionData, phone: e.target.value })
                      }
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Email:</label>
                    <input
                      type="email"
                      value={institutionData.email || ''}
                      onChange={(e) =>
                        setInstitutionData({ ...institutionData, email: e.target.value })
                      }
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Website:</label>
                    <input
                      type="url"
                      value={institutionData.website || ''}
                      onChange={(e) =>
                        setInstitutionData({ ...institutionData, website: e.target.value })
                      }
                    />
                  </div>
                  <button className={styles.btnPrimary} onClick={handleSaveInstitution}>
                    Salvează Date Instituție
                  </button>
                </div>
              )}

              {showConfigForm && (
                <div className={styles.form}>
                  <h3>Configurație Chat</h3>
                  <div className={styles.formGroup}>
                    <label>Nume:</label>
                    <input
                      type="text"
                      value={configData.name}
                      onChange={(e) => setConfigData({ ...configData, name: e.target.value })}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Model LLM:</label>
                    <input
                      type="text"
                      value={configData.model}
                      onChange={(e) => setConfigData({ ...configData, model: e.target.value })}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Prompt de sistem:</label>
                    <textarea
                      rows={10}
                      value={configData.prompt}
                      onChange={(e) => setConfigData({ ...configData, prompt: e.target.value })}
                      placeholder="Instrucțiuni pentru LLM..."
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Titlu chat:</label>
                    <input
                      type="text"
                      value={configData.chat_title}
                      onChange={(e) =>
                        setConfigData({ ...configData, chat_title: e.target.value })
                      }
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Culoare:</label>
                    <input
                      type="color"
                      value={configData.chat_color}
                      onChange={(e) =>
                        setConfigData({ ...configData, chat_color: e.target.value })
                      }
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label>
                      <input
                        type="checkbox"
                        checked={configData.is_active}
                        onChange={(e) =>
                          setConfigData({ ...configData, is_active: e.target.checked })
                        }
                      />
                      Activ
                    </label>
                  </div>
                  <button className={styles.btnPrimary} onClick={handleSaveConfig}>
                    Salvează Configurație
                  </button>
                </div>
              )}

              <div className={styles.section}>
                <h3>Documente RAG</h3>
                <div className={styles.uploadSection}>
                  <input
                    id="rag-file-upload"
                    type="file"
                    accept=".pdf,.txt,.md,.doc,.docx"
                    onChange={handleFileUpload}
                    className={styles.fileInput}
                  />
                  <label htmlFor="rag-file-upload" className={styles.fileLabel}>
                    Încarcă document RAG (PDF, TXT, MD, DOC, DOCX)
                  </label>
                </div>
                {ragFiles.length > 0 ? (
                  <div className={styles.ragFilesList}>
                    {ragFiles.map((filename) => (
                      <div key={filename} className={styles.ragFileItem}>
                        <span className={styles.ragFileName}>{filename}</span>
                        <button
                          className={styles.btnDelete}
                          onClick={() => handleDeleteFile(filename)}
                        >
                          Șterge
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className={styles.info}>
                    Nu există fișiere RAG încărcate
                  </p>
                )}
              </div>

              <div className={styles.section}>
                <h3>Informații</h3>
                <div className={styles.infoGrid}>
                  <div>
                    <strong>ID Tenant:</strong> {selectedTenant.tenant_id}
                  </div>
                  <div>
                    <strong>Model:</strong> {selectedTenant.model}
                  </div>
                  <div>
                    <strong>Creat:</strong>{' '}
                    {selectedTenant.created_at
                      ? new Date(selectedTenant.created_at).toLocaleDateString('ro-RO')
                      : 'N/A'}
                  </div>
                  <div>
                    <strong>Actualizat:</strong>{' '}
                    {selectedTenant.updated_at
                      ? new Date(selectedTenant.updated_at).toLocaleDateString('ro-RO')
                      : 'N/A'}
                  </div>
                </div>
                <div className={styles.linkSection}>
                  <label>
                    <strong>Link Chat:</strong>
                  </label>
                  <div className={styles.linkContainer}>
                    <input
                      type="text"
                      readOnly
                      value={`${typeof window !== 'undefined' ? window.location.origin : ''}/chat/${selectedTenant.id}`}
                      className={styles.linkInput}
                      id={`chat-link-${selectedTenant.id}`}
                    />
                    <button
                      className={styles.btnCopy}
                      onClick={() => {
                        const linkInput = document.getElementById(`chat-link-${selectedTenant.id}`) as HTMLInputElement;
                        if (linkInput) {
                          linkInput.select();
                          linkInput.setSelectionRange(0, 99999); // Pentru mobile
                          navigator.clipboard.writeText(linkInput.value).then(() => {
                            alert('Link copiat în clipboard!');
                          }).catch(() => {
                            // Fallback pentru browsere vechi
                            document.execCommand('copy');
                            alert('Link copiat în clipboard!');
                          });
                        }
                      }}
                      title="Copiază link"
                    >
                      📋 Copiază
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : tenants.length === 0 ? (
            <div className={styles.emptyState}>
              <p>Creează primul client folosind butonul "Client Nou" din sidebar</p>
            </div>
          ) : (
            <div className={styles.emptyState}>
              <p>Selectează un tenant din listă pentru a începe administrarea</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal pentru Client Nou */}
      {showCreateForm && (
        <div className={styles.modalOverlay} onClick={() => setShowCreateForm(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>Client Nou</h2>
              <button
                className={styles.modalClose}
                onClick={() => setShowCreateForm(false)}
                aria-label="Închide"
              >
                ×
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.formGroup}>
                <label>Nume client:</label>
                <input
                  type="text"
                  value={newTenantData.name}
                  onChange={(e) => setNewTenantData({ ...newTenantData, name: e.target.value })}
                  placeholder="ex: Primăria Tășnad"
                />
              </div>
              <div className={styles.formGroup}>
                <label>Model LLM:</label>
                <input
                  type="text"
                  value={newTenantData.model}
                  onChange={(e) => setNewTenantData({ ...newTenantData, model: e.target.value })}
                  placeholder="ex: qwen2.5:7b"
                />
              </div>
              <div className={styles.formGroup}>
                <label>Prompt de sistem:</label>
                <textarea
                  rows={4}
                  value={newTenantData.prompt}
                  onChange={(e) => setNewTenantData({ ...newTenantData, prompt: e.target.value })}
                  placeholder="Instrucțiuni pentru LLM..."
                />
              </div>
              <div className={styles.formGroup}>
                <label>Titlu chat:</label>
                <input
                  type="text"
                  value={newTenantData.chat_title}
                  onChange={(e) => setNewTenantData({ ...newTenantData, chat_title: e.target.value })}
                  placeholder="Lasă gol pentru a folosi numele"
                />
              </div>
              <div className={styles.formGroup}>
                <label>Subtitlu chat:</label>
                <input
                  type="text"
                  value={newTenantData.chat_subtitle}
                  onChange={(e) => setNewTenantData({ ...newTenantData, chat_subtitle: e.target.value })}
                  placeholder="Asistentul tău inteligent pentru găsirea informațiilor"
                />
              </div>
              <div className={styles.formGroup}>
                <label>Culoare:</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="color"
                    value={newTenantData.chat_color}
                    onChange={(e) => setNewTenantData({ ...newTenantData, chat_color: e.target.value })}
                    style={{ width: '60px', height: '40px', cursor: 'pointer' }}
                  />
                  <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>{newTenantData.chat_color}</span>
                </div>
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button
                className={styles.btn}
                onClick={() => setShowCreateForm(false)}
              >
                Anulează
              </button>
              <button
                className={styles.btnPrimary}
                onClick={handleCreateTenant}
              >
                Creează Client
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

