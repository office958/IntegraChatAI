# 📄 Instalare Suport PDF

Pentru a folosi funcționalitatea de extragere text din PDF, trebuie să instalezi biblioteca `PyPDF2`.

## Instalare

Rulează în terminal:

```bash
pip install PyPDF2
```

## Verificare

După instalare, când pornești serverul FastAPI, ar trebui să vezi în consolă:
- ✅ Dacă PyPDF2 este instalat: nu vei vedea niciun mesaj de eroare
- ⚠️ Dacă PyPDF2 NU este instalat: vei vedea mesajul "⚠️ PyPDF2 nu este instalat. Rulează: pip install PyPDF2"

## Utilizare

1. Deschide chat-ul în orice pagină cu formular
2. Click pe butonul **"📄 PDF"** din zona de input
3. Selectează un fișier PDF
4. Așteaptă extragerea textului (vei vedea un mesaj de confirmare)
5. Spune-i AI-ului: "Completează formularul folosind informațiile din PDF"

AI-ul va extrage automat datele din PDF și va completa câmpurile formularului!

## Limitări

- Dimensiune maximă PDF: **10MB**
- Format: doar PDF-uri cu text (nu funcționează cu PDF-uri scanate/imagini)
- Text extras: primele **5000 caractere** sunt folosite pentru prompt (pentru performanță)

## Rezolvare probleme

### Eroare: "PyPDF2 nu este instalat"
```bash
pip install PyPDF2
```

### Eroare: "Nu s-a putut extrage text din PDF"
- PDF-ul poate fi scanat (imagine, nu text)
- PDF-ul poate fi protejat cu parolă
- Încearcă cu un alt PDF care conține text selectabil

### Eroare: "Fișierul este prea mare"
- Reduce dimensiunea PDF-ului (max 10MB)
- Sau extrage manual textul și copiază-l în chat

