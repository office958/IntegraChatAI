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
    
    # 2. Datele instituției (dacă există)
    if institution_data:
        institution_section = "\n\n=== DATE DESPRE INSTITUȚIE ===\n"
        
        # Nume și tip
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
        
        # Contact
        contact_info = []
        if institution_data.get("address"):
            contact_info.append(f"Adresă: {institution_data['address']}")
        if institution_data.get("phone"):
            contact_info.append(f"Telefon: {institution_data['phone']}")
        if institution_data.get("email"):
            contact_info.append(f"Email: {institution_data['email']}")
        if institution_data.get("website"):
            contact_info.append(f"Website: {institution_data['website']}")
        
        if contact_info:
            institution_section += "\nDate de contact:\n" + "\n".join(contact_info) + "\n"
        
        # Program de lucru
        working_hours = institution_data.get("working_hours")
        if working_hours:
            institution_section += "\nProgram de lucru:\n"
            days = {
                "monday": "Luni",
                "tuesday": "Marți",
                "wednesday": "Miercuri",
                "thursday": "Joi",
                "friday": "Vineri",
                "saturday": "Sâmbătă",
                "sunday": "Duminică"
            }
            for day_key, day_name in days.items():
                if working_hours.get(day_key):
                    institution_section += f"- {day_name}: {working_hours[day_key]}\n"
        
        # Servicii
        services = institution_data.get("services", [])
        if services:
            institution_section += f"\nServicii disponibile:\n"
            for service in services[:20]:  # Limitează la 20 servicii
                institution_section += f"- {service}\n"
            if len(services) > 20:
                institution_section += f"... și {len(services) - 20} alte servicii\n"
        
        # Taxe
        fees = institution_data.get("fees", [])
        if fees:
            institution_section += f"\nTaxe și tarife:\n"
            for fee in fees[:15]:  # Limitează la 15 taxe
                service = fee.get("service", "")
                amount = fee.get("amount", "")
                description = fee.get("description", "")
                fee_line = f"- {service}: {amount}"
                if description:
                    fee_line += f" ({description})"
                institution_section += fee_line + "\n"
            if len(fees) > 15:
                institution_section += f"... și {len(fees) - 15} alte taxe\n"
        
        # Atribuții
        responsibilities = institution_data.get("responsibilities", [])
        if responsibilities:
            institution_section += f"\nAtribuții principale:\n"
            for resp in responsibilities[:10]:  # Limitează la 10
                institution_section += f"- {resp}\n"
            if len(responsibilities) > 10:
                institution_section += f"... și {len(responsibilities) - 10} alte atribuții\n"
        
        # Politici de răspuns
        policies = institution_data.get("policies", {})
        if policies:
            institution_section += "\nPolitici de răspuns:\n"
            
            tone = policies.get("tone")
            if tone:
                tone_descriptions = {
                    "formal": "Folosește un ton formal și respectuos, adresându-te la persoane cu 'Dumneavoastră'.",
                    "simplu": "Folosește un ton simplu și accesibil, ușor de înțeles pentru toată lumea.",
                    "prietenos": "Folosește un ton prietenos și apropiat, dar rămâi profesional.",
                    "profesionist": "Folosește un ton profesionist și clar, fără familiarități excesive."
                }
                institution_section += f"- Ton: {tone_descriptions.get(tone, tone)}\n"
            
            detail_level = policies.get("detail_level")
            if detail_level:
                detail_descriptions = {
                    "scurt": "Oferă răspunsuri concise și directe, fără detalii excesive.",
                    "mediu": "Oferă răspunsuri echilibrate, cu informații esențiale și câteva detalii relevante.",
                    "detaliat": "Oferă răspunsuri detaliate și complete, cu toate informațiile relevante."
                }
                institution_section += f"- Nivel de detaliere: {detail_descriptions.get(detail_level, detail_level)}\n"
            
            language = policies.get("language")
            if language:
                lang_names = {"ro": "Română", "en": "Engleză", "hu": "Maghiară", "de": "Germană"}
                institution_section += f"- Limbă: {lang_names.get(language, language)}\n"
        
        prompt_parts.append(institution_section)
    
    # 3. Contextul RAG (dacă există)
    if rag_context:
        prompt_parts.append(f"\n\n=== DOCUMENTE ȘI INFORMAȚII OFICIALE ===\n{rag_context}\n\n=== INSTRUCȚIUNI PENTRU UTILIZAREA DOCUMENTELOR ===\nFolosește EXCLUSIV informațiile din documentele de mai sus pentru a răspunde la întrebări. Aceste documente conțin informații oficiale și specifice instituției. Dacă informația nu este în documente, spune explicit că nu ai această informație disponibilă și îndrumă utilizatorul către sursele oficiale sau contactează instituția direct.")
    
    # 4. Instrucțiuni finale
    prompt_parts.append("\n\n=== REGULI GENERALE ===\n")
    prompt_parts.append("- Răspunde întotdeauna pe baza informațiilor oficiale și documentelor disponibile.\n")
    prompt_parts.append("- Dacă nu știi răspunsul, recunoaște acest lucru și îndrumă utilizatorul către sursele potrivite.\n")
    prompt_parts.append("- Nu inventa informații sau date care nu sunt în documentele oficiale.\n")
    prompt_parts.append("- Fii respectuos, clar și util în toate răspunsurile.\n")
    
    return "".join(prompt_parts)

