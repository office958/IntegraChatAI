from rag_manager import get_tenant_rag_store
from prompt_builder import build_dynamic_system_prompt

# === Construiește prompt optimizat pentru JSON (o singură dată) ===
def build_json_instructions():
    """Construiește instrucțiunile JSON o singură dată (cache)"""
    return """JSON RAPID: Răspunde DOAR cu JSON valid, fără text. Chei: normalizează numele (lowercase, fără diacritice, spații→_). SELECT: folosește doar valori din opțiuni. OBLIGATORIU (*): completează întotdeauna. Format: {"cheie":"valoare"} - doar JSON pur."""

# Cache pentru instrucțiuni JSON
_JSON_INSTRUCTIONS = build_json_instructions()

# === Îmbunătățire prompt pentru detecție automată (optimizat) ===
def enhance_prompt_for_autofill(base_prompt, page_context=None, pdf_text=None, rag_content=None, institution_data=None, rag_search_query=None, tenant_id=None):
    """
    Îmbunătățește prompt-ul bazat pe contextul paginii, textul din PDF, conținutul RAG și datele instituției
    OPTIMIZAT: Folosește cache și format compact
    """
    # Dacă avem tenant_id și query pentru RAG, folosește vector store
    rag_context_text = None
    if tenant_id and rag_search_query:
        try:
            rag_store = get_tenant_rag_store(tenant_id)
            rag_results = rag_store.search(rag_search_query, top_k=5)
            if rag_results:
                rag_context_parts = []
                for result in rag_results:
                    rag_context_parts.append(f"\n--- {result['filename']} ---\n{result['content'][:2000]}")  # Limitează la 2000 caractere per chunk
                rag_context_text = "\n".join(rag_context_parts)
                print(f"✅ RAG search pentru tenant {tenant_id}: {len(rag_results)} rezultate relevante")
        except Exception as e:
            print(f"⚠️ Eroare la căutarea RAG pentru tenant {tenant_id}: {e}")
    
    # Dacă nu am folosit vector store, folosește rag_content direct
    if not rag_context_text and rag_content:
        rag_text = ""
        total_chars = 0
        max_total = 15000  # Mărim limita totală pentru RAG
        
        for item in rag_content:
            filename = item.get("filename", "document")
            content = item.get("content", "").strip()
            
            # Skip dacă conținutul este gol sau doar whitespace
            if not content or content == "\n":
                continue
            
            # Calculează cât mai putem adăuga
            remaining = max_total - total_chars
            if remaining <= 0:
                break
            
            # Limitează conținutul per fișier dar păstrăm mai mult (5000 per fișier)
            content_limited = content[:5000] if len(content) > 5000 else content
            
            # Verifică dacă mai avem spațiu
            if total_chars + len(content_limited) + len(filename) + 50 > max_total:
                # Adaugă doar cât mai încape
                available = max_total - total_chars - len(filename) - 50
                if available > 100:  # Doar dacă mai avem cel puțin 100 caractere
                    content_limited = content[:available]
                else:
                    break
            
            rag_text += f"\n\n--- {filename} ---\n{content_limited}"
            total_chars += len(content_limited) + len(filename) + 50
        
        if rag_text:
            rag_context_text = rag_text
            print(f"✅ RAG content adăugat în prompt: {len(rag_text)} caractere din {len(rag_content)} fișiere")
        else:
            print(f"⚠️ RAG content este gol sau invalid. Fișiere procesate: {len(rag_content) if rag_content else 0}")
    
    # Folosește prompt builder pentru generarea dinamică
    enhanced = build_dynamic_system_prompt(
        base_prompt=base_prompt,
        institution_data=institution_data,
        rag_context=rag_context_text
    )
    
    # Adaugă textul din PDF/imagini dacă există (format compact pentru viteză)
    if pdf_text:
        # Limitează la primele 2000 caractere pentru prompt (optimizare viteză mai agresivă)
        pdf_text_limited = pdf_text[:2000] if len(pdf_text) > 2000 else pdf_text
        enhanced += f"\n\n=== DOCUMENT ÎNCĂRCAT DE UTILIZATOR ===\n{pdf_text_limited}\n\nExtrage: nume, adrese, date, numere. Completează câmpurile pe baza acestui document."
        
        # Adaugă instrucțiuni pentru procesare cereri complexe
        enhanced += "\n\n=== PROCESARE CERERI COMPLEXE ==="
        enhanced += "\nCând utilizatorul cere să extragi date din imagini/PDF-uri, completezi un formular PDF și generezi PDF nou:"
        enhanced += "\n1. ANALIZĂ: Identifică toate documentele încărcate (PDF-uri, imagini) și PDF-urile din RAG"
        enhanced += "\n2. EXTRAGERE: Extrage toate datele relevante din fiecare document (nume, prenume, CNP, adrese, date, etc.)"
        enhanced += "\n3. MAPARE: Identifică câmpurile din formularul PDF care trebuie completate (ex: cerere certificat naștere copil)"
        enhanced += "\n4. IDENTIFICARE PDF TEMPLATE: Dacă utilizatorul menționează un PDF specific sau dacă există un PDF în RAG care corespunde cererii, menționează numele acestuia în răspuns (ex: 'CERERE-CERTIFICAT-NASTERE-COPIL.pdf')"
        enhanced += "\n5. COMPLETARE: Mapează datele extrase la câmpurile formularului"
        enhanced += "\n6. STRUCTURARE: Returnează datele în format JSON structurat, cu chei care corespund câmpurilor formularului"
        enhanced += "\n7. GENERARE: Când utilizatorul cere 'generează PDF' sau 'generează aici pdf-ul', returnează JSON cu datele și sugerează folosirea butonului de generare PDF"
        enhanced += "\n\nIMPORTANT: Dacă cunoști numele PDF-ului template din RAG sau din conversație, menționează-l explicit în răspuns (ex: 'Voi completa formularul CERERE-CERTIFICAT-NASTERE-COPIL.pdf cu datele extrase')"
        enhanced += "\n\nFormat JSON recomandat:"
        enhanced += '\n{"nume": "valoare", "prenume": "valoare", "data_nasterii": "valoare", "cnp": "valoare", "adresa": "valoare", ...}'
        enhanced += "\n\nIMPORTANT: Dacă utilizatorul cere explicit generare PDF sau 'generează aici pdf-ul',"
        enhanced += "\nOBLIGATORIU: Începe răspunsul cu un bloc JSON valid în format markdown:"
        enhanced += "\n```json"
        enhanced += "\n{"
        enhanced += '\n  "nume": "valoare",'
        enhanced += '\n  "prenume": "valoare",'
        enhanced += '\n  ...'
        enhanced += "\n}"
        enhanced += "\n```"
        enhanced += "\nApoi adaugă text explicativ după blocul JSON. JSON-ul trebuie să fie primul lucru din răspuns!"
    
    if page_context and page_context.get("has_form"):
        # Folosește informațiile detaliate despre câmpuri dacă sunt disponibile
        fields_detailed = page_context.get("fields_detailed", [])
        
        if fields_detailed:
            # Construiește descriere foarte compactă a câmpurilor (optimizat maxim pentru viteză)
            fields_list = []
            for field in fields_detailed[:30]:  # Limitează la primele 30 câmpuri
                field_info = field['name']
                if field.get('options'):
                    # Limitează la primele 2 opțiuni pentru viteză maximă
                    opts = ', '.join(field['options'][:2])
                    if len(field.get('options', [])) > 2:
                        opts += "..."
                    field_info += f" [{opts}]"
                if field.get('required'):
                    field_info += " *"
                fields_list.append(field_info)
            
            # Limitează lungimea totală a string-ului pentru prompt
            fields_str = ", ".join(fields_list)
            if len(fields_str) > 1500:  # Limitează la 1500 caractere
                fields_str = fields_str[:1500] + "..."
            
            # Folosește instrucțiunile din cache
            enhanced += f"\n\n=== CÂMPURI FORMULAR ===\n{fields_str}\n\n{_JSON_INSTRUCTIONS}"
        else:
            # Fallback la versiunea simplă dacă nu avem detalii (optimizat)
            fields_info = ", ".join(page_context.get("form_fields", [])[:30])  # Limitează la 30
            if len(fields_info) > 1000:
                fields_info = fields_info[:1000] + "..."
            enhanced += f"\n\n=== CÂMPURI FORMULAR ===\n{fields_info}\n\n{_JSON_INSTRUCTIONS}"
    
    return enhanced

