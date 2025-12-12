# Sistem de Generare PDF-uri Completate

Sistemul permite generarea automată de PDF-uri completate pe baza datelor colectate de la cetățean, cu suport pentru:
- **PDF-uri cu AcroForm** (câmpuri interactive)
- **PDF-uri simple** (completare bazată pe coordonate)

## Instalare Dependențe

```bash
pip install pypdf pymupdf reportlab
```

## Structura Sistemului

### Directoare

- `pdf_templates/` - PDF-uri template pentru formulare
- `pdf_mappings/` - Fișiere JSON cu mapping-uri pentru fiecare formular

### Tipuri de Mapping

#### 1. Mapping pentru AcroForm

Pentru PDF-uri care au câmpuri interactive (AcroForm):

```json
{
  "form_name": "Cerere Certificat Naștere Copil",
  "pdf_template": "CERERE-CERTIFICAT-NASTERE-COPIL.pdf",
  "type": "acroform",
  "field_mapping": {
    "nume": "Nume",
    "prenume": "Prenume",
    "data_nasterii": "DataNasterii",
    "loc_nasterii": "LocNasterii",
    "adresa": "Adresa",
    "telefon": "Telefon",
    "email": "Email"
  }
}
```

#### 2. Mapping pentru PDF-uri Simple (Coordonate)

Pentru PDF-uri fără câmpuri interactive, folosind coordonate:

```json
{
  "form_name": "Cerere Simplă",
  "pdf_template": "cerere_simpla.pdf",
  "type": "coordinates",
  "fields": [
    {
      "json_key": "nume",
      "x": 100,
      "y": 700,
      "page": 1,
      "font": "helv",
      "font_size": 12,
      "color": [0, 0, 0]
    },
    {
      "json_key": "prenume",
      "x": 100,
      "y": 680,
      "page": 1,
      "font": "helv",
      "font_size": 12,
      "color": [0, 0, 0]
    }
  ]
}
```

**Notă despre coordonate:**
- Coordonatele sunt în puncte (points), unde 1 inch = 72 points
- Originea (0,0) este în colțul stânga-jos al paginii
- `x` crește spre dreapta, `y` crește în sus

## API Endpoints

### 1. Generare PDF Completat

**POST** `/api/pdf-form/generate`

**Body:**
```json
{
  "form_name": "Cerere Certificat Naștere Copil",
  "pdf_template": "CERERE-CERTIFICAT-NASTERE-COPIL.pdf",
  "data": {
    "nume": "Popescu",
    "prenume": "Ion",
    "data_nasterii": "1990-01-15",
    "loc_nasterii": "București",
    "adresa": "Str. Exemplu nr. 10",
    "telefon": "0712345678",
    "email": "ion@example.com"
  },
  "mapping_file": "example_acroform.json",
  "chat_id": "1"
}
```

**Răspuns:** PDF completat (binary)

### 2. Încărcare Template PDF

**POST** `/api/pdf-form/upload-template`

**Form Data:**
- `file`: Fișier PDF

### 3. Încărcare Mapping JSON

**POST** `/api/pdf-form/upload-mapping`

**Form Data:**
- `file`: Fișier JSON cu mapping

### 4. Listare Mapping-uri

**GET** `/api/pdf-form/list-mappings`

**Răspuns:**
```json
{
  "success": true,
  "mappings": [
    {
      "filename": "example_acroform.json",
      "form_name": "Cerere Certificat Naștere Copil",
      "type": "acroform",
      "pdf_template": "CERERE-CERTIFICAT-NASTERE-COPIL.pdf"
    }
  ]
}
```

### 5. Listare Template-uri

**GET** `/api/pdf-form/list-templates`

## Utilizare

### Pasul 1: Pregătire Template PDF

1. Pregătește PDF-ul template (cu sau fără AcroForm)
2. Încarcă-l folosind `/api/pdf-form/upload-template` sau pune-l în `pdf_templates/`

### Pasul 2: Creare Mapping JSON

1. Pentru AcroForm: identifică numele câmpurilor din PDF
2. Pentru PDF simplu: măsoară coordonatele pentru fiecare câmp
3. Creează fișierul JSON de mapping
4. Încarcă-l folosind `/api/pdf-form/upload-mapping` sau pune-l în `pdf_mappings/`

### Pasul 3: Generare PDF

Trimite request la `/api/pdf-form/generate` cu:
- `form_name`: Numele formularului
- `pdf_template`: Numele fișierului PDF template
- `data`: JSON cu datele de completat
- `mapping_file`: (opțional) Numele fișierului de mapping
- `chat_id`: (opțional) ID chat pentru a căuta PDF-ul în RAG

## Detectare Automată

Sistemul detectează automat:
- **Tipul PDF**: AcroForm sau simplu
- **Mapping-ul**: Caută automat mapping-ul bazat pe numele formularului sau PDF-ului

## Exemple

### Exemplu 1: AcroForm

```python
import requests

response = requests.post('http://localhost:8000/api/pdf-form/generate', json={
    "form_name": "Cerere Certificat Naștere Copil",
    "pdf_template": "CERERE-CERTIFICAT-NASTERE-COPIL.pdf",
    "data": {
        "nume": "Popescu",
        "prenume": "Ion",
        "data_nasterii": "1990-01-15"
    },
    "chat_id": "1"
})

with open('cerere_completata.pdf', 'wb') as f:
    f.write(response.content)
```

### Exemplu 2: PDF Simplu cu Coordonate

```python
response = requests.post('http://localhost:8000/api/pdf-form/generate', json={
    "form_name": "Cerere Simplă",
    "pdf_template": "cerere_simpla.pdf",
    "data": {
        "nume": "Popescu",
        "prenume": "Ion"
    },
    "mapping_file": "example_coordinates.json"
})

with open('cerere_completata.pdf', 'wb') as f:
    f.write(response.content)
```

## Notițe Tehnice

- **pypdf**: Folosit pentru PDF-uri cu AcroForm
- **PyMuPDF**: Folosit pentru completare bazată pe coordonate (mai precis)
- **reportlab**: Fallback pentru completare bazată pe coordonate

## Găsirea Coordonatelor

Pentru PDF-uri simple, poți găsi coordonatele folosind:
1. Adobe Acrobat (View > Tools > Measure)
2. PyMuPDF interactiv
3. Trial and error cu valori aproximative

## Suport

Pentru probleme sau întrebări, consultă documentația sau contactează echipa de dezvoltare.

