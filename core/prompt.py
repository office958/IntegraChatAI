from rag_manager import get_tenant_rag_store
from prompt_builder import build_dynamic_system_prompt

# === Construiește prompt optimizat pentru JSON (o singură dată) ===
def build_json_instructions():
    """Construiește instrucțiunile JSON o singură dată (cache)"""
    return """JSON RAPID: Răspunde DOAR cu JSON valid, fără text. Chei: normalizează numele (lowercase, fără diacritice, spații→_). SELECT: folosește doar valori din opțiuni. OBLIGATORIU (*): completează întotdeauna. Format: {"cheie":"valoare"} - doar JSON pur."""

# Cache pentru instrucțiuni JSON
_JSON_INSTRUCTIONS = build_json_instructions()

# === Îmbunătățire prompt pentru detecție automată (optimizat) ===
def enhance_prompt_for_autofill(base_prompt, page_context=None, pdf_text=None, rag_content=None, institution_data=None, rag_search_query=None, tenant_id=None, document_templates=None):
    """
    Îmbunătățește prompt-ul bazat pe contextul paginii, textul din PDF, conținutul RAG, datele instituției și template-urile de documente.
    OPTIMIZAT: Folosește cache și format compact
    """
    # Dacă avem tenant_id și query pentru RAG, folosește vector store
    # OPTIMIZARE: Skip RAG search pentru query-uri foarte scurte sau generice (viteză maximă)
    rag_context_text = None
    if tenant_id and rag_search_query:
        # OPTIMIZARE: Skip RAG pentru query-uri prea scurte sau generice (mai agresiv pentru viteză)
        query_clean = rag_search_query.strip().lower()
        skip_rag = (
            len(query_clean) < 8 or  # Mărit la 8 caractere pentru skip mai agresiv
            query_clean in ['buna', 'bună', 'salut', 'hello', 'hi', 'ajutor', 'help', 'ma poti ajuta', 'mă poți ajuta', 'ok', 'da', 'nu', 'mulțumesc', 'multumesc', 'mersi', 'extrage', 'text', 'imagine', 'pdf', 'extrage acest', 'extrage text', 'extrage din', 'extrage date'] or
            'extrage' in query_clean or 'text' in query_clean or 'imagine' in query_clean
        )
        
        if not skip_rag:
            try:
                import time
                rag_start = time.time()
                rag_store = get_tenant_rag_store(tenant_id)
                # Redus top_k la 1 pentru viteză maximă (era 2)
                rag_results = rag_store.search(rag_search_query, top_k=1)
                rag_time = time.time() - rag_start
                if rag_time > 0.2:
                    print(f"⚠️ RAG search a durat {rag_time:.2f}s (ar trebui < 0.2s)")
                
                if rag_results:
                    rag_context_parts = []
                    for result in rag_results:
                        # OPTIMIZARE CRITICĂ: Redus la 100 caractere per chunk pentru viteză maximă
                        rag_context_parts.append(f"\n--- {result['filename']} ---\n{result['content'][:100]}")
                    rag_context_text = "\n".join(rag_context_parts)
                    # OPTIMIZARE CRITICĂ: Limitează contextul RAG total la 200 caractere
                    if len(rag_context_text) > 200:
                        rag_context_text = rag_context_text[:200] + "\n[... trunchiat pentru viteză ...]"
                    print(f"✅ RAG search pentru tenant {tenant_id}: {len(rag_results)} rezultate ({rag_time:.2f}s)")
            except Exception as e:
                print(f"⚠️ Eroare la căutarea RAG pentru tenant {tenant_id}: {e}")
        else:
            print(f"⏭️ RAG search skipat pentru query scurt/generic: '{rag_search_query[:20]}'")
    
    # Dacă nu am folosit vector store, folosește rag_content direct
    if not rag_context_text and rag_content:
        rag_text = ""
        total_chars = 0
        max_total = 3000  # Redus și mai mult pentru viteză maximă (era 5000)
        
        # Limitează la primele 3 fișiere pentru viteză maximă
        for item in rag_content[:3]:
            filename = item.get("filename", "document")
            content = item.get("content", "").strip()
            
            # Skip dacă conținutul este gol sau doar whitespace
            if not content or content == "\n":
                continue
            
            # Calculează cât mai putem adăuga
            remaining = max_total - total_chars
            if remaining <= 0:
                break
            
            # Limitează conținutul per fișier (reduc la 800 pentru viteză maximă, era 1500)
            content_limited = content[:800] if len(content) > 800 else content
            
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
            print(f"✅ RAG content adăugat în prompt: {len(rag_text)} caractere din {min(3, len(rag_content))} fișiere")
        else:
            print(f"⚠️ RAG content este gol sau invalid. Fișiere procesate: {len(rag_content) if rag_content else 0}")
    
    # OPTIMIZARE CRITICĂ: Limitează base_prompt la 200 caractere pentru viteză maximă
    base_prompt_limited = base_prompt[:200] if len(base_prompt) > 200 else base_prompt
    
    # Folosește prompt builder pentru generarea dinamică
    enhanced = build_dynamic_system_prompt(
        base_prompt=base_prompt_limited,
        institution_data=institution_data,
        rag_context=rag_context_text
    )
    
    # Template-uri de documente per tenant: cetățeanul poate cere o cerere, furnizează date (chat/poze), LLM completează și aplicația generează PDF
    if document_templates:
        enhanced += "\n\n=== TEMPLATE-URI CERERI DISPONIBILE ==="
        enhanced += "\nPentru acest tenant există următoarele cereri (template-uri) pe care cetățeanul le poate completa și primi în PDF:"
        for t in document_templates:
            name = t.get("template_name", t.get("filename", ""))
            filename = t.get("filename", "")
            variables = t.get("variables", [])
            labels = [v.get("label", v.get("key", "")) for v in variables]
            enhanced += f"\n- \"{name}\" (fișier template: {filename}). Câmpuri: {', '.join(labels) if labels else 'fără variabile'}"
        enhanced += "\n\n=== REGULI PENTRU LIVRAREA DOCUMENTULUI (indiferent de formulare) ==="
        enhanced += "\n1. Identificare cerere: Când utilizatorul menționează un tip de document din listă (prin nume, temă sau descriere: viza anuală, notificare, autorizare, cerere X, etc.), acesta este un template disponibil. Asociază cu filename-ul corespunzător din listă."
        enhanced += "\n2. Intenție de a primi documentul: Oricum formulează utilizatorul („dă-mi”, „vreau”, „generează”, „completează și trimite”, „am nevoie să îl primesc”, „să mi-l dai aici”, „fă-mi pdf”, orice variantă similară), dacă intenția este să primească documentul completat → încheie răspunsul cu exact: [GENERATE_PDF: filename], unde filename este din lista de mai sus. Nu depinde de anumite cuvinte; depinde de intenție."
        enhanced += "\n3. O singură cerere: Dacă utilizatorul cere într-un singur mesaj atât tipul de document (ex: viza anuală) cât și să îl primească (ex: „și dă-mi pdf aici”, „și trimite-mi-l”), tratează ca cerere de livrare: răspunde pozitiv și pune [GENERATE_PDF: filename]."
        enhanced += "\n4. Date parțiale: Dacă utilizatorul vrea deja documentul dar a dat doar o parte din date (nume, adresă etc.), livrează oricum: pune [GENERATE_PDF: filename]. Câmpurile lipsă rămân goale; aplicația extrage din conversație ce există."
        enhanced += "\n5. INTERZIS: Nu spune niciodată că nu poți genera sau manipula PDF. În această aplicație documentul se generează automat când pui [GENERATE_PDF: filename]. Răspunde întotdeauna că poți oferi documentul și pune tag-ul."
        enhanced += "\n6. La îndoială: Dacă nu e clar dacă utilizatorul vrea documentul livrat, interpretează în sensul că vrea — pune [GENERATE_PDF: filename] cu template-ul cel mai potrivit din listă. Folosește doar filename-uri din listă."
    
    # Adaugă textul din PDF/imagini dacă există (format compact pentru viteză)
    if pdf_text:
        # OPTIMIZARE CRITICĂ: Limitează la primele 200 caractere pentru prompt (viteză maximă)
        pdf_text_limited = pdf_text[:200] if len(pdf_text) > 200 else pdf_text
        enhanced += f"\n\n=== DOCUMENT ÎNCĂRCAT ===\n{pdf_text_limited}\n\n"
        enhanced += "INSTRUCȚIUNI:\n"
        enhanced += "1. Corectează automat erorile OCR (0→O, 1→I, 5→S, rn→m)\n"
        enhanced += "2. Identifică datele LIPSĂ și întreabă explicit utilizatorul\n"
        enhanced += "3. Extrage toate datele prezente (nume, CNP, adrese, date)\n"
        enhanced += "4. Pentru text suspect, sugerează corecție și cere confirmare\n"
        enhanced += "5. Când utilizatorul furnizează date manual, confirmă actualizarea\n\n"
        
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

