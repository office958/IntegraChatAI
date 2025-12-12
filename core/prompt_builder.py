def build_pdf_field_extraction_prompt(pdf_text: str) -> str:
    return f"""
Ești un asistent care analizează modele oficiale de cereri în format text.

Scopul tău este să identifici absolut toate câmpurile care trebuie completate de cetățean.
Extrage câmpurile sub formă de JSON strict.

Format răspuns:
{{
  "document_name": "denumirea cererii",
  "fields": [
    {{
      "id": "cheie_tehnica_unica",
      "label": "eticheta citită din PDF",
      "type": "text|cnp|date|address|email|phone|other",
      "required": true
    }}
  ]
}}

TEXT FORMULAR:
---------------------
{pdf_text}
"""
def build_pdf_fill_prompt(schema: dict, user_context: str) -> str:
    return f"""
Ești un asistent care completează o cerere oficială pe baza:

1) Schema de câmpuri (JSON)
2) Informațiile oferite de cetățean

Scop:
- Mapezi automat toate informațiile găsite în context
- Identifici ce câmpuri NU pot fi completate fără clarificări
- Întorci STRICT un JSON

Format răspuns:
{{
   "filled": {{
       "id_camp": "valoare",
       ...
   }},
   "missing": [
     {{
       "id": "id_camp",
       "label": "eticheta"
     }}
   ]
}}

SCHEMA:
{schema}

INFORMAȚII UTILIZATOR:
{user_context}
"""
