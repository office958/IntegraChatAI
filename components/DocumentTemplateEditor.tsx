'use client';

import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import styles from './DocumentTemplateEditor.module.css';

// Importă Quill editor (lazy load pentru SSR)
const ReactQuill = dynamic(() => import('react-quill'), { ssr: false });
import 'react-quill/dist/quill.snow.css';

interface Variable {
  key: string;
  label: string;
  placeholder: string;
}

interface DocumentTemplateEditorProps {
  chatId: string;
  filename: string;
  onClose: () => void;
  onSave: (template: any) => void;
}

// Variabile predefinite
const PREDEFINED_VARIABLES: Variable[] = [
  { key: 'fullName', label: 'Nume complet', placeholder: '{{ $fullName }}' },
  { key: 'series', label: 'Seria', placeholder: '{{ $series }}' },
  { key: 'number', label: 'Numărul', placeholder: '{{ $number }}' },
  { key: 'today', label: 'Data de astazi', placeholder: '{{ $today }}' },
  { key: 'address', label: 'Adresă', placeholder: '{{ $address }}' },
  { key: 'cnp', label: 'CNP', placeholder: '{{ $cnp }}' },
  { key: 'phone', label: 'Telefon', placeholder: '{{ $phone }}' },
  { key: 'email', label: 'Email', placeholder: '{{ $email }}' },
  { key: 'birthDate', label: 'Data nașterii', placeholder: '{{ $birthDate }}' },
  { key: 'birthPlace', label: 'Locul nașterii', placeholder: '{{ $birthPlace }}' },
];

export default function DocumentTemplateEditor({
  chatId,
  filename,
  onClose,
  onSave,
}: DocumentTemplateEditorProps) {
  const [templateName, setTemplateName] = useState('');
  const [content, setContent] = useState('');
  const [variables, setVariables] = useState<Variable[]>([]);
  const [customVariables, setCustomVariables] = useState<Variable[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const quillRef = useRef<any>(null);

  useEffect(() => {
    loadTemplate();
  }, [chatId, filename]);

  const loadTemplate = async () => {
    try {
      const response = await fetch(
        `http://127.0.0.1:8000/admin/tenant/${chatId}/template/${encodeURIComponent(filename)}`
      );
      if (response.ok) {
        const data = await response.json();
        setTemplateName(data.template_name || filename);
        setContent(data.template_html || '');
        setVariables(data.variables || []);
      } else {
        // Dacă nu există template, încarcă documentul original
        await loadOriginalDocument();
      }
    } catch (error) {
      console.error('Error loading template:', error);
      await loadOriginalDocument();
    } finally {
      setLoading(false);
    }
  };

  const loadOriginalDocument = async () => {
    try {
      const response = await fetch(
        `http://127.0.0.1:8000/admin/tenant/${chatId}/rag/${encodeURIComponent(filename)}/content`
      );
      if (response.ok) {
        const data = await response.json();
        setContent(data.content || '');
      }
    } catch (error) {
      console.error('Error loading original document:', error);
    }
  };

  const insertVariable = (variable: Variable) => {
    if (quillRef.current) {
      const quill = quillRef.current.getEditor();
      const range = quill.getSelection(true);
      if (range) {
        quill.insertText(range.index, variable.placeholder, 'user');
        quill.setSelection(range.index + variable.placeholder.length);
      } else {
        quill.insertText(quill.getLength(), variable.placeholder, 'user');
      }
    }
  };

  const addCustomVariable = () => {
    const key = prompt('Introduceți cheia variabilei (ex: numeComplet):');
    if (!key || !key.match(/^[a-zA-Z][a-zA-Z0-9_]*$/)) {
      alert('Cheia trebuie să înceapă cu literă și să conțină doar litere, cifre și underscore');
      return;
    }
    const label = prompt('Introduceți eticheta (ex: Nume complet):') || key;
    const newVar: Variable = {
      key,
      label,
      placeholder: `{{ $${key} }}`,
    };
    setCustomVariables([...customVariables, newVar]);
  };

  const extractVariables = (text: string): Variable[] => {
    const regex = /\{\{\s*\$(\w+)\s*\}\}/g;
    const found: Set<string> = new Set();
    let match;
    while ((match = regex.exec(text)) !== null) {
      found.add(match[1]);
    }
    return Array.from(found).map((key) => {
      const predefined = PREDEFINED_VARIABLES.find((v) => v.key === key);
      if (predefined) return predefined;
      const custom = customVariables.find((v) => v.key === key);
      if (custom) return custom;
      return {
        key,
        label: key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1'),
        placeholder: `{{ $${key} }}`,
      };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const extractedVars = extractVariables(content);
      const allVariablesMap = new Map<string, Variable>();
      
      // Adaugă toate variabilele (prioritate: predefined > custom > extracted)
      [...PREDEFINED_VARIABLES, ...customVariables, ...extractedVars].forEach(v => {
        allVariablesMap.set(v.key, v);
      });
      
      const allVariables = Array.from(allVariablesMap.values());

      const templateData = {
        template_name: templateName || filename,
        template_html: content,
        variables: allVariables,
      };

      const response = await fetch(
        `http://127.0.0.1:8000/admin/tenant/${chatId}/template/${encodeURIComponent(filename)}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(templateData),
        }
      );

      if (response.ok) {
        alert('Template salvat cu succes!');
        onSave(templateData);
        onClose();
      } else {
        const error = await response.json();
        alert(`Eroare: ${error.error || 'Eroare necunoscută'}`);
      }
    } catch (error) {
      console.error('Error saving template:', error);
      alert('Eroare la salvarea template-ului');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.modalOverlay}>
        <div className={styles.modalContent}>
          <div>Se încarcă...</div>
        </div>
      </div>
    );
  }

  const allVariables = [...PREDEFINED_VARIABLES, ...customVariables];
  const detectedVariables = extractVariables(content);

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2>Editor Template Document</h2>
          <button className={styles.closeBtn} onClick={onClose}>
            ×
          </button>
        </div>

        <div className={styles.modalBody}>
          <div className={styles.formGroup}>
            <label>Nume template:</label>
            <input
              type="text"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder={filename}
            />
          </div>

          <div className={styles.editorLayout}>
            <div className={styles.editorSection}>
              <label>Conținut document:</label>
              <ReactQuill
                ref={quillRef}
                theme="snow"
                value={content}
                onChange={setContent}
                modules={{
                  toolbar: [
                    [{ header: [1, 2, 3, false] }],
                    ['bold', 'italic', 'underline', 'strike'],
                    [{ list: 'ordered' }, { list: 'bullet' }],
                    [{ align: [] }],
                    ['link'],
                    ['clean'],
                  ],
                }}
                style={{ minHeight: '400px' }}
              />
            </div>

            <div className={styles.variablesSection}>
              <div className={styles.variablesHeader}>
                <h3>Variabile</h3>
                <button
                  className={styles.btnAddVariable}
                  onClick={addCustomVariable}
                >
                  + Variabilă nouă
                </button>
              </div>

              <div className={styles.variablesList}>
                {allVariables.map((variable) => {
                  const isUsed = detectedVariables.some(v => v.key === variable.key);
                  return (
                    <div key={variable.key} className={styles.variableItem}>
                      <button
                        className={`${styles.variableBtn} ${isUsed ? styles.used : ''}`}
                        onClick={() => insertVariable(variable)}
                        title={isUsed ? 'Folosit în document' : 'Click pentru a insera'}
                      >
                        {variable.label}
                      </button>
                      <div className={styles.variablePlaceholder}>
                        {variable.placeholder}
                      </div>
                      <button
                        className={styles.copyBtn}
                        onClick={() => {
                          navigator.clipboard.writeText(variable.placeholder);
                          alert('Copiat!');
                        }}
                        title="Copiază placeholder"
                      >
                        📋
                      </button>
                    </div>
                  );
                })}
              </div>
              
              {detectedVariables.length > 0 && (
                <div className={styles.detectedVars}>
                  <h4>Variabile detectate în document:</h4>
                  <div className={styles.detectedList}>
                    {detectedVariables.map(v => (
                      <span key={v.key} className={styles.detectedTag}>{v.placeholder}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className={styles.modalFooter}>
          <button className={styles.btnCancel} onClick={onClose}>
            Anulează
          </button>
          <button
            className={styles.btnSave}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Salvează...' : 'Salvează Template'}
          </button>
        </div>
      </div>
    </div>
  );
}



