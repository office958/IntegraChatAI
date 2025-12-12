import cv2
import numpy as np
import json
import fitz

def pdf_to_image(pdf_path, dpi=200):
    doc = fitz.open(pdf_path)
    page = doc.load_page(0)
    pix = page.get_pixmap(dpi=dpi)
    image_path = "page_clean.png"
    pix.save(image_path)
    return image_path

def detect_underscores(image_path):
    """Detectează secvențele de underscore (______) din imagine"""
    img = cv2.imread(image_path, cv2.IMREAD_GRAYSCALE)
    
    # Threshold pentru a detecta zonele întunecate (text)
    _, binary = cv2.threshold(img, 180, 255, cv2.THRESH_BINARY_INV)
    
    # Kernel orizontal pentru a conecta underscore-urile apropiate
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (20, 1))
    dilated = cv2.dilate(binary, kernel, iterations=1)
    
    # Găsește contururi
    contours, _ = cv2.findContours(dilated, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    underscore_fields = []
    
    for cnt in contours:
        x, y, w, h = cv2.boundingRect(cnt)
        
        # Filtrează doar liniile orizontale subțiri (underscore-uri)
        # Condiții: lățime mare, înălțime mică, aspect ratio mare
        aspect_ratio = w / h if h > 0 else 0
        
        if w > 50 and h < 15 and aspect_ratio > 8:
            # Verifică dacă zona este într-adevăr o secvență de underscore
            roi = binary[y:y+h, x:x+w]
            density = np.sum(roi == 255) / (w * h)
            
            # Densitatea trebuie să fie rezonabilă pentru underscore-uri
            if 0.05 < density < 0.4:
                underscore_fields.append({
                    "x1": int(x),
                    "y1": int(y + h // 2),  # Linia din mijloc
                    "x2": int(x + w),
                    "y2": int(y + h // 2),
                    "type": "underscore"
                })
    
    return underscore_fields

def detect_form_fields(image_path):
    """Detectează liniile orizontale desenate în formular"""
    img = cv2.imread(image_path, cv2.IMREAD_GRAYSCALE)
    blur = cv2.GaussianBlur(img, (3, 3), 0)
    edges = cv2.Canny(blur, 80, 160)

    raw_lines = cv2.HoughLinesP(
        edges, 1, np.pi/180, threshold=120,
        minLineLength=300, maxLineGap=20
    )

    if raw_lines is None:
        return []

    horizontals = []
    for line in raw_lines:
        x1, y1, x2, y2 = line[0]
        if abs(y1 - y2) <= 4:
            horizontals.append((x1, y1, x2, y2))

    horizontals.sort(key=lambda l: l[1])

    filtered = []
    last_y = -999

    for x1, y1, x2, y2 in horizontals:
        if abs(y1 - last_y) > 20:
            filtered.append({
                "x1": x1, "y1": y1, 
                "x2": x2, "y2": y2,
                "type": "line"
            })
            last_y = y1

    return filtered

def merge_and_filter_fields(lines, underscores):
    """Combină câmpurile de tip linie și underscore, elimină duplicatele"""
    all_fields = lines + underscores
    
    # Sortează după poziția Y
    all_fields.sort(key=lambda f: f["y1"])
    
    # Elimină duplicatele (câmpuri foarte apropiate)
    filtered = []
    for field in all_fields:
        is_duplicate = False
        for existing in filtered:
            # Dacă două câmpuri sunt foarte apropiate în Y și se suprapun în X
            if abs(field["y1"] - existing["y1"]) < 15:
                # Verifică suprapunerea pe X
                x_overlap = not (field["x2"] < existing["x1"] or field["x1"] > existing["x2"])
                if x_overlap:
                    is_duplicate = True
                    break
        
        if not is_duplicate:
            filtered.append(field)
    
    return filtered

def extract_text_positions(pdf_path):
    doc = fitz.open(pdf_path)
    page = doc[0]
    words = page.get_text("words")

    results = []
    for w in words:
        x1, y1, x2, y2, text, *_ = w
        results.append({
            "text": text,
            "x1": x1, "y1": y1,
            "x2": x2, "y2": y2
        })
    return results

SEMANTIC_FIELDS = {
    "Subsemnatul": "subsemnatul",
    "domiciliat": "domiciliat_in",
    "strada": "strada_satul",
    "nr": "numar_adresa",
    "bloc": "bloc",
    "scara": "scara",
    "et": "etaj",
    "ap": "apartament",
    "actului de identitate": "act_identitate_seria",
    "seria": "act_identitate_seria",
    "nr.": "act_identitate_numar",
    "eliberat": "act_identitate_eliberat_de",
    "certificatul": "certificat_nastere_pentru",
    "născut(ă)": "data_nasterii",
    "localitatea": "localitatea_nasterii",
    "părinți": "parinti_copil",
    "împrejurări": "imprejurari",
    "telefon": "telefon",
    "e-mail": "email",
    "Semnătura": "semnatura",
    "Data": "data_completare",
    "Naștere": "nastere_seria",
    "Ofițer": "ofiter_stare_civila",
    "Am": "semnatura_primire",
    "fiul": "fiul_fiica",
    "prenume": "nume_prenume_copil",
    "contactat": "numar_telefon_contact",
    "Adresa": "adresa_email"
}

def match_semantic_label(text):
    t = text.lower()
    for key, sem_name in SEMANTIC_FIELDS.items():
        if key.lower() in t:
            return sem_name
    return None

def map_fields_to_labels(lines, words):
    mapped = []

    for field in lines:
        fx1, fy1 = field["x1"], field["y1"]

        best_label = None
        best_distance = 9999

        for w in words:
            wx1, wy1, wx2, wy2 = w["x1"], w["y1"], w["x2"], w["y2"]
            text = w["text"]

            semantic = match_semantic_label(text)
            if not semantic:
                continue

            # Caută etichete deasupra sau în stânga câmpului
            if wy2 < fy1 and fy1 - wy2 < 150:
                dist = fy1 - wy2
                if dist < best_distance:
                    best_distance = dist
                    best_label = semantic
            elif wx2 < fx1 and fx1 - wx2 < 200 and abs(wy1 - fy1) < 20:
                dist = fx1 - wx2
                if dist < best_distance:
                    best_distance = dist
                    best_label = semantic

        mapped.append({
            "name": best_label if best_label else "necunoscut",
            "x1": field["x1"],
            "y1": field["y1"],
            "x2": field["x2"],
            "y2": field["y2"]
        })

    return mapped

def to_native(obj):
    """Convertește numpy.int sau numpy.float în tipuri Python serializabile."""
    if isinstance(obj, (np.integer,)):
        return int(obj)
    if isinstance(obj, (np.floating,)):
        return float(obj)
    if isinstance(obj, dict):
        return {k: to_native(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [to_native(x) for x in obj]
    return obj

def save_json(data, path="mapped_fields.json"):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(to_native(data), f, indent=4, ensure_ascii=False)

# Main execution
pdf = "Declaratie-stabilire-impozit-cladire.pdf"

print("Convertesc PDF în imagine...")
image = pdf_to_image(pdf)

print("Detectez liniile orizontale...")
lines = detect_form_fields(image)

print("Detectez underscore-urile (______)...")
underscores = detect_underscores(image)

print(f"Găsite: {len(lines)} linii, {len(underscores)} underscore-uri")

print("Combin și filtrez câmpurile...")
all_fields = merge_and_filter_fields(lines, underscores)

print("Extrag text din PDF...")
words = extract_text_positions(pdf)

print("Mapez câmpurile cu etichete semantice...")
mapped = map_fields_to_labels(all_fields, words)

save_json(mapped)

print(f"\n✓ Mapare completă generată în mapped_fields.json")
print(f"✓ Total câmpuri detectate: {len(mapped)}")
print(f"  - Câmpuri cu etichete: {sum(1 for f in mapped if f['name'] != 'necunoscut')}")
print(f"  - Câmpuri necunoscute: {sum(1 for f in mapped if f['name'] == 'necunoscut')}")