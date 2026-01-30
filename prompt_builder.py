"""
Modul pentru construirea dinamică a prompturilor de sistem bazate pe datele instituției.
"""
from typing import Optional, Dict, Any

def build_dynamic_system_prompt(
    base_prompt: str,
    institution_data: Optional[Dict[str, Any]] = None,
    rag_context: Optional[str] = None
) -> str:
    """
    Construiește promptul de sistem dinamic bazat pe:
    - Promptul de bază (instrucțiuni generale)
    - Datele instituției (nume, adrese, program, servicii, taxe, etc.)
    - Contextul RAG (documente relevante)
    """
    prompt_parts = []
    
    # 1. Promptul de bază
    prompt_parts.append(base_prompt)
    
    # 2. Datele instituției (dacă există) - OPTIMIZAT pentru viteză maximă
    if institution_data:
        institution_section = "\n\n=== INSTITUȚIE ===\n"
        
        # Nume și tip (doar esențial)
        name = institution_data.get("name", "")
        inst_type = institution_data.get("type", "")
        if name:
            type_names = {
                "primarie": "Primăria",
                "scoala": "Școala",
                "ong": "ONG-ul",
                "companie": "Compania",
                "dsp": "DSP-ul",
                "alta": "Instituția"
            }
            type_name = type_names.get(inst_type, "Instituția")
            institution_section += f"Ești asistentul digital al {type_name} {name}.\n"
        
        # Contact (doar esențial, limitat)
        contact_parts = []
        if institution_data.get("phone"):
            contact_parts.append(f"Tel: {institution_data['phone']}")
        if institution_data.get("email"):
            contact_parts.append(f"Email: {institution_data['email']}")
        
        if contact_parts:
            institution_section += ", ".join(contact_parts) + "\n"
        
        # Servicii (doar primele 3 pentru viteză)
        services = institution_data.get("services", [])
        if services:
            institution_section += f"Servicii: {', '.join(services[:3])}"
            if len(services) > 3:
                institution_section += f" (+{len(services)-3} altele)"
            institution_section += "\n"
        
        # Politici (doar esențial)
        policies = institution_data.get("policies", {})
        if policies:
            tone = policies.get("tone", "")
            if tone:
                institution_section += f"Ton: {tone}\n"
        
        # Limitează la 200 caractere total pentru viteză maximă
        if len(institution_section) > 200:
            institution_section = institution_section[:200] + "...\n"
        
        prompt_parts.append(institution_section)
    
    # 3. Contextul RAG (dacă există) - OPTIMIZAT pentru viteză maximă
    if rag_context:
        # Limitează RAG context la 500 caractere pentru viteză maximă
        rag_limited = rag_context[:500] + "..." if len(rag_context) > 500 else rag_context
        prompt_parts.append(f"\n\n=== DOCUMENTE ===\n{rag_limited}\n\nFolosește informațiile din documente.")
    
    # 4. Instrucțiuni finale (minimizate pentru viteză)
    prompt_parts.append("\n\n=== REGULI ===\n")
    prompt_parts.append("Răspunde pe baza documentelor. Dacă nu știi, spune explicit.\n")
    
    # Limitează prompt-ul total la 1000 caractere pentru viteză maximă
    final_prompt = "".join(prompt_parts)
    if len(final_prompt) > 1000:
        final_prompt = final_prompt[:1000] + "..."
    
    return final_prompt

