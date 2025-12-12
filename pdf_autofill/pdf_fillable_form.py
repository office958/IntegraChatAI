from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from PyPDF2 import PdfReader, PdfWriter

# 1. Generăm un PDF temporar care conține DOAR câmpurile fillable
temp_pdf = "temp_fillable.pdf"
c = canvas.Canvas(temp_pdf, pagesize=A4)

# -------------------------
# AICI DEFINIM CÂMPURILE
# -------------------------

c.acroForm.textfield(name='subsemnatul', x=120, y=760, width=300, height=20)
c.acroForm.textfield(name='fiul_fiica_parinte', x=430, y=760, width=120, height=20)

c.acroForm.textfield(name='parinte1', x=120, y=735, width=250, height=20)
c.acroForm.textfield(name='parinte2', x=380, y=735, width=250, height=20)

c.acroForm.textfield(name='domiciliat_in', x=160, y=710, width=350, height=20)
c.acroForm.textfield(name='strada_satul', x=160, y=685, width=350, height=20)
c.acroForm.textfield(name='nr_bloc_scara_ap', x=160, y=660, width=350, height=20)

c.acroForm.textfield(name='act_identitate_seria', x=260, y=635, width=200, height=20)
c.acroForm.textfield(name='act_identitate_numar', x=470, y=635, width=100, height=20)
c.acroForm.textfield(name='eliberat_de', x=200, y=610, width=380, height=20)

c.acroForm.textfield(name='nume_copil', x=180, y=580, width=350, height=20)
c.acroForm.textfield(name='nascut_la_data', x=170, y=555, width=180, height=20)
c.acroForm.textfield(name='in_localitatea', x=430, y=555, width=180, height=20)
c.acroForm.textfield(name='parinti_ai_copilului', x=200, y=530, width=350, height=20)

c.acroForm.textfield(name='imprejurari_text', x=70, y=470, width=500, height=60)

c.acroForm.textfield(name='telefon', x=300, y=430, width=200, height=20)
c.acroForm.textfield(name='email', x=300, y=405, width=200, height=20)

c.acroForm.textfield(name='data_formular', x=120, y=370, width=180, height=20)
c.acroForm.textfield(name='semnatura', x=420, y=370, width=160, height=20)

c.acroForm.textfield(name='nastere_seria', x=150, y=315, width=150, height=20)
c.acroForm.textfield(name='nastere_numar', x=330, y=315, width=150, height=20)
c.acroForm.textfield(name='data_eliberare_certif', x=120, y=290, width=150, height=20)

c.acroForm.textfield(name='ofiter_stare_civila', x=120, y=255, width=250, height=20)
c.acroForm.textfield(name='semnatura_primire', x=420, y=225, width=160, height=20)

c.showPage()
c.save()

# 2. Încărcăm PDF-ul original și PDF-ul cu câmpurile
original_pdf = PdfReader("CERERE-CERTIFICAT-NASTERE-COPIL.pdf")
fillable_pdf = PdfReader(temp_pdf)

# 3. Combinăm (overlay) câmpurile peste PDF-ul original
writer = PdfWriter()
page = original_pdf.pages[0]
form_layer = fillable_pdf.pages[0]

page.merge_page(form_layer)  # Aici se face magia

writer.add_page(page)

# 4. Salvăm PDF-ul final completabil
output_path = "CERERE-CERTIFICAT-NASTERE-COPIL-fillable.pdf"
with open(output_path, "wb") as f:
    writer.write(f)

print("PDF fillable generat cu succes:", output_path)
